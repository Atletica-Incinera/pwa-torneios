import { beforeEach, describe, expect, it } from 'vitest';
import { scopeId, type FrontendRole, type FrontendSession, type SessionScope } from '../../app/lib/repositories/auth-adapter';
import { clearActiveScopeId } from '../../app/lib/repositories/active-scope';
import { clearStoredSession, readStoredSession, writeStoredSession } from '../../app/lib/repositories/session-storage';
import { canGrantRole, canManageDiscipline, canManageEdition, canReadAudit, canSwitchScope, isSuperAdmin, sessionScopes, switchScope } from '../../app/lib/frontend-session';

/**
 * As regras de autorização do app, uma a uma.
 *
 * Elas decidem o que cada papel vê e opera em toda a árvore — da guarda de rota
 * ao botão de encerrar partida. Até aqui a única cobertura era indireta, por
 * e2e, que exige build e navegador para dizer que um predicado de uma linha
 * mudou de ideia.
 */
function sessao(role: FrontendRole, scope?: string): FrontendSession {
  return { email: 'quem@ufpe.br', name: 'Quem Entrou', role, scope, remembered: false, token: 'token', expiresAt: new Date(Date.now() + 60_000).toISOString() };
}

const superAdmin = sessao('SUPER_ADMIN');
const adminDaEdicao = sessao('EDITION_ADMIN');
const gestorDeFutsal = sessao('DISCIPLINE_MANAGER', 'Futsal');

describe('super admin', () => {
  it('é o desenvolvedor do app, não a organização do evento', () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(adminDaEdicao)).toBe(false);
    expect(isSuperAdmin(gestorDeFutsal)).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it('a auditoria completa da edição é exclusiva dele', () => {
    expect(canReadAudit(superAdmin)).toBe(true);
    expect(canReadAudit(adminDaEdicao)).toBe(false);
    expect(canReadAudit(gestorDeFutsal)).toBe(false);
    expect(canReadAudit(null)).toBe(false);
  });
});

describe('administração da edição', () => {
  it('super admin e admin da edição administram; gestor de modalidade não', () => {
    expect(canManageEdition(superAdmin)).toBe(true);
    expect(canManageEdition(adminDaEdicao)).toBe(true);
    expect(canManageEdition(gestorDeFutsal)).toBe(false);
    expect(canManageEdition(null)).toBe(false);
  });
});

describe('concessão de acesso', () => {
  it('só o super admin cria ou promove admin da edição', () => {
    expect(canGrantRole(superAdmin, 'Admin da edição')).toBe(true);
    expect(canGrantRole(adminDaEdicao, 'Admin da edição')).toBe(false);
    expect(canGrantRole(gestorDeFutsal, 'Admin da edição')).toBe(false);
    expect(canGrantRole(null, 'Admin da edição')).toBe(false);
  });

  it('gestor de modalidade é concedido por quem administra a edição', () => {
    expect(canGrantRole(superAdmin, 'Gestor de modalidade')).toBe(true);
    expect(canGrantRole(adminDaEdicao, 'Gestor de modalidade')).toBe(true);
    // Um gestor não multiplica gestores: quem opera não concede.
    expect(canGrantRole(gestorDeFutsal, 'Gestor de modalidade')).toBe(false);
    expect(canGrantRole(null, 'Gestor de modalidade')).toBe(false);
  });
});

describe('operação por modalidade', () => {
  it('quem administra a edição opera qualquer modalidade', () => {
    expect(canManageDiscipline(superAdmin, 'Futsal')).toBe(true);
    expect(canManageDiscipline(adminDaEdicao, 'Vôlei')).toBe(true);
  });

  it('o gestor opera a modalidade do seu escopo e nenhuma outra', () => {
    expect(canManageDiscipline(gestorDeFutsal, 'Futsal')).toBe(true);
    expect(canManageDiscipline(gestorDeFutsal, 'Vôlei')).toBe(false);
    expect(canManageDiscipline(sessao('DISCIPLINE_MANAGER'), 'Futsal')).toBe(false);
  });

  it('o escopo casa pelo nome exato da modalidade na edição', () => {
    // O escopo é gravado a partir da lista de modalidades da edição, e é dessa
    // mesma lista que vem o nome consultado: comparar exato é o que impede um
    // `futsal` digitado à mão conceder o que a lista não concedeu.
    expect(canManageDiscipline(gestorDeFutsal, 'futsal')).toBe(false);
    expect(canManageDiscipline(gestorDeFutsal, 'Futsal ')).toBe(false);
  });

  it('sem modalidade nomeada, a pergunta é se o papel opera alguma', () => {
    // Nenhuma tela chama assim hoje — todas nomeiam a modalidade —, mas a
    // ausência é permitida pela assinatura e precisa de resposta definida.
    expect(canManageDiscipline(gestorDeFutsal)).toBe(true);
    expect(canManageDiscipline(gestorDeFutsal, '')).toBe(true);
  });

  it('sem sessão não se opera nada', () => {
    expect(canManageDiscipline(null, 'Futsal')).toBe(false);
    expect(canManageDiscipline(null)).toBe(false);
  });
});

/**
 * Multi-escopo: a mesma conta com mais de um papel.
 *
 * O que muda não são os predicados acima — eles continuam comparando `role` e
 * `scope` —, e sim de onde esses dois campos vêm: do escopo em uso, escolhido
 * neste aparelho. Por isso os casos abaixo passam pelo armazenamento em vez de
 * montar a sessão na mão: é lá que a derivação acontece, e é lá que ela pode
 * quebrar.
 */
function escopo(role: FrontendRole, extras: Partial<SessionScope> = {}): SessionScope {
  const base = { role, ...extras };
  return { ...base, id: scopeId(base) };
}

const adminDe2025 = escopo('EDITION_ADMIN', { editionId: 'intereng-2025', editionName: 'InterEng 2025' });
const gestorDeFutsal2026 = escopo('DISCIPLINE_MANAGER', { editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', discipline: 'Futsal' });
const dosDoisAcessos: FrontendSession = { ...sessao('EDITION_ADMIN'), scopes: [adminDe2025, gestorDeFutsal2026] };

describe('mais de um acesso na mesma conta', () => {
  beforeEach(() => { clearStoredSession(); clearActiveScopeId(); });

  it('sem escolha feita, vale o acesso mais amplo', () => {
    writeStoredSession(dosDoisAcessos);
    const lida = readStoredSession();

    expect(lida?.activeScopeId).toBe(adminDe2025.id);
    expect(lida?.scope).toBe('InterEng 2025');
    expect(canManageEdition(lida)).toBe(true);
  });

  it('a autorização segue o escopo em uso, e não a soma dos acessos', () => {
    // Admin de uma edição e gestor de uma modalidade de outra: atuando como
    // gestor, o que a outra edição concede não vale — o servidor recusaria.
    writeStoredSession(dosDoisAcessos);
    switchScope(gestorDeFutsal2026.id);
    const lida = readStoredSession();

    expect(canManageEdition(lida)).toBe(false);
    expect(canReadAudit(lida)).toBe(false);
    expect(canGrantRole(lida, 'Gestor de modalidade')).toBe(false);
    expect(canManageDiscipline(lida, 'Futsal')).toBe(true);
    expect(canManageDiscipline(lida, 'Vôlei')).toBe(false);
  });

  it('voltar ao acesso mais amplo devolve o que ele concedia', () => {
    writeStoredSession(dosDoisAcessos);
    switchScope(gestorDeFutsal2026.id);
    switchScope(adminDe2025.id);

    expect(canManageEdition(readStoredSession())).toBe(true);
  });

  it('trocar de escopo não concede nem revoga acesso: a lista continua inteira', () => {
    writeStoredSession(dosDoisAcessos);
    switchScope(gestorDeFutsal2026.id);

    expect(sessionScopes(readStoredSession()).map((item) => item.id)).toEqual([adminDe2025.id, gestorDeFutsal2026.id]);
  });

  it('escolha que não existe mais cai no primeiro acesso, em vez de sessão sem papel', () => {
    // Papel revogado, ou outro usuário no mesmo aparelho: a preferência é do
    // aparelho e sobrevive ao login seguinte, que pode ter outros acessos.
    writeStoredSession(dosDoisAcessos);
    switchScope('intereng-2024:natacao');
    const lida = readStoredSession();

    expect(lida?.activeScopeId).toBe(adminDe2025.id);
    expect(canManageEdition(lida)).toBe(true);
  });

  it('super admin fura os guards e continua sendo um acesso à parte', () => {
    const acumulado: FrontendSession = { ...sessao('SUPER_ADMIN'), scopes: [escopo('SUPER_ADMIN'), gestorDeFutsal2026] };
    writeStoredSession(acumulado);
    expect(canReadAudit(readStoredSession())).toBe(true);

    switchScope(gestorDeFutsal2026.id);
    // Escolher o escopo estreito não tira o poder no servidor; tira da tela,
    // que é o ponto: dá para operar a modalidade sem a área de administração.
    expect(canReadAudit(readStoredSession())).toBe(false);
    expect(canManageDiscipline(readStoredSession(), 'Futsal')).toBe(true);
  });

  it('quem tem um acesso só não ganha seletor', () => {
    expect(canSwitchScope(gestorDeFutsal)).toBe(false);
    expect(canSwitchScope(adminDaEdicao)).toBe(false);
    expect(canSwitchScope(dosDoisAcessos)).toBe(true);
    expect(canSwitchScope(null)).toBe(false);
  });

  it('sessão gravada antes de a lista existir vale como um acesso só', () => {
    // Nenhuma versão nova do app pode devolver ao login quem já estava dentro.
    writeStoredSession(gestorDeFutsal);
    const lida = readStoredSession();

    expect(sessionScopes(lida)).toHaveLength(1);
    expect(canManageDiscipline(lida, 'Futsal')).toBe(true);
    expect(canManageDiscipline(lida, 'Vôlei')).toBe(false);
  });
});
