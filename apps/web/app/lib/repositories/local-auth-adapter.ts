import { readFrontendState } from '../frontend-state.ts';
import { createId } from '../create-id.ts';
import { AuthError, sessionDurationMs, type AuthAdapter, type FrontendSession } from './auth-adapter.ts';
import { clearStoredSession, readStoredSession, writeStoredSession } from './session-storage.ts';

/** Acessos de demonstração enquanto a autenticação não vem do servidor. */
export const demoUsers = [
  { email: 'super@intereng.com', password: 'super2026', name: 'Super Admin', role: 'SUPER_ADMIN' as const },
  { email: 'ana@ufpe.br', password: 'intereng2026', name: 'Ana Coordenadora', role: 'EDITION_ADMIN' as const },
  { email: 'bruno@ufpe.br', password: 'futsal2026', name: 'Bruno Martins', role: 'DISCIPLINE_MANAGER' as const, scope: 'Futsal' },
];

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
        ? { email: normalized, name: stored.name, role: stored.role === 'Admin da edição' ? 'EDITION_ADMIN' as const : 'DISCIPLINE_MANAGER' as const, scope: stored.scope }
        : undefined;
      const user = demo ?? invited;
      if (!user) throw new AuthError('E-mail ou senha inválidos.');
      const session: FrontendSession = {
        id: `local:${user.email}`,
        email: user.email,
        name: user.name,
        role: user.role,
        scope: 'scope' in user ? user.scope : undefined,
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
