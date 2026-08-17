import { apiRequest } from './api-client.ts';
import { AuthError, UnauthorizedError, sessionFromLogin, type AuthAdapter, type EditionRolePayload, type LoginPayload, type SessionUserPayload } from './auth-adapter.ts';
import { clearStoredSession, readStoredSession, writeStoredSession } from './session-storage.ts';

/**
 * Autenticação pela API.
 *
 * As funções `canManageEdition`, `canManageDiscipline` e companhia continuam
 * valendo como guarda de navegação, mas quem decide de verdade é o servidor:
 * aqui elas só evitam mostrar um caminho que terminaria em 403.
 */

/** `GET /auth/me`: quem entrou e todos os papéis dele, um por edição. */
type MePayload = { id?: string; name?: string; email?: string; isSuperAdmin?: boolean; editionRoles?: EditionRolePayload[] };

export function createHttpAuthAdapter(fetchImpl?: typeof fetch): AuthAdapter {
  return {
    async signIn(email, password, remembered) {
      let payload: LoginPayload;
      try {
        payload = await apiRequest<LoginPayload>({
          path: '/auth/login',
          method: 'POST',
          body: { email: email.trim().toLowerCase(), password },
          // Credencial errada não é sessão vencida: não tenta renovar.
          retryOnUnauthorized: false,
          fetchImpl,
        });
      } catch (caught) {
        // Credencial recusada chega como 401: é mensagem de login, não sessão vencida.
        if (caught instanceof UnauthorizedError) throw new AuthError('E-mail ou senha inválidos.');
        throw new AuthError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
      }
      /**
       * A entrada tem duas etapas porque a API tem duas.
       *
       * `POST /auth/login` devolve `staff: {id,name,email,isSuperAdmin}` e mais
       * nada — o papel na API é **por edição**, e quem o tem é `GET /auth/me`,
       * em `editionRoles`. Sem esta segunda chamada nenhum operador entra: o
       * mapeador recusa sessão sem papel, e recusa de propósito.
       */
      const recebido = payload.user ?? payload.staff;
      const me = await loadMe(payload.token ?? payload.accessToken, fetchImpl);
      if (!recebido?.role && !me.isSuperAdmin && !me.editionRoles?.length) {
        throw new AuthError('Sua conta entrou, mas não tem papel em nenhuma edição. Peça acesso ao administrador.');
      }
      const user: SessionUserPayload = {
        email: me.email ?? recebido?.email ?? email.trim().toLowerCase(),
        name: me.name ?? recebido?.name ?? email.trim().toLowerCase(),
        role: recebido?.role,
        scope: recebido?.scope,
        isSuperAdmin: me.isSuperAdmin ?? recebido?.isSuperAdmin,
      };
      const session = sessionFromLogin({ ...payload, user, editionRoles: me.editionRoles }, remembered);
      writeStoredSession(session);
      // A releitura aplica o escopo escolhido neste aparelho: quem chamou passa
      // a ver o mesmo que a guarda de rota verá no próximo render.
      return readStoredSession() ?? session;
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

/**
 * Os papéis de quem acabou de entrar.
 *
 * `retryOnUnauthorized: false` porque a sessão ainda não foi gravada: uma
 * renovação aqui usaria a credencial da sessão **anterior** e devolveria os
 * papéis de outra pessoa. E falhar aqui interrompe a entrada em vez de deixar
 * passar uma sessão sem papel — entrar sem saber o que se pode fazer termina
 * numa tela de administração que o servidor recusa a cada clique.
 */
async function loadMe(token: string | undefined, fetchImpl?: typeof fetch): Promise<MePayload> {
  try {
    return await apiRequest<MePayload>({ path: '/auth/me', token, retryOnUnauthorized: false, fetchImpl });
  } catch (caught) {
    throw new AuthError(caught instanceof Error && !(caught instanceof UnauthorizedError) ? caught.message : 'Entrada aceita, mas não foi possível ler seus acessos. Tente novamente.');
  }
}
