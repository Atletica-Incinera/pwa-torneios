import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrontendSession } from '../../app/lib/repositories/auth-adapter';
import { clearStoredSession, expireStoredSession, writeStoredSession } from '../../app/lib/repositories/session-storage';
import { useFrontendSession } from '../../app/lib/frontend-session';

/**
 * Restaurações presas: quem testa decide a ordem em que elas resolvem. É o que
 * permite reproduzir a rajada de eventos de sessão sem depender de tempo.
 */
const pendentes = vi.hoisted(() => [] as Array<(session: unknown) => void>);

vi.mock('../../app/lib/repositories/local-auth-adapter', () => ({
  demoUsers: [],
  createLocalAuthAdapter: () => ({
    signIn: async () => { throw new Error('não usado neste teste'); },
    signOut: async () => {},
    restore: () => new Promise((resolve) => { pendentes.push(resolve); }),
  }),
}));

const base: FrontendSession = { email: 'ana@ufpe.br', name: 'Ana Coordenadora', role: 'EDITION_ADMIN', remembered: false, token: 'token-novo', expiresAt: '' };
const valida: FrontendSession = { ...base, expiresAt: new Date(Date.now() + 60_000).toISOString() };
const vencida: FrontendSession = { ...base, token: 'token-velho', expiresAt: new Date(Date.now() - 60_000).toISOString() };

/** Monta o hook e espera a primeira restauração ficar no ar. */
async function montar() {
  const { result } = renderHook(() => useFrontendSession());
  await waitFor(() => expect(pendentes).toHaveLength(1));
  return result;
}

describe('useFrontendSession sob rajada de eventos de sessão', () => {
  beforeEach(() => {
    pendentes.length = 0;
    clearStoredSession();
  });

  it('a restauração que leu o storage primeiro não desfaz a que leu depois', async () => {
    writeStoredSession(vencida);
    const result = await montar();

    // O login entra enquanto a primeira restauração ainda está no ar.
    act(() => { writeStoredSession(valida); });
    await waitFor(() => expect(pendentes).toHaveLength(2));

    // A segunda resolve antes; a primeira chega depois, com o retrato vencido.
    await act(async () => { pendentes[1](valida); });
    await act(async () => { pendentes[0](null); });

    expect(result.current.session?.token).toBe('token-novo');
    expect(result.current.expired).toBe(false);
  });

  it('a leitura anterior ao 401 não segura na tela uma sessão que o servidor já recusou', async () => {
    writeStoredSession(valida);
    const result = await montar();

    act(() => { expireStoredSession(); });
    await waitFor(() => expect(pendentes).toHaveLength(2));

    await act(async () => { pendentes[1](null); });
    await act(async () => { pendentes[0](valida); });

    expect(result.current.session).toBeNull();
    expect(result.current.expired).toBe(true);
  });
});
