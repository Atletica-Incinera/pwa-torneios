import { beforeEach, describe, expect, it } from 'vitest';
import { createHttpAuthAdapter } from '../../app/lib/repositories/http-auth-adapter';
import { AuthError } from '../../app/lib/repositories/auth-adapter';
import { clearActiveScopeId, writeActiveScopeId } from '../../app/lib/repositories/active-scope';
import { clearStoredSession, readStoredSession } from '../../app/lib/repositories/session-storage';
import { createMockFetch } from '../mock-api/api';

/**
 * A entrada pela API, contra a API de mentira — a mesma que os e2e sobem.
 *
 * O que precisa ser provado aqui é que a entrada **completa**: `POST
 * /auth/login` devolve `staff` sem papel nenhum, e o papel na API é por edição.
 * Sem a segunda chamada a `GET /auth/me` nenhum operador entra no modo `http`,
 * porque o mapeador recusa sessão sem papel — e recusa de propósito.
 */
describe('entrada pela API', () => {
  beforeEach(() => { clearStoredSession(); clearActiveScopeId(); });

  it('o papel vem de /auth/me, que é onde a API o guarda', async () => {
    const { fetchImpl } = createMockFetch();

    const session = await createHttpAuthAdapter(fetchImpl).signIn('ana@ufpe.br', 'intereng2026', false);

    expect(session.role).toBe('EDITION_ADMIN');
    expect(session.scopes).toHaveLength(1);
    expect(session.scopes?.[0].editionId).toBe('intereng-2026');
    expect(readStoredSession()?.role).toBe('EDITION_ADMIN');
  });

  it('o gestor entra com a modalidade que a edição nomeia', async () => {
    const { fetchImpl } = createMockFetch();

    const session = await createHttpAuthAdapter(fetchImpl).signIn('bruno@ufpe.br', 'futsal2026', false);

    expect(session.role).toBe('DISCIPLINE_MANAGER');
    // É por este nome que `canManageDiscipline` compara em toda a árvore.
    expect(session.scope).toBe('Futsal');
  });

  it('o super admin entra pelo escopo global, que não está em editionRoles', async () => {
    const { fetchImpl } = createMockFetch();

    const session = await createHttpAuthAdapter(fetchImpl).signIn('super@intereng.com', 'super2026', false);

    expect(session.role).toBe('SUPER_ADMIN');
  });

  it('credencial errada continua sendo mensagem de login, não sessão vencida', async () => {
    const { fetchImpl } = createMockFetch();

    await expect(createHttpAuthAdapter(fetchImpl).signIn('ana@ufpe.br', 'errada', false))
      .rejects.toThrow(AuthError);
    expect(readStoredSession()).toBeNull();
  });

  it('a entrada respeita o escopo já escolhido neste aparelho', async () => {
    // A preferência é do aparelho e sobrevive ao login: quem opera o futsal
    // neste celular volta a operar o futsal, sem escolher de novo.
    const { fetchImpl } = createMockFetch();
    writeActiveScopeId('intereng-2026:futsal');

    const session = await createHttpAuthAdapter(fetchImpl).signIn('bruno@ufpe.br', 'futsal2026', false);

    expect(session.activeScopeId).toBe('intereng-2026:futsal');
  });
});
