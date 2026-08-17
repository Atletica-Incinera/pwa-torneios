import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { seededFrontendState, type FrontendState } from '@atletica-incinera/intereng-contract/state';
import { applyAction, type Action } from '@atletica-incinera/intereng-contract/actions';
import { FrontendStateProvider } from '../../app/lib/repositories/frontend-state-provider';
import { useFrontendState } from '../../app/lib/repositories/browser-repository';
import { UiProvider } from '../../app/components/UiProvider';
import { scopeId, type FrontendSession, type SessionScope } from '../../app/lib/repositories/auth-adapter';
import { clearActiveScopeId, writeActiveScopeId } from '../../app/lib/repositories/active-scope';
import { clearStoredSession, expireStoredSession, readStoredSession, writeStoredSession } from '../../app/lib/repositories/session-storage';
import type { StateAdapter } from '../../app/lib/repositories/state-adapter';

/**
 * Adaptador de mentira com a carga **presa**: quem testa decide quando ela
 * responde. É o que permite reproduzir a ordem invertida sem depender de
 * tempo — uma busca disparada antes e entregue depois de uma escrita.
 */
function createSuspendedAdapter(initial: FrontendState) {
  let resolveLoad: (snapshot: FrontendState) => void = () => {};
  const loaded = new Promise<FrontendState>((resolve) => { resolveLoad = resolve; });
  let current = initial;

  const adapter: StateAdapter = {
    load: () => loaded,
    apply: async (action: Action) => {
      current = applyAction(current, action, { actor: 'Ana Coordenadora' });
      return current;
    },
    subscribe: () => () => {},
  };

  return { adapter, resolveLoad: (snapshot: FrontendState) => resolveLoad(snapshot) };
}

const criarAurora: Action = {
  type: 'team/create',
  payload: { id: 'aurora', team: { name: 'Aurora', initials: 'AUR', created: true } },
  audit: { action: 'Equipe cadastrada', entity: 'Aurora' },
};

function Sonda({ onReady }: { onReady: (value: ReturnType<typeof useFrontendState>) => void }) {
  const value = useFrontendState();
  onReady(value);
  return <p>equipes: {Object.keys(value.state.teams).length}</p>;
}

describe('provider de estado', () => {
  it('um snapshot antigo entregue depois de uma escrita não desfaz a escrita', async () => {
    const { adapter, resolveLoad } = createSuspendedAdapter(seededFrontendState);
    let api: ReturnType<typeof useFrontendState> | null = null;

    render(<FrontendStateProvider adapter={adapter}><Sonda onReady={(value) => { api = value; }} /></FrontendStateProvider>);
    await waitFor(() => expect(api).not.toBeNull());

    // A escrita completa primeiro e a tela passa a mostrar a equipe nova.
    const antes = Object.keys(seededFrontendState.teams).length;
    await api!.dispatch(criarAurora);
    await screen.findByText(`equipes: ${antes + 1}`);

    // Só agora a carga inicial responde, com o retrato de antes da escrita.
    resolveLoad(seededFrontendState);
    await new Promise((wait) => setTimeout(wait, 0));

    // O gol não pode sumir da tela porque uma busca velha chegou atrasada.
    expect(screen.getByText(`equipes: ${antes + 1}`)).toBeTruthy();
    expect(api!.state.teams.aurora?.name).toBe('Aurora');
  });

  it('a recusa do servidor chega ao operador com o texto que o servidor mandou', async () => {
    // O despachante da API responde 501 para a ação que ainda não existe lá, e
    // é esse texto — não um literal do app — que faz o operador parar de tentar.
    const recusa = 'Esta operação ainda não existe no servidor.';
    const adapter: StateAdapter = {
      load: async () => seededFrontendState,
      apply: async () => { throw new Error(recusa); },
      subscribe: () => () => {},
    };
    let api: ReturnType<typeof useFrontendState> | null = null;

    render(<UiProvider><FrontendStateProvider adapter={adapter}><Sonda onReady={(value) => { api = value; }} /></FrontendStateProvider></UiProvider>);
    await waitFor(() => expect(api).not.toBeNull());

    const saved = await api!.dispatch(criarAurora);
    expect(saved).toEqual({ ok: false, error: recusa });
    expect(await screen.findByText(recusa)).toBeTruthy();
  });

  it('o hook recusa montar fora do provider', () => {
    // O estado inicial não é vazio: fora do provider, um componente solto
    // renderizaria uma edição plausível e sem dados, sem nenhum aviso.
    expect(() => render(<Sonda onReady={() => {}} />)).toThrow(/FrontendStateProvider/);
  });
});

/** Anota o token em vigor a cada carga: é o que prova de quem é o retrato. */
function createCountingAdapter(snapshot: FrontendState) {
  const cargas: Array<string | null> = [];
  const adapter: StateAdapter = {
    load: async () => { cargas.push(readStoredSession()?.token ?? null); return snapshot; },
    apply: async () => snapshot,
    subscribe: () => () => {},
  };
  return { adapter, cargas };
}

const operadora: FrontendSession = {
  email: 'ana@ufpe.br',
  name: 'Ana Coordenadora',
  role: 'EDITION_ADMIN',
  remembered: false,
  token: 'token-da-ana',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

/** Deixa a fila de microtarefas e os timers vencerem antes de conferir. */
async function assentar() {
  await act(async () => { await new Promise((pronto) => setTimeout(pronto, 0)); });
}

describe('provider e a troca de sessão', () => {
  beforeEach(() => { clearStoredSession(); clearActiveScopeId(); });

  it('entrar e sair recarregam o estado', async () => {
    // O provider vive no layout raiz, que não remonta na navegação: sem isto o
    // snapshot público carregado no login sobreviveria ao login, e o operador
    // veria a visão do espectador — sem staff, sem auditoria e sem rascunho.
    const { adapter, cargas } = createCountingAdapter(seededFrontendState);
    render(<FrontendStateProvider adapter={adapter}><Sonda onReady={() => {}} /></FrontendStateProvider>);
    await waitFor(() => expect(cargas).toHaveLength(1));

    act(() => { writeStoredSession(operadora); });
    await waitFor(() => expect(cargas).toHaveLength(2));

    act(() => { clearStoredSession(); });
    await waitFor(() => expect(cargas).toHaveLength(3));

    expect(cargas).toEqual([null, 'token-da-ana', null]);
  });

  it('vencer a sessão não recarrega, para não pedir outro 401', async () => {
    // Vencer emite o mesmo evento preservando o token. Recarregar ali levaria a
    // outro 401, que venceria de novo, sem fim.
    writeStoredSession(operadora);
    const { adapter, cargas } = createCountingAdapter(seededFrontendState);
    render(<FrontendStateProvider adapter={adapter}><Sonda onReady={() => {}} /></FrontendStateProvider>);
    await waitFor(() => expect(cargas).toHaveLength(1));

    act(() => { expireStoredSession(); });
    await assentar();

    expect(cargas).toEqual(['token-da-ana']);
    expect(readStoredSession()?.token).toBe('token-da-ana');
  });

  it('trocar de escopo recarrega: a permissão muda, e os dados precisam mudar junto', async () => {
    // Quem é admin de uma edição e gestor de outra troca de acesso esperando
    // ver a edição daquele papel. Sem recarregar, a tela passaria a oferecer
    // administração sobre a edição que continuou aberta.
    const admin: SessionScope = { ...{ role: 'EDITION_ADMIN' as const, editionId: 'intereng-2025' }, id: scopeId({ role: 'EDITION_ADMIN', editionId: 'intereng-2025' }) };
    const gestor: SessionScope = { ...{ role: 'DISCIPLINE_MANAGER' as const, editionId: 'intereng-2026', discipline: 'Futsal' }, id: scopeId({ role: 'DISCIPLINE_MANAGER', editionId: 'intereng-2026', discipline: 'Futsal' }) };
    writeStoredSession({ ...operadora, scopes: [admin, gestor] });
    const { adapter, cargas } = createCountingAdapter(seededFrontendState);
    render(<FrontendStateProvider adapter={adapter}><Sonda onReady={() => {}} /></FrontendStateProvider>);
    await waitFor(() => expect(cargas).toHaveLength(1));

    act(() => { writeActiveScopeId(gestor.id); });
    await waitFor(() => expect(cargas).toHaveLength(2));

    // Escolher de novo o mesmo escopo não recarrega: o gatilho é a identidade
    // ter mudado, não o evento ter chegado — é o que impede o laço.
    act(() => { writeActiveScopeId(gestor.id); });
    await assentar();
    expect(cargas).toHaveLength(2);
  });
});

describe('provider quando a carga falha', () => {
  it('a falha vira erro na tela com o texto do servidor, e a nova tentativa recompõe', async () => {
    const recusa = 'O servidor não devolveu o snapshot da edição.';
    let falhando = true;
    const adapter: StateAdapter = {
      load: async () => { if (falhando) throw new Error(recusa); return seededFrontendState; },
      apply: async () => seededFrontendState,
      subscribe: () => () => {},
    };
    let api: ReturnType<typeof useFrontendState> | null = null;

    render(<FrontendStateProvider adapter={adapter}><Sonda onReady={(value) => { api = value; }} /></FrontendStateProvider>);
    await waitFor(() => expect(api?.status).toBe('error'));

    expect(api!.error).toBe(recusa);
    // `hydrated` é o que as telas usam para decidir entre carregar e mostrar:
    // em erro ele precisa ser falso, senão a tela se dá por pronta com o estado
    // inicial, que traz competição e edições e parece uma edição de verdade.
    expect(api!.hydrated).toBe(false);

    falhando = false;
    await act(async () => { await api!.refresh(); });

    expect(api!.status).toBe('ready');
    expect(api!.error).toBeNull();
    expect(api!.hydrated).toBe(true);
    expect(Object.keys(api!.state.teams)).toEqual(Object.keys(seededFrontendState.teams));
  });

  it('uma falha depois de um estado bom não apaga o que já estava na tela', async () => {
    // A tela de erro tem botão de nova tentativa; o que estava carregado precisa
    // continuar visível atrás dela em vez de virar a edição inicial vazia.
    let falhando = false;
    const adapter: StateAdapter = {
      load: async () => { if (falhando) throw new Error('Falha na requisição (502).'); return seededFrontendState; },
      apply: async () => seededFrontendState,
      subscribe: () => () => {},
    };
    let api: ReturnType<typeof useFrontendState> | null = null;

    render(<FrontendStateProvider adapter={adapter}><Sonda onReady={(value) => { api = value; }} /></FrontendStateProvider>);
    await waitFor(() => expect(api?.status).toBe('ready'));

    falhando = true;
    await act(async () => { await api!.refresh(); });

    expect(api!.status).toBe('error');
    expect(Object.keys(api!.state.teams)).toEqual(Object.keys(seededFrontendState.teams));
  });
});
