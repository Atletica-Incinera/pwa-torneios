import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seededFrontendState, type FrontendState, type MatchState } from '@atletica-incinera/intereng-contract/state';
import { applyAction, type Action } from '@atletica-incinera/intereng-contract/actions';
import { FrontendStateProvider } from '../../app/lib/repositories/frontend-state-provider';
import { UiProvider } from '../../app/components/UiProvider';
import { MatchManager } from '../../app/components/MatchManager';
import { clearFrontendSession, signIn } from '../../app/lib/frontend-session';
import type { StateAdapter } from '../../app/lib/repositories/state-adapter';

// A tela intercepta clique em link para avisar de alteração não salva, e para
// isso pede o roteador do Next — que não existe fora do App Router.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));

const partida = { id: 'semifinal-1', discipline: 'Futsal', entryA: 'Alcateia', entryB: 'Cangaceiros', date: '2026-10-13', time: '20:00', venue: 'Ginásio CIn', status: 'Agendada' };

/** O snapshot da edição com esta partida agendada dentro da janela de 2026. */
function edicaoCom(patch: Partial<MatchState> = {}): FrontendState {
  return {
    ...seededFrontendState,
    matches: {
      ...seededFrontendState.matches,
      [partida.id]: { ...seededFrontendState.matches[partida.id], date: partida.date, time: partida.time, venue: partida.venue, status: 'Agendada', ...patch },
    },
  };
}

/**
 * Adaptador com um gatilho de mudança remota na mão de quem testa: é assim que
 * se reproduz o outro operador remarcando a mesma partida.
 */
function criarCanal(inicial: FrontendState) {
  let snapshot = inicial;
  let emitir: (next: FrontendState) => void = () => {};
  const adapter: StateAdapter = {
    load: async () => snapshot,
    apply: async (action: Action) => { snapshot = applyAction(snapshot, action, { actor: 'Ana Coordenadora' }); return snapshot; },
    subscribe: (onRemoteChange) => { emitir = onRemoteChange; return () => {}; },
  };
  return {
    adapter,
    outroOperador: async (next: FrontendState) => { snapshot = next; await act(async () => { emitir(next); }); },
  };
}

async function montar() {
  const canal = criarCanal(edicaoCom());
  render(
    <UiProvider>
      <FrontendStateProvider adapter={canal.adapter}>
        <MatchManager match={partida} />
        <a href="/matches">Voltar à agenda</a>
      </FrontendStateProvider>
    </UiProvider>,
  );
  // A permissão depende da sessão restaurada: até lá a tela é a do sem acesso.
  const local = await screen.findByLabelText('Local') as HTMLInputElement;
  return { ...canal, local };
}

const localAtual = () => (screen.getByLabelText('Local') as HTMLInputElement).value;

describe('MatchManager diante de uma mudança remota', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await signIn('ana@ufpe.br', 'intereng2026', false);
  });
  afterEach(() => clearFrontendSession());

  it('rascunho intocado acompanha a remarcação de outro operador sem acusar alteração não salva', async () => {
    const canal = await montar();
    expect(canal.local.value).toBe('Ginásio CIn');

    await canal.outroOperador(edicaoCom({ venue: 'Ginásio Central', time: '21:00' }));

    expect(localAtual()).toBe('Ginásio Central');
    expect((screen.getByLabelText('Horário') as HTMLInputElement).value).toBe('21:00');
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();

    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Voltar à agenda' })); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('edição em andamento sobrevive à remarcação remota, e a tela avisa que o dado mudou', async () => {
    const canal = await montar();
    fireEvent.change(canal.local, { target: { value: 'Quadra Coberta' } });

    await canal.outroOperador(edicaoCom({ venue: 'Ginásio Central' }));

    expect(localAtual()).toBe('Quadra Coberta');
    expect(screen.getByText('Esta partida mudou enquanto você editava')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
  });

  it('quem digitou pode adotar o dado atual e aí o formulário deixa de estar sujo', async () => {
    const canal = await montar();
    fireEvent.change(canal.local, { target: { value: 'Quadra Coberta' } });
    await canal.outroOperador(edicaoCom({ venue: 'Ginásio Central' }));

    fireEvent.click(screen.getByRole('button', { name: 'Usar os dados atuais' }));

    expect(localAtual()).toBe('Ginásio Central');
    expect(screen.queryByText('Esta partida mudou enquanto você editava')).toBeNull();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
  });

  it('o diálogo de descarte só aparece quando existe mesmo algo digitado e não salvo', async () => {
    const canal = await montar();
    fireEvent.change(canal.local, { target: { value: 'Quadra Coberta' } });

    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Voltar à agenda' })); });

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('DESCARTAR ALTERAÇÕES?');
  });
});
