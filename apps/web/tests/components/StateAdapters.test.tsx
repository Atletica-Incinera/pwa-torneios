import { beforeEach, describe, expect, it } from 'vitest';
import { AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { seededFrontendState, storageKey, type FrontendState } from '../../app/lib/frontend-state';
import { applyAction } from '../../app/lib/repositories/reducer';
import { createLocalStateAdapter } from '../../app/lib/repositories/local-adapter';
import { createHttpStateAdapter } from '../../app/lib/repositories/http-adapter';
import type { Action } from '../../app/lib/repositories/actions';
import type { StateAdapter } from '../../app/lib/repositories/state-adapter';

function apiResponse<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<{ data: T }> {
  return { data: { data }, status, statusText: status >= 400 ? 'Erro' : 'OK', headers: new AxiosHeaders(), config };
}

/**
 * Servidor de mentira que roda o mesmo reducer do cliente — é exatamente o que
 * o backend fará. Se os dois adaptadores divergirem para a mesma sequência de
 * ações, a troca de origem quebraria as telas.
 */
function createFakeApi(initial: FrontendState) {
  let snapshot = initial;
  const adapter: AxiosAdapter = async (config) => {
    const url = config.url ?? '';
    if (url.endsWith('/snapshot')) return apiResponse(config, snapshot);
    if (url.endsWith('/actions')) {
      const action = (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) as Action;
      snapshot = applyAction(snapshot, action, { actor: 'Ana Coordenadora' });
      return apiResponse(config, snapshot);
    }
    return apiResponse(config, null, 404);
  };
  return { adapter };
}

const sequence: Action[] = [
  { type: 'team/create', payload: { id: 'aurora', team: { name: 'Aurora', initials: 'AUR', created: true } }, audit: { action: 'Equipe cadastrada', entity: 'Aurora' } },
  { type: 'athlete/create', payload: { id: 'atleta-1', athlete: { name: 'Nina', teamId: 'aurora', modalities: ['Futsal'], created: true } }, audit: { action: 'Atleta cadastrado', entity: 'Nina' } },
  { type: 'match/update', payload: { id: 'semifinal-1', patch: { venue: 'Ginásio 2' } }, audit: { action: 'Partida remarcada', entity: 'Alcateia × Cangaceiros' } },
  { type: 'ranking/addAwards', payload: { awards: [{ id: 'award-1', editionId: 'intereng-2026', teamId: 'aurora', discipline: 'Futsal', metricId: 'metric-champion', points: 10, createdAt: '2026-10-20T12:00:00.000Z', origin: 'manual' }] } },
];

/**
 * O que precisa bater entre as origens é o estado. Id, horário e autor do
 * registro de auditoria são carimbados por quem aplica a ação — no navegador
 * pela sessão local, no servidor pelo token — e por isso saem da comparação.
 */
function comparable(state: FrontendState) {
  return JSON.stringify({ ...state, audit: state.audit.map((entry) => ({ ...entry, id: '', at: '', actor: '' })) });
}

async function run(adapter: StateAdapter) {
  let state = await adapter.load();
  for (const action of sequence) state = await adapter.apply(action);
  return state;
}

describe('contrato entre as origens de dados', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('local e HTTP produzem o mesmo estado para a mesma sequência de ações', async () => {
    const { adapter } = createFakeApi(seededFrontendState);

    const local = await run(createLocalStateAdapter());
    const remote = await run(createHttpStateAdapter({ adapter, getToken: () => 'token-de-teste' }));

    expect(comparable(remote)).toBe(comparable(local));
  });

  it('o adaptador local grava o resultado, e o HTTP confia na resposta do servidor', async () => {
    const { adapter } = createFakeApi(seededFrontendState);
    const action = sequence[0];

    await createLocalStateAdapter().apply(action);
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '{}').teams?.aurora?.name).toBe('Aurora');

    window.localStorage.clear();
    const remote = await createHttpStateAdapter({ adapter }).apply(action);
    expect(remote.teams.aurora?.name).toBe('Aurora');
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });
});
