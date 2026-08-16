import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seededFrontendState, type FrontendState } from '@atletica-incinera/intereng-contract/state';
import { applyAction, type Action } from '@atletica-incinera/intereng-contract/actions';
import { FrontendStateProvider } from '../../app/lib/repositories/frontend-state-provider';
import { useFrontendState } from '../../app/lib/repositories/browser-repository';
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

  it('o hook recusa montar fora do provider', () => {
    // O estado inicial não é vazio: fora do provider, um componente solto
    // renderizaria uma edição plausível e sem dados, sem nenhum aviso.
    expect(() => render(<Sonda onReady={() => {}} />)).toThrow(/FrontendStateProvider/);
  });
});
