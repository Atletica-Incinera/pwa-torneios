import type { StaffRole } from '@atletica-incinera/intereng-contract/rules';

/** O papel da sessão é o do contrato: o servidor emite exatamente estes. */
export type FrontendRole = StaffRole;

/**
 * Quem está usando o app. `token` e `expiresAt` existem desde já: no adaptador
 * local são emitidos aqui mesmo; no HTTP virão do servidor, sem mudar as telas.
 */
export type FrontendSession = {
  email: string;
  name: string;
  role: FrontendRole;
  scope?: string;
  remembered: boolean;
  token: string;
  /**
   * Horizonte da **sessão**, não do token de acesso.
   *
   * A API emite acesso curto (minutos) com renovação longa (dias). Se este
   * campo guardasse o prazo do acesso, `restore()` expulsaria quem está
   * trabalhando a cada renovação.
   */
  expiresAt: string;
  /** Prazo do token de acesso, quando o servidor informa. */
  accessExpiresAt?: string;
  /** Credencial de renovação. Viaja no corpo — cookie não atravessa origem. */
  refreshToken?: string;
};

/**
 * O que o login (ou a renovação) devolve.
 *
 * Tolerante de propósito: o mock do contrato responde `{token, expiresAt, user}`
 * e a API responde `{accessToken, expiresIn, staff}`. Um mapeador só serve aos
 * dois, e o dia em que a API adotar o formato do contrato nada aqui muda.
 */
export type LoginPayload = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  accessExpiresAt?: string;
  expiresIn?: number;
  user?: { email: string; name: string; role: FrontendRole; scope?: string };
  staff?: { email: string; name: string; role?: FrontendRole; scope?: string };
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

/**
 * Traduz a resposta de login/renovação para a sessão que o app guarda.
 *
 * Recusa entrar sem papel em vez de adivinhar um: na API o papel é por edição,
 * e a guarda de navegação decide a rota antes de qualquer snapshot carregar.
 * Chutar aqui seria conceder acesso que o servidor vai negar depois.
 */
export function sessionFromLogin(payload: LoginPayload, remembered: boolean): FrontendSession {
  const token = payload.token ?? payload.accessToken;
  const user = payload.user ?? payload.staff;
  if (!token) throw new AuthError('A API não devolveu um token de acesso.');
  if (!user?.role) throw new AuthError('A API não informou o papel do usuário nesta edição.');
  return {
    email: user.email,
    name: user.name,
    role: user.role,
    scope: user.scope,
    remembered,
    token,
    refreshToken: payload.refreshToken,
    accessExpiresAt: payload.accessExpiresAt ?? (payload.expiresIn ? new Date(Date.now() + payload.expiresIn * 1000).toISOString() : undefined),
    expiresAt: payload.expiresAt ?? new Date(Date.now() + sessionDurationMs).toISOString(),
  };
}
