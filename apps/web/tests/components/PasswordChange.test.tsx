import { beforeEach, describe, expect, it } from 'vitest';
import { AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { AuthError, type FrontendSession } from '../../app/lib/repositories/auth-adapter';
import { createHttpAuthAdapter } from '../../app/lib/repositories/http-auth-adapter';
import { readStoredSession, writeStoredSession } from '../../app/lib/repositories/session-storage';

function apiResponse<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<{ data: T }> {
  return { data: { data }, status, statusText: status >= 400 ? 'Erro' : 'OK', headers: new AxiosHeaders(), config };
}

const pendingSession: FrontendSession = {
  id: 'staff-nova',
  email: 'nova@ufpe.br',
  name: 'Nova Convidada',
  role: 'EDITION_ADMIN',
  editionRoles: [],
  mustChangePassword: true,
  remembered: false,
  token: 'token-inicial',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

/** A API real recusa a senha atual errada com 401 e aceita a troca com 200. */
function createFakeApi(senhaAtual: string) {
  const calls: Array<{ url: string; body: unknown; token?: string }> = [];
  const adapter: AxiosAdapter = async (config) => {
    const url = config.url ?? '';
    const body = (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) as { currentPassword?: string };
    calls.push({ url, body, token: config.headers?.Authorization as string | undefined });
    if (!url.endsWith('/auth/change-password')) return apiResponse(config, null, 404);
    if (body?.currentPassword !== senhaAtual) {
      throw Object.assign(new Error('401'), { isAxiosError: true, response: apiResponse(config, null, 401), config });
    }
    return apiResponse(config, {
      token: 'token-depois-da-troca',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { ...pendingSession, mustChangePassword: false },
    });
  };
  return { adapter, calls };
}

describe('troca de senha pela API', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    writeStoredSession(pendingSession);
  });

  it('guarda a sessão nova e apaga a exigência de troca', async () => {
    const { adapter, calls } = createFakeApi('intereng2026');

    const session = await createHttpAuthAdapter(adapter).changePassword('intereng2026', 'senhaEscolhida1');

    expect(session.mustChangePassword).toBe(false);
    expect(session.token).toBe('token-depois-da-troca');
    expect(calls[0]?.body).toEqual({ currentPassword: 'intereng2026', newPassword: 'senhaEscolhida1' });
    // O servidor revoga a sessão anterior: seguir com o token velho em mãos
    // derrubaria a pessoa no login logo depois de trocar a senha.
    expect(readStoredSession()?.token).toBe('token-depois-da-troca');
  });

  it('trata senha atual errada como erro de formulário, sem derrubar a sessão', async () => {
    const { adapter } = createFakeApi('intereng2026');

    await expect(
      createHttpAuthAdapter(adapter).changePassword('chutei', 'senhaEscolhida1'),
    ).rejects.toBeInstanceOf(AuthError);
    // Continua valendo: um 401 aqui é senha errada, não sessão vencida.
    expect(readStoredSession()?.token).toBe('token-inicial');
    expect(readStoredSession()?.mustChangePassword).toBe(true);
  });

  it('preserva a exigência de troca ao reler a sessão guardada', () => {
    // A releitura remonta a sessão campo a campo: um campo esquecido lá some na
    // primeira renderização e a exigência deixaria de valer.
    expect(readStoredSession()?.mustChangePassword).toBe(true);
  });
});

describe('leitura pública com conta pendente de troca de senha', () => {
  it('readSessionToken devolve null enquanto mustChangePassword estiver ligado', async () => {
    const { readSessionToken } = await import('../../app/lib/repositories/session-storage');
    writeStoredSession(pendingSession);

    // É o que faz /public/* cair no snapshot público em vez do privado: o
    // state-adapter decide pelo retorno desta função, e /public não passa
    // pelo AdminRouteGuard que intercepta as rotas privadas.
    expect(readSessionToken()).toBeNull();
  });

  it('volta a devolver o token assim que a senha é trocada', async () => {
    const { readSessionToken } = await import('../../app/lib/repositories/session-storage');
    writeStoredSession({ ...pendingSession, mustChangePassword: false });

    expect(readSessionToken()).toBe('token-inicial');
  });
});
