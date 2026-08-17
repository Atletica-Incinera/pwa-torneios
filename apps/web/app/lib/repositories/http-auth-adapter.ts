import type { AxiosAdapter } from 'axios';
import { apiRequest, cancelPendingSessionRefresh, refreshApiSession } from './api-client.ts';
import { AuthError, normalizeSessionUser, UnauthorizedError, type AuthAdapter, type AuthSessionResponse, type FrontendSession } from './auth-adapter.ts';
import { clearStoredSession, readStoredSession, writeStoredSession } from './session-storage.ts';

/**
 * Autenticação pela API.
 *
 * As funções `canManageEdition`, `canManageDiscipline` e companhia continuam
 * valendo como guarda de navegação, mas quem decide de verdade é o servidor:
 * aqui elas só evitam mostrar um caminho que terminaria em 403.
 */
export function createHttpAuthAdapter(adapter?: AxiosAdapter): AuthAdapter {
  return {
    async signIn(email, password, remembered) {
      let payload: AuthSessionResponse;
      try {
        payload = await apiRequest<AuthSessionResponse>({
          path: '/auth/login',
          method: 'POST',
          body: { email: email.trim().toLowerCase(), password },
          adapter,
          skipAuthRefresh: true,
        });
      } catch (caught) {
        // Credencial recusada chega como 401: é mensagem de login, não sessão vencida.
        if (caught instanceof UnauthorizedError) throw new AuthError('E-mail ou senha inválidos.');
        throw new AuthError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
      }
      const session: FrontendSession = {
        ...normalizeSessionUser(payload.user),
        remembered,
        token: payload.token,
        expiresAt: payload.expiresAt,
      };
      writeStoredSession(session);
      return session;
    },

    async signOut() {
      const token = readStoredSession()?.token;
      // A sessão local sai de qualquer forma: o servidor pode estar inacessível.
      cancelPendingSessionRefresh();
      clearStoredSession();
      try {
        await apiRequest({ path: '/auth/logout', method: 'POST', token, adapter, skipAuthRefresh: true });
      } catch { /* já saiu daqui */ }
    },

    async restore() {
      const session = readStoredSession();
      if (!session?.token) return null;
      if (Date.parse(session.expiresAt) > Date.now()) {
        if (session.role === 'SUPER_ADMIN' || session.editionRoles.length) return session;
        try {
          const user = await apiRequest<AuthSessionResponse['user']>({
            path: '/auth/me',
            token: session.token,
            adapter,
            skipAuthRefresh: true,
          });
          const hydrated: FrontendSession = {
            ...normalizeSessionUser(user, session),
            remembered: session.remembered,
            token: session.token,
            expiresAt: session.expiresAt,
          };
          writeStoredSession(hydrated);
          return hydrated;
        } catch {
          return null;
        }
      }
      try { return await refreshApiSession(adapter); } catch { return null; }
    },
  };
}
