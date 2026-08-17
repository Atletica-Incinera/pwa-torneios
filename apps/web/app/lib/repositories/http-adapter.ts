import { getActiveEdition, initialFrontendState, type FrontendState } from '../frontend-state.ts';
import { createId } from '../create-id.ts';
import type { AxiosAdapter } from 'axios';
import { apiRequestEnvelope, type ApiEnvelope } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';
import type { Action } from './actions.ts';
import type { ConnectionState, StateAdapter } from './state-adapter.ts';

const snapshotRevisions = new WeakMap<FrontendState, number>();
const snapshotEditions = new WeakMap<FrontendState, string>();

function envelopeRevision(meta: unknown): number | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  const revision = (meta as { revision?: unknown }).revision;
  return typeof revision === 'number' && Number.isInteger(revision) && revision >= 0
    ? revision
    : undefined;
}

/** Metadado técnico não enumerável: nunca entra no estado persistido ou no payload. */
export function snapshotRevision(snapshot: FrontendState): number | undefined {
  return snapshotRevisions.get(snapshot);
}

export function snapshotEdition(snapshot: FrontendState): string | undefined {
  return snapshotEditions.get(snapshot);
}

/**
 * O snapshot que o servidor devolve tem o mesmo formato do estado local, mas
 * pode omitir coleções vazias. Completar aqui evita `undefined` em 45 telas.
 */
export function normalizeSnapshot(payload: Partial<FrontendState>, revision?: number): FrontendState {
  const normalized: FrontendState = {
    ...initialFrontendState,
    ...payload,
    teams: payload.teams ?? {},
    athletes: payload.athletes ?? {},
    disciplines: payload.disciplines ?? {},
    tournaments: payload.tournaments ?? {},
    matches: payload.matches ?? {},
    staff: payload.staff ?? {},
    audit: payload.audit ?? [],
    overallRanking: {
      metrics: payload.overallRanking?.metrics ?? initialFrontendState.overallRanking.metrics,
      awards: payload.overallRanking?.awards ?? [],
      closures: payload.overallRanking?.closures ?? [],
    },
    preferences: { ...initialFrontendState.preferences, ...payload.preferences },
  };
  if (revision !== undefined) snapshotRevisions.set(normalized, revision);
  return normalized;
}

/** Invalidação pública emitida pelo SSE; nenhum dado da edição viaja no evento. */
export type EditionRevision = { editionId: string; revision: number };

/** Conexão de tempo real. Recebe revisões e devolve como se desligar. */
export type RealtimeConnect = (
  edition: string,
  onRevision: (event: EditionRevision) => void,
  onConnection?: (state: ConnectionState) => void,
) => () => void;

export type HttpAdapterOptions = {
  /** Edição a carregar. `active` deixa o servidor resolver qual é a vigente. */
  edition?: string;
  getToken?: () => string | null;
  adapter?: AxiosAdapter;
  connect?: RealtimeConnect;
};

/**
 * Estado vindo da API.
 *
 * Duas rotas apenas: o snapshot da edição e o canal de operações. A união em
 * `actions.ts` é o contrato — cada `type` é uma operação que o servidor aceita,
 * valida com os mesmos módulos de regra e responde já com o estado resultante.
 * Como conexão é obrigatória, não há atualização otimista: a resposta é a
 * verdade, e o id de tudo que nasce vem de lá.
 */
export function createHttpStateAdapter(options: HttpAdapterOptions = {}): StateAdapter {
  const edition = options.edition ?? 'active';
  const token = () => (options.getToken ?? readSessionToken)();
  const request = <T>(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
    headers?: Record<string, string>,
  ) => apiRequestEnvelope<T>({
    path,
    method,
    body,
    headers,
    token: token(),
    adapter: options.adapter,
  });
  let latestSnapshot: FrontendState | undefined;
  let latestRevision = -1;
  let latestRequestSequence = -1;
  let latestEditionId: string | undefined;
  let requestSequence = 0;

  const acceptSnapshot = (
    envelope: ApiEnvelope<Partial<FrontendState>>,
    sequence: number,
  ): FrontendState => {
    const revision = envelopeRevision(envelope.meta);
    const normalized = normalizeSnapshot(envelope.data, revision);
    const snapshotEditionId = edition === 'active'
      ? getActiveEdition(normalized)?.id
      : edition;

    if (latestSnapshot) {
      if (snapshotEditionId !== latestEditionId && sequence < latestRequestSequence) {
        return latestSnapshot;
      }
      if (snapshotEditionId === latestEditionId) {
        if (revision === undefined && (latestRevision >= 0 || sequence < latestRequestSequence)) {
          return latestSnapshot;
        }
        if (
          revision !== undefined
          && (revision < latestRevision || (revision === latestRevision && sequence < latestRequestSequence))
        ) {
          return latestSnapshot;
        }
      }
    }

    latestSnapshot = normalized;
    latestRevision = revision ?? -1;
    latestRequestSequence = sequence;
    latestEditionId = snapshotEditionId;
    if (snapshotEditionId) snapshotEditions.set(normalized, snapshotEditionId);
    return normalized;
  };

  const loadSnapshot = async () => {
    // Sem sessão, o app é o do espectador: o servidor devolve a versão
    // pública, sem staff, sem auditoria e sem categoria em rascunho. Filtrar
    // isso só na tela deixaria o dado sair do servidor mesmo assim.
    const path = token() ? `/editions/${edition}/snapshot` : `/editions/${edition}/public-snapshot`;
    const sequence = ++requestSequence;
    return acceptSnapshot(await request<Partial<FrontendState>>(path, 'GET'), sequence);
  };

  return {
    load: loadSnapshot,

    async apply(action: Action) {
      const idempotencyKey = createId('mutation');
      const sequence = ++requestSequence;
      const envelope = await request<Partial<FrontendState>>(
        `/editions/${edition}/actions`,
        'POST',
        action,
        { 'Idempotency-Key': idempotencyKey },
      );
      return acceptSnapshot(envelope, sequence);
    },

    subscribe(onRemoteChange, onConnection) {
      // Sem canal configurado o app continua funcionando: cada operação já
      // devolve o estado novo; o que falta é ver a mudança dos outros.
      let closed = false;
      let loading = false;
      let refreshRequested = false;
      let pending: EditionRevision | undefined;
      let appliedEditionId: string | undefined;
      let appliedRevision = -1;
      let reconnectRequested = false;
      let disconnectStream: () => void = () => undefined;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      let retryDelayMilliseconds = 500;

      const clearRetryTimer = () => {
        if (retryTimer !== undefined) clearTimeout(retryTimer);
        retryTimer = undefined;
      };

      const resetRetryBackoff = () => {
        clearRetryTimer();
        retryDelayMilliseconds = 500;
      };

      const queueRevision = (event: EditionRevision) => {
        if (pending?.editionId === event.editionId) {
          pending = { ...event, revision: Math.max(pending.revision, event.revision) };
          return;
        }
        pending = event;
      };

      const refreshFromServer = async () => {
        if (closed || loading) return;
        clearRetryTimer();
        loading = true;
        let target: EditionRevision | undefined;
        let refreshFailed = false;
        try {
          while (!closed && (refreshRequested || pending)) {
            refreshRequested = false;
            target = pending;
            pending = undefined;
            const next = await loadSnapshot();
            if (closed) return;
            onRemoteChange(next);
            const returnedEditionId = snapshotEdition(next);
            const returnedRevision = snapshotRevision(next);
            const previousAppliedEditionId = appliedEditionId;
            if (returnedEditionId && returnedRevision !== undefined) {
              appliedEditionId = returnedEditionId;
              appliedRevision = returnedRevision;
            }
            onConnection?.('online');

            if (target) {
              const reachedTarget = returnedEditionId === target.editionId
                && returnedRevision !== undefined
                && returnedRevision >= target.revision;
              const activeEditionChanged = edition === 'active'
                && returnedEditionId !== undefined
                && returnedEditionId !== target.editionId
                && returnedEditionId !== previousAppliedEditionId;
              if (activeEditionChanged) reconnectRequested = true;
              if (!reachedTarget && !activeEditionChanged) {
                // Cache offline ou réplica atrasada: guarda a invalidação sem
                // repetir em loop. O próximo open/online/evento tenta de novo.
                queueRevision(target);
                refreshFailed = true;
                break;
              }
            }
            resetRetryBackoff();
            target = undefined;
          }
        } catch {
          if (target) queueRevision(target);
          else refreshRequested = true;
          refreshFailed = true;
          // O stream continua reconectando. Uma próxima revisão ou o evento
          // `online` do navegador tentará carregar novamente pelo adapter.
          onConnection?.('offline');
        } finally {
          loading = false;
          if (reconnectRequested && !closed) {
            reconnectRequested = false;
            connectStream();
          }
          if (refreshFailed && !closed && (pending || refreshRequested)) scheduleRetry();
        }
      };

      const scheduleRetry = () => {
        if (closed || retryTimer !== undefined || (!pending && !refreshRequested)) return;
        const delay = retryDelayMilliseconds;
        retryDelayMilliseconds = Math.min(retryDelayMilliseconds * 2, 8_000);
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          if (!closed && (pending || refreshRequested)) void refreshFromServer();
        }, delay);
      };

      const receiveRevision = (event: EditionRevision) => {
        if (event.editionId === appliedEditionId && event.revision <= appliedRevision) return;
        queueRevision(event);
        void refreshFromServer();
      };
      const updateConnection = (state: ConnectionState) => {
        onConnection?.(state);
        if (state === 'online') {
          // O primeiro `open` e todo reconnect fecham a janela entre o GET
          // inicial e a assinatura do stream, mesmo sem revisão pendente.
          refreshRequested = true;
          void refreshFromServer();
        }
      };
      const connectStream = () => {
        disconnectStream();
        disconnectStream = options.connect?.(
          edition,
          receiveRevision,
          updateConnection,
        ) ?? (() => undefined);
      };
      connectStream();

      return () => {
        closed = true;
        clearRetryTimer();
        disconnectStream();
      };
    },
  };
}
