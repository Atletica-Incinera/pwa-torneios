import type { StaffRole } from '@atletica-incinera/intereng-contract/rules';

/** O papel da sessão é o do contrato: o servidor emite exatamente estes. */
export type FrontendRole = StaffRole;

/**
 * Um papel do usuário e onde ele vale.
 *
 * Na API o papel é por edição: `GET /auth/me` devolve uma lista plana, um item
 * por registro de staff, e o mesmo usuário pode ser admin de uma edição e
 * gestor de uma modalidade de outra. Guardar um par papel/escopo obrigava a
 * eleger um deles na entrada e esconder o resto — quem tinha dois acessos
 * entrava sempre no mesmo, sem saber que havia outro.
 */
export type SessionScope = {
  /**
   * Chave estável entre logins e entre aparelhos.
   *
   * É ela que a escolha do aparelho grava, então não pode depender da ordem em
   * que o servidor devolveu os papéis nem de um id de sessão: no login seguinte
   * a mesma pessoa precisa reencontrar o escopo que escolheu.
   */
  id: string;
  role: FrontendRole;
  /** Edição onde o papel vale. Ausente no super admin, que vale em todas. */
  editionId?: string;
  editionName?: string;
  /** Modalidade do gestor, pelo nome — é por nome que as telas comparam. */
  discipline?: string;
  disciplineId?: string;
};

/**
 * Quem está usando o app. `token` e `expiresAt` existem desde já: no adaptador
 * local são emitidos aqui mesmo; no HTTP vêm do servidor, sem mudar as telas.
 */
export type FrontendSession = {
  email: string;
  name: string;
  /**
   * Papel do **escopo ativo**.
   *
   * Derivado: a verdade é `scopes`. O campo continua existindo porque é ele que
   * os cinco predicados de permissão comparam, e eles são a autorização do app
   * inteiro — trocá-los por uma busca na lista seria reescrever a autorização
   * junto com o multi-escopo, duas mudanças de risco numa só.
   */
  role: FrontendRole;
  /** Modalidade — ou edição, para quem administra — do escopo ativo. Derivado. */
  scope?: string;
  /**
   * Todos os papéis do usuário.
   *
   * Opcional de propósito: sessão gravada antes de a lista existir continua
   * valendo, e `sessionScopes` a reconstrói do par `role`/`scope`. Uma versão
   * nova do app não expulsa quem já estava dentro.
   */
  scopes?: SessionScope[];
  /** Escopo em vigor neste aparelho, dentre `scopes`. Derivado na leitura. */
  activeScopeId?: string;
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

/** Um papel por edição, como `GET /auth/me` o devolve. */
export type EditionRolePayload = {
  editionId: string;
  editionName?: string;
  disciplineId?: string | null;
  disciplineName?: string | null;
  role: 'EDITION_ADMIN' | 'DISCIPLINE_MANAGER';
};

/** Quem entrou, no formato do contrato (`user`) ou no da API (`staff`). */
export type SessionUserPayload = {
  email: string;
  name: string;
  role?: FrontendRole;
  scope?: string;
  /** Só a API informa; é o único escopo global que existe. */
  isSuperAdmin?: boolean;
  /** A renovação reinjeta a sessão guardada, e com ela a lista já montada. */
  scopes?: SessionScope[];
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
  user?: SessionUserPayload;
  staff?: SessionUserPayload;
  /**
   * Os papéis por edição. O login da API **não** os devolve: quem os tem é
   * `GET /auth/me`, e é o adaptador HTTP que junta as duas respostas antes de
   * chamar o mapeador.
   */
  editionRoles?: EditionRolePayload[];
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

/** Quanto mais amplo o papel, mais cedo o escopo aparece na lista. */
const scopeBreadth: Record<FrontendRole, number> = { SUPER_ADMIN: 0, EDITION_ADMIN: 1, DISCIPLINE_MANAGER: 2 };

/**
 * A chave do escopo.
 *
 * Edição mais modalidade, com o id do servidor quando ele existe e o nome
 * quando não: a sessão local não tem id nenhum e mesmo assim precisa de uma
 * chave que sobreviva ao próximo login.
 */
export function scopeId(scope: Omit<SessionScope, 'id'>) {
  if (scope.role === 'SUPER_ADMIN') return 'super-admin';
  return `${scope.editionId ?? scope.editionName ?? 'edicao'}:${scope.disciplineId ?? scope.discipline ?? 'todas'}`;
}

/** O rótulo do escopo, o mesmo em toda tela que o exibe. */
export function scopeLabel(scope: SessionScope) {
  if (scope.role === 'SUPER_ADMIN') return 'Super Admin';
  if (scope.role === 'EDITION_ADMIN') return 'Admin da edição';
  return `Gestor de ${scope.discipline ?? 'modalidade'}`;
}

function withId(scope: Omit<SessionScope, 'id'>): SessionScope {
  return { ...scope, id: scopeId(scope) };
}

/**
 * Ordena por amplitude e tira repetido.
 *
 * O desempate é a ordem em que o servidor devolveu: `editionRoles` não traz ano
 * nem status da edição, então não há como preferir a mais recente sem uma
 * chamada a mais por edição. O primeiro da lista é o escopo de quem nunca
 * escolheu — e é por isso que o mais amplo vem antes: entrar com menos acesso
 * do que se tem é surpresa maior do que entrar com o de sempre.
 */
function normalizeScopes(scopes: SessionScope[]): SessionScope[] {
  const vistos = new Set<string>();
  return scopes
    .map((scope, ordem) => ({ scope, ordem }))
    .sort((esquerda, direita) => scopeBreadth[esquerda.scope.role] - scopeBreadth[direita.scope.role] || esquerda.ordem - direita.ordem)
    .filter(({ scope }) => (vistos.has(scope.id) ? false : vistos.add(scope.id)))
    .map(({ scope }) => scope);
}

function scopesFromPayload(user: SessionUserPayload, editionRoles?: EditionRolePayload[]): SessionScope[] {
  // A renovação reinjeta a sessão guardada: a lista que já existe vence, senão
  // renovar rebaixaria quem tem vários papéis ao único que o login devolve.
  if (user.scopes?.length) return normalizeScopes(user.scopes);
  const scopes: SessionScope[] = [];
  // `isSuperAdmin` é o único escopo global da API, e não aparece em editionRoles.
  if (user.isSuperAdmin) scopes.push(withId({ role: 'SUPER_ADMIN' }));
  for (const role of editionRoles ?? []) {
    scopes.push(withId({
      role: role.role,
      editionId: role.editionId,
      editionName: role.editionName,
      // Gestor traz a modalidade; admin da edição traz `null` nos dois campos.
      discipline: role.disciplineName ?? undefined,
      disciplineId: role.disciplineId ?? undefined,
    }));
  }
  if (!scopes.length && user.role) {
    // O formato do contrato: um papel só, e `scope` significa modalidade para o
    // gestor e nome da edição para quem administra.
    const gestor = user.role === 'DISCIPLINE_MANAGER';
    scopes.push(withId({ role: user.role, discipline: gestor ? user.scope : undefined, editionName: gestor ? undefined : user.scope }));
  }
  return normalizeScopes(scopes);
}

/**
 * Os escopos da sessão, nunca vazios para uma sessão válida.
 *
 * Quem foi gravado antes de a lista existir — ou construído à mão num teste —
 * tem um escopo só, reconstruído do par `role`/`scope`. É o mesmo caminho que
 * mantém o adaptador local funcionando sem saber de multi-escopo.
 */
export function sessionScopes(session: FrontendSession | null | undefined): SessionScope[] {
  if (!session) return [];
  if (session.scopes?.length) return session.scopes;
  return scopesFromPayload({ email: session.email, name: session.name, role: session.role, scope: session.scope });
}

/**
 * A sessão com um escopo em vigor.
 *
 * `role` e `scope` passam a ser os do escopo escolhido; escolha que não existe
 * mais — papel revogado, outro usuário no mesmo aparelho — cai no primeiro da
 * lista, em vez de deixar a sessão sem papel nenhum.
 */
export function withActiveScope(session: FrontendSession, chosenId?: string | null): FrontendSession {
  const scopes = sessionScopes(session);
  const ativo = scopes.find((scope) => scope.id === chosenId) ?? scopes[0];
  if (!ativo) return session;
  return { ...session, scopes, activeScopeId: ativo.id, role: ativo.role, scope: ativo.discipline ?? ativo.editionName };
}

/** O escopo em vigor, para quem precisa do id da edição ou da modalidade. */
export function activeScopeOf(session: FrontendSession | null | undefined): SessionScope | null {
  const scopes = sessionScopes(session);
  return scopes.find((scope) => scope.id === session?.activeScopeId) ?? scopes[0] ?? null;
}

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
  const scopes = user ? scopesFromPayload(user, payload.editionRoles) : [];
  const [ativo] = scopes;
  if (!user || !ativo) throw new AuthError('A API não informou o papel do usuário nesta edição.');
  return {
    email: user.email,
    name: user.name,
    role: ativo.role,
    scope: ativo.discipline ?? ativo.editionName,
    scopes,
    activeScopeId: ativo.id,
    remembered,
    token,
    refreshToken: payload.refreshToken,
    accessExpiresAt: payload.accessExpiresAt ?? (payload.expiresIn ? new Date(Date.now() + payload.expiresIn * 1000).toISOString() : undefined),
    expiresAt: payload.expiresAt ?? new Date(Date.now() + sessionDurationMs).toISOString(),
  };
}
