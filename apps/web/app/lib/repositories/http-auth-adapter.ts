import { apiRequest } from './api-client.ts';
import { AuthError, UnauthorizedError, type AuthAdapter, type FrontendRole, type FrontendSession } from './auth-adapter.ts';
import { clearStoredSession, readStoredSession, writeStoredSession } from './session-storage.ts';

/** O que `POST /auth/login` devolve. O prazo e o papel são decididos lá. */
type LoginResponse = {
  token: string;
  expiresAt: string;
  user: { email: string; name: string; role: FrontendRole; scope?: string };
};

/**
 * Autenticação pela API.
 *
 * As funções `canManageEdition`, `canManageDiscipline` e companhia continuam
 * valendo como guarda de navegação, mas quem decide de verdade é o servidor:
 * aqui elas só evitam mostrar um caminho que terminaria em 403.
 */
export function createHttpAuthAdapter(fetchImpl?: typeof fetch): AuthAdapter {
  return {
    async signIn(email, password, remembered) {
      let payload: LoginResponse;
      try {
        payload = await apiRequest<LoginResponse>({
          path: '/auth/login',
          method: 'POST',
          body: { email: email.trim().toLowerCase(), password },
          fetchImpl,
        });
      } catch (caught) {
        // Credencial recusada chega como 401: é mensagem de login, não sessão vencida.
        if (caught instanceof UnauthorizedError) throw new AuthError('E-mail ou senha inválidos.');
        throw new AuthError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
      }
      const session: FrontendSession = { ...payload.user, remembered, token: payload.token, expiresAt: payload.expiresAt };
      writeStoredSession(session);
      return session;
    },

    async signOut() {
      const token = readStoredSession()?.token;
      // A sessão local sai de qualquer forma: o servidor pode estar inacessível.
      clearStoredSession();
      if (!token) return;
      try { await apiRequest({ path: '/auth/logout', method: 'POST', token, fetchImpl }); } catch { /* já saiu daqui */ }
    },

    async restore() {
      const session = readStoredSession();
      if (!session?.token) return null;
      // Vencida continua gravada, para todas as telas abertas concordarem que
      // expirou. Sair de verdade é o `signOut`, e o login novo sobrescreve.
      return Date.parse(session.expiresAt) > Date.now() ? session : null;
    },
  };
}
