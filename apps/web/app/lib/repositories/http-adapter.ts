import { initialFrontendState, type FrontendState } from '@atletica-incinera/intereng-contract/state';
import type { Action } from '@atletica-incinera/intereng-contract/actions';
import { apiRequest } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';
import type { ConnectionState, StateAdapter } from './state-adapter.ts';

/**
 * Os campos que identificam um snapshot. Nenhum outro corpo do contrato os tem.
 * O `satisfies` é o que faz um campo renomeado no contrato quebrar o typecheck
 * em vez de enfraquecer a checagem em silêncio.
 */
const snapshotFields = ['competitions', 'editions', 'teams', 'athletes', 'disciplines', 'tournaments', 'matches', 'overallRanking', 'staff', 'audit', 'preferences'] as const satisfies readonly (keyof FrontendState)[];

/**
 * O snapshot que o servidor devolve tem o mesmo formato do estado local, mas
 * pode omitir coleções vazias. Completar aqui evita `undefined` em 45 telas.
 *
 * Completar o que falta é tolerância; completar **tudo** é inventar uma edição.
 * Um corpo que não traz nenhum campo do estado — porque veio embrulhado, ou
 * porque a rota mudou — sairia daqui como um snapshot vazio e plausível, e a
 * tela diria `pronto` sem ter carregado nada. Por isso recusa em voz alta.
 */
export function normalizeSnapshot(payload: Partial<FrontendState>): FrontendState {
  if (!payload || typeof payload !== 'object' || !snapshotFields.some((field) => field in payload)) {
    throw new Error('O servidor respondeu sem o estado da edição.');
  }
  return {
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
}

/** Conexão de tempo real. Recebe o snapshot novo e devolve como se desligar. */
export type RealtimeConnect = (onSnapshot: (next: FrontendState) => void, onConnection?: (state: ConnectionState) => void) => () => void;

export type HttpAdapterOptions = {
  /** Edição a carregar. `active` deixa o servidor resolver qual é a vigente. */
  edition?: string;
  getToken?: () => string | null;
  fetchImpl?: typeof fetch;
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
  const request = <T>(path: string, method: 'GET' | 'POST', body?: unknown) =>
    apiRequest<T>({ path, method, body, token: token(), fetchImpl: options.fetchImpl });

  return {
    async load() {
      // Sem sessão, o app é o do espectador: o servidor devolve a versão
      // pública, sem staff, sem auditoria e sem categoria em rascunho. Filtrar
      // isso só na tela deixaria o dado sair do servidor mesmo assim.
      const path = token() ? `/editions/${edition}/snapshot` : `/editions/${edition}/public-snapshot`;
      return normalizeSnapshot(await request<Partial<FrontendState>>(path, 'GET'));
    },

    async apply(action: Action) {
      return normalizeSnapshot(await request<Partial<FrontendState>>(`/editions/${edition}/actions`, 'POST', action));
    },

    subscribe(onRemoteChange, onConnection) {
      // Sem canal configurado o app continua funcionando: cada operação já
      // devolve o estado novo; o que falta é ver a mudança dos outros.
      return options.connect?.((next) => onRemoteChange(next), onConnection) ?? (() => {});
    },
  };
}
