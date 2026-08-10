import { afterEach, describe, expect, it } from 'vitest';
import { authenticateFrontend, clearFrontendSession, readFrontendSession } from '../../app/lib/frontend-session';

describe('sessão de demonstração', () => {
  afterEach(() => clearFrontendSession());

  it('aceita o acesso de admin com espaços acidentais e mantém a sessão', () => {
    const result = authenticateFrontend('  ANA@UFPE.BR  ', '  intereng2026  ', false);

    expect(result.error).toBeUndefined();
    expect(result.session?.role).toBe('EDITION_ADMIN');
    expect(readFrontendSession()?.email).toBe('ana@ufpe.br');
  });
});
