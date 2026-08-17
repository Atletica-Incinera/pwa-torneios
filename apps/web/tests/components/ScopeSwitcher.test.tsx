import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ScopeSwitcher } from '../../app/components/ScopeSwitcher';
import { scopeId, type FrontendSession, type SessionScope } from '../../app/lib/repositories/auth-adapter';
import { clearActiveScopeId } from '../../app/lib/repositories/active-scope';
import { clearStoredSession, readStoredSession, writeStoredSession } from '../../app/lib/repositories/session-storage';

/**
 * O seletor de acesso.
 *
 * É a única tela da troca de escopo, e o que ela não pode fazer é aparecer para
 * quem não tem para onde trocar: um botão que não leva a lugar nenhum sugere
 * que existe um acesso escondido.
 */
function escopo(role: SessionScope['role'], extras: Partial<SessionScope> = {}): SessionScope {
  const base = { role, ...extras };
  return { ...base, id: scopeId(base) };
}

const adminDe2025 = escopo('EDITION_ADMIN', { editionId: 'intereng-2025', editionName: 'InterEng 2025' });
const gestorDeFutsal = escopo('DISCIPLINE_MANAGER', { editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', discipline: 'Futsal' });

function sessao(scopes: SessionScope[]): FrontendSession {
  return { email: 'ana@ufpe.br', name: 'Ana Coordenadora', role: scopes[0].role, scopes, remembered: false, token: 'token', expiresAt: new Date(Date.now() + 60_000).toISOString() };
}

describe('seletor de acesso', () => {
  beforeEach(() => { clearStoredSession(); clearActiveScopeId(); });

  it('com um acesso só, mostra o papel e nenhum botão de troca', async () => {
    writeStoredSession(sessao([gestorDeFutsal]));
    render(<ScopeSwitcher />);

    expect(await screen.findByText('Gestor de Futsal')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('com dois acessos, oferece os dois e marca o que está em uso', async () => {
    writeStoredSession(sessao([adminDe2025, gestorDeFutsal]));
    render(<ScopeSwitcher />);

    const opcoes = await screen.findAllByRole('button');
    expect(opcoes).toHaveLength(2);
    expect(opcoes[0].getAttribute('aria-pressed')).toBe('true');
    expect(opcoes[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('escolher outro acesso troca o escopo em uso', async () => {
    writeStoredSession(sessao([adminDe2025, gestorDeFutsal]));
    render(<ScopeSwitcher />);
    const opcoes = await screen.findAllByRole('button');

    await act(async () => { fireEvent.click(opcoes[1]); });

    await waitFor(() => expect(readStoredSession()?.activeScopeId).toBe(gestorDeFutsal.id));
    await waitFor(() => expect(screen.getAllByRole('button')[1].getAttribute('aria-pressed')).toBe('true'));
    // A escolha é do aparelho: a sessão gravada não muda, só a derivação dela.
    expect(readStoredSession()?.role).toBe('DISCIPLINE_MANAGER');
  });

  it('sem edição nomeada pelo servidor, usa a edição que está na tela', async () => {
    // O adaptador local não tem id de edição nenhum, e um literal fixo aqui já
    // dizia "InterEng 2026" para quem estava vendo outra.
    writeStoredSession(sessao([escopo('EDITION_ADMIN')]));
    render(<ScopeSwitcher editionFallback="InterEng 2027" />);

    expect(await screen.findByText('InterEng 2027')).toBeTruthy();
  });
});
