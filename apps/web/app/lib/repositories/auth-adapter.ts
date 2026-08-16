export type FrontendRole = 'SUPER_ADMIN' | 'EDITION_ADMIN' | 'DISCIPLINE_MANAGER';

export type FrontendSessionUser = {
  id: string;
  email: string;
  name: string;
  role: FrontendRole;
  scope?: string;
};

export type AuthSessionResponse = {
  token: string;
  expiresAt: string;
  user: FrontendSessionUser;
};

/**
 * Quem está usando o app. `token` e `expiresAt` existem desde já: no adaptador
 * local são emitidos aqui mesmo; no HTTP virão do servidor, sem mudar as telas.
 */
export type FrontendSession = FrontendSessionUser & {
  remembered: boolean;
  token: string;
  expiresAt: string;
};

/**
 * A fronteira da autenticação.
 *
 * Hoje quem confere a senha é o próprio navegador, contra a lista de acessos da
 * edição. Quando o backend entrar, a implementação HTTP satisfaz esta mesma
 * interface — o token deixa de ser local e passa a vir do servidor, e nenhuma
 * tela precisa saber a diferença.
 */
export type AuthAdapter = {
  /** Devolve a sessão ou lança com a mensagem que a tela de login exibe. */
  signIn(email: string, password: string, remembered: boolean): Promise<FrontendSession>;
  signOut(): Promise<void>;
  /** Sessão guardada, ou `null` quando não existe ou já expirou. */
  restore(): Promise<FrontendSession | null>;
};

/** Erro de credencial: a tela de login mostra a mensagem como está. */
export class AuthError extends Error {}

/** Sessão vencida ou recusada pelo servidor: leva de volta ao login. */
export class UnauthorizedError extends Error {
  constructor(message = 'Sua sessão expirou. Entre novamente.') {
    super(message);
  }
}

/** Quanto tempo uma sessão vale sem novo login. */
export const sessionDurationMs = 12 * 60 * 60 * 1000;
