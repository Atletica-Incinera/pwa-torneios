export type FrontendRole =
  | 'SUPER_ADMIN'
  | 'EDITION_ADMIN'
  | 'DISCIPLINE_MANAGER'
  /** Responsável de atlética: alcança uma equipe só, e nela apenas o elenco. */
  | 'TEAM_MANAGER';

export type FrontendEditionRole = {
  roleAssignmentId: string;
  editionId: string;
  editionName: string;
  editionDisciplineId: string | null;
  disciplineId: string | null;
  disciplineName: string | null;
  teamId: string | null;
  teamName: string | null;
  role: Exclude<FrontendRole, 'SUPER_ADMIN'>;
};

export type FrontendSessionUser = {
  id: string;
  email: string;
  name: string;
  role: FrontendRole;
  scope?: string;
  editionRoles: FrontendEditionRole[];
  selectedRoleAssignmentId?: string;
  selectedEditionId?: string;
  selectedEditionDisciplineId?: string;
  /**
   * A conta ainda está com a senha inicial — a do convite, igual para todos os
   * convidados, ou a que veio do ambiente no primeiro super administrador. Com
   * ela ligada a API recusa tudo menos a troca, então o app leva direto para lá.
   */
  mustChangePassword?: boolean;
};

export type AuthSessionResponse = {
  token: string;
  expiresAt: string;
  user: Omit<FrontendSessionUser, 'editionRoles'> & {
    editionRoles?: FrontendEditionRole[];
  };
};

/**
 * Converte a identidade emitida pela API para o contexto ativo da interface.
 * `role` e `scope` continuam existindo para as telas legadas, mas a lista
 * completa preserva todos os papéis que podem ser selecionados nesta sessão.
 */
export function normalizeSessionUser(
  user: AuthSessionResponse['user'],
  previous?: FrontendSession | null,
): FrontendSessionUser {
  const editionRoles = Array.isArray(user.editionRoles) ? user.editionRoles : [];
  // Super admin é flag global da conta, não uma atribuição de edição — e não
  // pode ser rebaixado por uma. Quem já era Admin da edição e foi promovido
  // continuava com a atribuição antiga fixada em `selectedRoleAssignmentId`, e
  // ela vencia o SUPER_ADMIN vindo da API a cada renovação: no navegador a
  // pessoa seguia como EDITION_ADMIN até um logout completo, sem nada dizer.
  // Os recortes vão zerados junto: para super admin eles são preferência de
  // visualização, não papel.
  if (user.role === 'SUPER_ADMIN') {
    return {
      ...user,
      editionRoles,
      mustChangePassword: user.mustChangePassword === true,
      role: 'SUPER_ADMIN',
      scope: undefined,
      selectedRoleAssignmentId: undefined,
      selectedEditionId: undefined,
      selectedEditionDisciplineId: undefined,
    };
  }
  const requestedRoleAssignmentId = previous?.selectedRoleAssignmentId
    ?? user.selectedRoleAssignmentId;
  const requestedRole = requestedRoleAssignmentId
    ? editionRoles.find((role) => role.roleAssignmentId === requestedRoleAssignmentId)
    : undefined;
  const matchingLegacyRole = user.role === 'DISCIPLINE_MANAGER'
    ? editionRoles.find((role) => role.role === 'DISCIPLINE_MANAGER' && role.disciplineName === user.scope)
    : editionRoles.find((role) => role.role === user.role);
  const selectedRole = requestedRole
    ?? matchingLegacyRole
    ?? editionRoles.find((role) => role.role === user.role);

  return {
    ...user,
    editionRoles,
    mustChangePassword: user.mustChangePassword === true,
    role: selectedRole?.role ?? user.role,
    scope: selectedRole?.role === 'DISCIPLINE_MANAGER'
      ? selectedRole.disciplineName ?? user.scope
      : undefined,
    selectedRoleAssignmentId: selectedRole?.roleAssignmentId,
    selectedEditionId: selectedRole?.editionId
      ?? previous?.selectedEditionId
      ?? user.selectedEditionId,
    selectedEditionDisciplineId: selectedRole?.role === 'DISCIPLINE_MANAGER'
      ? selectedRole.editionDisciplineId ?? undefined
      : undefined,
  };
}

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
  /**
   * Troca a senha da própria conta e devolve a sessão que substitui a atual — o
   * servidor revoga todas as anteriores, então continuar com a antiga em mãos
   * significaria cair no login no próximo request.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<FrontendSession>;
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
