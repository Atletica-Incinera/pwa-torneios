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

const sharedChannels = new Map<string, SharedRealtimeChannel>();

function openSharedChannel(url: string): SharedRealtimeChannel {
  const source = new EventSource(url, { withCredentials: false });
  const subscribers = new Set<RealtimeSubscriber>();
  const channel: SharedRealtimeChannel = {
    source,
    subscribers,
    dispose: () => undefined,
  };

  const receive = (rawEvent: Event) => {
    const revision = parseRevision(rawEvent as MessageEvent<string>);
    if (!revision) return;
    for (const subscriber of [...subscribers]) subscriber.onRevision(revision);
  };
  const updateConnection = (connection: ConnectionState) => {
    channel.connection = connection;
    for (const subscriber of [...subscribers]) subscriber.onConnection?.(connection);
  };

  source.addEventListener(revisionEvent, receive);
  // Aceita também streams sem `event:` para manter compatibilidade HTTP.
  source.onmessage = receive;
  source.onopen = () => updateConnection('online');
  source.onerror = () => updateConnection('offline');
  channel.dispose = () => {
    source.removeEventListener(revisionEvent, receive);
    source.close();
  };
  return channel;
}

/**
 * Mantém um EventSource por edição. O navegador cuida do reconnect e reenvia o
 * último `id` recebido como `Last-Event-ID`; o cliente apenas refaz o snapshot
 * autorizado quando chega uma revisão mais nova.
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
