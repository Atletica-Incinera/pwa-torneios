import { apiBaseUrl } from './api-client.ts';
import type { EditionRevision, RealtimeConnect } from './http-adapter.ts';
import type { ConnectionState } from './state-adapter.ts';

/** O stream público só invalida o snapshot; dados da edição nunca trafegam pelo SSE. */
export const revisionEvent = 'edition-revision';

function streamUrl(edition: string): string {
  const base = apiBaseUrl();
  const path = `${base}/editions/${encodeURIComponent(edition)}/stream`;
  return new URL(path, window.location.origin).toString();
}

function parseRevision(event: MessageEvent<string>): EditionRevision | null {
  try {
    const payload: unknown = JSON.parse(event.data);
    if (!payload || typeof payload !== 'object') return null;
    const candidate = payload as Partial<EditionRevision>;
    if (
      typeof candidate.editionId !== 'string'
      || typeof candidate.revision !== 'number'
      || !Number.isInteger(candidate.revision)
      || candidate.revision < 0
    ) return null;
    return { editionId: candidate.editionId, revision: candidate.revision };
  } catch {
    return null;
  }
}

type RealtimeSubscriber = {
  onRevision: (event: EditionRevision) => void;
  onConnection?: (state: ConnectionState) => void;
};

type SharedRealtimeChannel = {
  source: EventSource;
  subscribers: Set<RealtimeSubscriber>;
  connection?: ConnectionState;
  dispose: () => void;
};

/**
 * Espera antes de reabrir o canal, dobrando a cada tentativa.
 *
 * O reconnect automático do `EventSource` só existe para conexão interrompida:
 * quando o servidor responde algo diferente de 200 — e o teto de conexões
 * simultâneas responde 429 — a especificação manda o navegador FECHAR e nunca
 * mais tentar. Sem reabrir por conta própria, a aba que apanhasse do teto
 * ficaria sem tempo real até alguém recarregar a página.
 */
const reopenDelays = [500, 1_000, 2_000, 4_000, 8_000] as const;

const sharedChannels = new Map<string, SharedRealtimeChannel>();

function openSharedChannel(url: string): SharedRealtimeChannel {
  const subscribers = new Set<RealtimeSubscriber>();
  const channel: SharedRealtimeChannel = {
    source: new EventSource(url, { withCredentials: false }),
    subscribers,
    dispose: () => undefined,
  };
  let attempt = 0;
  let disposed = false;
  let reopenTimer: number | undefined;

  const receive = (rawEvent: Event) => {
    const revision = parseRevision(rawEvent as MessageEvent<string>);
    if (!revision) return;
    for (const subscriber of [...subscribers]) subscriber.onRevision(revision);
  };
  const updateConnection = (connection: ConnectionState) => {
    channel.connection = connection;
    for (const subscriber of [...subscribers]) subscriber.onConnection?.(connection);
  };

  const detach = (target: EventSource) => {
    target.removeEventListener(revisionEvent, receive);
    target.onmessage = null;
    target.onopen = null;
    target.onerror = null;
  };
  const attach = (target: EventSource) => {
    target.addEventListener(revisionEvent, receive);
    // Aceita também streams sem `event:` para manter compatibilidade HTTP.
    target.onmessage = receive;
    target.onopen = () => { attempt = 0; updateConnection('online'); };
    target.onerror = () => {
      updateConnection('offline');
      if (channel.source.readyState !== EventSource.CLOSED || disposed) return;
      const wait = reopenDelays[Math.min(attempt, reopenDelays.length - 1)];
      attempt += 1;
      reopenTimer = window.setTimeout(reopen, wait);
    };
  };
  const reopen = () => {
    if (disposed) return;
    detach(channel.source);
    channel.source.close();
    channel.source = new EventSource(url, { withCredentials: false });
    attach(channel.source);
  };
  attach(channel.source);
  channel.dispose = () => {
    disposed = true;
    if (reopenTimer !== undefined) window.clearTimeout(reopenTimer);
    detach(channel.source);
    channel.source.close();
  };
  return channel;
}

/**
 * Mantém um EventSource por edição. O navegador reconecta sozinho e reenvia o
 * último `id` recebido como `Last-Event-ID` — mas só quando a conexão cai; se o
 * servidor responder algo diferente de 200 ele fecha em definitivo, e é aí que
 * `openSharedChannel` reabre por conta própria. O cliente apenas refaz o
 * snapshot autorizado quando chega uma revisão mais nova.
 */
export function createRealtimeChannel(): RealtimeConnect {
  return (edition, onRevision, onConnection) => {
    const url = streamUrl(edition);
    const channel = sharedChannels.get(url) ?? openSharedChannel(url);
    sharedChannels.set(url, channel);
    const subscriber: RealtimeSubscriber = { onRevision, onConnection };
    channel.subscribers.add(subscriber);
    let closed = false;

    if (channel.connection) onConnection?.(channel.connection);

    return () => {
      if (closed) return;
      closed = true;
      channel.subscribers.delete(subscriber);
      if (channel.subscribers.size === 0 && sharedChannels.get(url) === channel) {
        sharedChannels.delete(url);
        channel.dispose();
      }
    };
  };
}
