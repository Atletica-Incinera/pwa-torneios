import { initialFrontendState, type FrontendState } from '../frontend-state.ts';
import type { AxiosAdapter } from 'axios';
import { apiRequest } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';
import type { Action } from './actions.ts';
import type { ConnectionState, StateAdapter } from './state-adapter.ts';

/**
 * O snapshot que o servidor devolve tem o mesmo formato do estado local, mas
 * pode omitir coleções vazias. Completar aqui evita `undefined` em 45 telas.
 */
export function normalizeSnapshot(payload: Partial<FrontendState>): FrontendState {
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
  const request = <T>(path: string, method: 'GET' | 'POST', body?: unknown) =>
    apiRequest<T>({ path, method, body, token: token(), adapter: options.adapter });

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
