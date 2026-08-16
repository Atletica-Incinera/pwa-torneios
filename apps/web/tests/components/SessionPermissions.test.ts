import { describe, expect, it } from 'vitest';
import type { FrontendRole, FrontendSession } from '../../app/lib/repositories/auth-adapter';
import { canGrantRole, canManageDiscipline, canManageEdition, canReadAudit, isSuperAdmin } from '../../app/lib/frontend-session';

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
