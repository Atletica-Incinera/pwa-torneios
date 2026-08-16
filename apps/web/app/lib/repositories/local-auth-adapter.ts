import { readFrontendState } from '../browser-state.ts';
import { createId, roleFromStaffLabel } from '@atletica-incinera/intereng-contract/rules';
import { demoUsers } from '@atletica-incinera/intereng-contract/seed';
import { AuthError, sessionDurationMs, type AuthAdapter, type FrontendSession } from './auth-adapter.ts';
import { clearStoredSession, readStoredSession, writeStoredSession } from './session-storage.ts';

export { demoUsers };

/**
 * Autenticação no próprio navegador: acessos de demonstração e quem foi
 * convidado ao staff da edição. É o que os e2e usam depois que o HTTP existir.
 */
export function createLocalAuthAdapter(): AuthAdapter {
  return {
    async signIn(email, password, remembered) {
      const normalized = email.trim().toLowerCase();
      const state = readFrontendState();
      const stored = state.staff[normalized];
      if (stored?.revoked) throw new AuthError('Este acesso foi revogado pelo administrador da edição.');
      const demo = demoUsers.find((user) => user.email === normalized && user.password === password.trim());
      const invited = stored && password === 'intereng2026'
        ? { email: normalized, name: stored.name, role: roleFromStaffLabel(stored.role), scope: stored.scope }
        : undefined;
      const user = demo ?? invited;
      if (!user) throw new AuthError('E-mail ou senha inválidos.');
      const session: FrontendSession = {
        email: user.email,
        name: user.name,
        role: user.role,
        scope: user.scope,
        remembered,
        token: createId('local-token'),
        expiresAt: new Date(Date.now() + sessionDurationMs).toISOString(),
      };
      writeStoredSession(session);
      return session;
    },

    async signOut() {
      clearStoredSession();
    },

    async restore() {
      const session = readStoredSession();
      if (!session) return null;
      // Vencida não vale, mas continua gravada: é assim que toda tela aberta
      // concorda que a sessão expirou, em vez de a primeira apagar o registro e
      // as outras concluírem que nunca houve login. O próximo login sobrescreve.
      return Date.parse(session.expiresAt) > Date.now() ? session : null;
    },
  };
}
