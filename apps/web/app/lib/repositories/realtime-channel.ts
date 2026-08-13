import type { FrontendState } from '../frontend-state.ts';
import { apiBaseUrl, apiRequest } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';
import { normalizeSnapshot, type RealtimeConnect } from './http-adapter.ts';
import { createPollingChannel, type ChannelOptions } from './polling-channel.ts';

/**
 * Tempo real pelo stream da edição.
 *
 * O canal é **público de propósito e não carrega estado privado**: cada evento
 * traz só o número da revisão. Quem tem sessão usa isso como gatilho e rebusca
 * o snapshot autenticado com o token; quem não tem consome o snapshot público
 * que viaja junto, para o espectador não pagar uma segunda viagem.
 *
 * A alternativa seria autenticar o próprio stream, e nenhuma forma serve:
 * `EventSource` não envia `Authorization`; token na query vaza em log de proxy,
 * histórico e `Referer`; e cookie não atravessa `app.localhost` × `api.localhost`
 * com `SameSite=Strict`. Manter o canal sem segredo resolve os três de uma vez.
 */
export const snapshotEvent = 'edition-snapshot';
export const changedEvent = 'edition-changed';

type RealtimeMode = 'sse' | 'poll' | 'off';

type SseOptions = ChannelOptions & { eventSourceImpl?: typeof EventSource };

/** Quanto tempo esperar antes de transformar uma rajada de eventos num GET. */
const coalesceMs = 200;
const maxBackoffMs = 30_000;

function resolveMode(): RealtimeMode {
  const mode = process.env.NEXT_PUBLIC_REALTIME;
  return mode === 'poll' || mode === 'off' ? mode : 'sse';
}

/**
 * O canal que o adaptador HTTP assina. A escolha do transporte mora aqui
 * dentro para o hook de estado não precisar saber que ela existe.
 */
export function createRealtimeChannel(options: SseOptions = {}): RealtimeConnect {
  const mode = resolveMode();
  if (mode === 'off') return () => () => {};
  if (mode === 'poll') return createPollingChannel(options);
  return createSseChannel(options);
}

function createSseChannel(options: SseOptions): RealtimeConnect {
  const edition = options.edition ?? 'active';
  const token = () => (options.getToken ?? readSessionToken)();

  return (onSnapshot, onConnection) => {
    const EventSourceImpl = options.eventSourceImpl ?? globalThis.EventSource;
    // Ambiente sem EventSource (servidor, teste de componente): o app segue
    // funcionando — cada operação já devolve o estado novo.
    if (!EventSourceImpl) return () => {};

    let source: EventSource | undefined;
    let closed = false;
    let attempt = 0;
    let lastEventId = '';
    /** Última busca disparada: resposta que chega fora de ordem é descartada. */
    let requested = 0;
    let coalesce: number | undefined;
    let retry: number | undefined;

    async function pull() {
      const ticket = requested + 1;
      requested = ticket;
      try {
        const payload = await apiRequest<Partial<FrontendState>>({
          path: `/editions/${edition}/snapshot`,
          token: token(),
          fetchImpl: options.fetchImpl,
        });
        if (closed || ticket !== requested) return;
        onSnapshot(normalizeSnapshot(payload));
      } catch {
        // Falha aqui não derruba o canal: o próximo evento tenta de novo, e o
        // 401 já é tratado por quem despacha.
      }
    }

    function scheduleReconnect() {
      attempt += 1;
      const delay = Math.min(maxBackoffMs, 1_000 * 2 ** (attempt - 1));
      retry = window.setTimeout(() => {
        // Sem rede não adianta insistir; espera a próxima janela.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return scheduleReconnect();
        open();
      }, delay + delay * 0.25 * Math.random());
    }

    function open() {
      if (closed) return;
      // O navegador só reenvia `Last-Event-ID` nas reconexões dele. Quando somos
      // nós que reabrimos, o id volta pela query.
      const query = lastEventId ? `?lastEventId=${encodeURIComponent(lastEventId)}` : '';
      source = new EventSourceImpl(`${apiBaseUrl()}/editions/${edition}/stream${query}`);

      source.addEventListener('open', () => {
        const reconnected = attempt > 0;
        attempt = 0;
        onConnection?.('online');
        // Reconexão pode ter tido janela cega: puxa o estado atual.
        if (reconnected && token()) void pull();
      });

      source.addEventListener(changedEvent, (event) => {
        const message = event as MessageEvent<string>;
        lastEventId = message.lastEventId || lastEventId;
        // O espectador recebe o estado pelo outro evento; aqui só quem tem sessão.
        if (!token()) return;
        window.clearTimeout(coalesce);
        coalesce = window.setTimeout(() => void pull(), coalesceMs);
      });

      source.addEventListener(snapshotEvent, (event) => {
        const message = event as MessageEvent<string>;
        lastEventId = message.lastEventId || lastEventId;
        // Quem administra não absorve a visão reduzida: ela apagaria staff,
        // auditoria e rascunhos da tela de quem tem direito de vê-los.
        if (token()) return;
        try {
          onSnapshot(normalizeSnapshot(JSON.parse(message.data) as Partial<FrontendState>));
          onConnection?.('online');
        } catch { /* quadro malformado não derruba o canal */ }
      });

      source.addEventListener('error', () => {
        onConnection?.('offline');
        if (closed) return;
        // `CONNECTING` é o navegador reconectando sozinho; `CLOSED` é ele
        // desistindo — respostas não-2xx e content-type errado caem aqui.
        if (source?.readyState === EventSourceImpl.CONNECTING) return;
        source?.close();
        scheduleReconnect();
      });
    }

    open();
    return () => {
      closed = true;
      window.clearTimeout(coalesce);
      window.clearTimeout(retry);
      source?.close();
    };
  };
}
