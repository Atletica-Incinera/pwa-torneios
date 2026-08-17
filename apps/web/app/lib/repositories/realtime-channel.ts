import { apiBaseUrl } from './api-client.ts';
import type { EditionRevision, RealtimeConnect } from './http-adapter.ts';

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

/**
 * Mantém um EventSource por edição. O navegador cuida do reconnect e reenvia o
 * último `id` recebido como `Last-Event-ID`; o cliente apenas refaz o snapshot
 * autorizado quando chega uma revisão mais nova.
 */
export function createRealtimeChannel(): RealtimeConnect {
  return (edition, onRevision, onConnection) => {
    const source = new EventSource(streamUrl(edition), { withCredentials: false });
    let closed = false;

    const receive = (rawEvent: Event) => {
      const revision = parseRevision(rawEvent as MessageEvent<string>);
      if (revision) onRevision(revision);
    };

    source.addEventListener(revisionEvent, receive);
    // Aceita também streams sem `event:` para manter compatibilidade HTTP.
    source.onmessage = receive;
    source.onopen = () => { if (!closed) onConnection?.('online'); };
    source.onerror = () => { if (!closed) onConnection?.('offline'); };

    return () => {
      closed = true;
      source.removeEventListener(revisionEvent, receive);
      source.close();
    };
  };
}
