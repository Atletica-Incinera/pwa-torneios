import { afterEach, describe, expect, it } from 'vitest';
import { clearFrontendSession, isSessionExpired, readFrontendSession, signIn } from '../../app/lib/frontend-session';
import { readStoredSession, writeStoredSession } from '../../app/lib/repositories/session-storage';

describe('sessão de demonstração', () => {
  afterEach(() => clearFrontendSession());

  it('aceita o acesso de admin com espaços acidentais e mantém a sessão', async () => {
    const result = await signIn('  ANA@UFPE.BR  ', '  intereng2026  ', false);

    expect(result.error).toBeUndefined();
    expect(result.session?.role).toBe('EDITION_ADMIN');
    expect(readFrontendSession()?.email).toBe('ana@ufpe.br');
  });

  it('a sessão nasce com prazo e token', async () => {
    const { session } = await signIn('ana@ufpe.br', 'intereng2026', false);

    expect(session?.token).toBeTruthy();
    expect(Date.parse(session?.expiresAt ?? '')).toBeGreaterThan(Date.now());
  });

  it('sessão vencida deixa de valer e é reconhecida como expirada', async () => {
    await signIn('ana@ufpe.br', 'intereng2026', false);
    const stored = readStoredSession();
    writeStoredSession({ ...stored!, expiresAt: new Date(Date.now() - 1000).toISOString() });

    expect(readFrontendSession()).toBeNull();
    expect(isSessionExpired()).toBe(true);
  });
});
