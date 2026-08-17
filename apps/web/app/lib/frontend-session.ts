'use client';

import { useCallback, useEffect, useState } from 'react';
import { activeScopeOf, AuthError, scopeLabel, sessionScopes, type AuthAdapter, type FrontendRole, type FrontendSession, type SessionScope } from './repositories/auth-adapter';
import { createLocalAuthAdapter, demoUsers } from './repositories/local-auth-adapter';
import { createHttpAuthAdapter } from './repositories/http-auth-adapter';
import { scopeChangeEvent, writeActiveScopeId } from './repositories/active-scope';
import { clearStoredSession, readStoredSession, sessionChangeEvent } from './repositories/session-storage';
import { resolveDataSource } from './repositories/state-adapter';

export type { FrontendRole, FrontendSession, SessionScope };
export { activeScopeOf, demoUsers, scopeLabel, sessionScopes };

function createAuthAdapter(): AuthAdapter {
  // Mesma escolha de ambiente da origem de dados: token local ou token da API.
  if (resolveDataSource() === 'http') return createHttpAuthAdapter();
  return createLocalAuthAdapter();
}

const adapter = createAuthAdapter();

/** A sessão em vigor, ou `null` quando não há nenhuma ou o prazo venceu. */
export function readFrontendSession(): FrontendSession | null {
  const session = readStoredSession();
  if (!session) return null;
  return Date.parse(session.expiresAt) > Date.now() ? session : null;
}

/** Havia sessão, mas o prazo acabou: a tela avisa em vez de só mandar entrar. */
export function isSessionExpired() {
  const session = readStoredSession();
  return Boolean(session && Date.parse(session.expiresAt) <= Date.now());
}

export async function signIn(email: string, password: string, remembered: boolean): Promise<{ session?: FrontendSession; error?: string }> {
  try {
    return { session: await adapter.signIn(email, password, remembered) };
  } catch (caught) {
    if (caught instanceof AuthError) return { error: caught.message };
    return { error: 'Não foi possível entrar. Tente novamente.' };
  }
}

export function clearFrontendSession() {
  clearStoredSession();
}

export function useFrontendSession() {
  const [session, setSession] = useState<FrontendSession | null>(null);
  const [expired, setExpired] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    /**
     * Bilhete de última-vence, o mesmo do canal de tempo real.
     *
     * Cada instância que grava sessão emite um evento, então os `sync` vêm em
     * rajada e as leituras do storage se intercalam com as restaurações. Só
     * `active` não bastava: ele protege contra a desmontagem, não contra a
     * ordem — quem lia primeiro e resolvia por último ditava o resultado, e
     * escrevia na tela um retrato mais velho que o que já estava lá. Era o que
     * deixava `expired` falso num incidente que devia expulsar, ou verdadeiro
     * logo depois de um login que deu certo.
     */
    let issued = 0;
    let applied = 0;
    const sync = () => {
      const ticket = ++issued;
      // O prazo é lido antes de restaurar: restaurar já descarta a sessão vencida.
      const wasExpired = isSessionExpired();
      void adapter.restore().then((restored) => {
        if (!active || ticket < applied) return;
        applied = ticket;
        setSession(restored);
        setExpired(!restored && wasExpired);
        setHydrated(true);
      });
    };
    sync();
    window.addEventListener(sessionChangeEvent, sync);
    // Trocar de escopo não muda a sessão gravada, mas muda `role` e `scope`
    // derivados — e são eles que a guarda de rota e as telas comparam.
    window.addEventListener(scopeChangeEvent, sync);
    window.addEventListener('storage', sync);
    return () => { active = false; window.removeEventListener(sessionChangeEvent, sync); window.removeEventListener(scopeChangeEvent, sync); window.removeEventListener('storage', sync); };
  }, []);
  const logout = useCallback(() => { void adapter.signOut(); }, []);
  return { session, hydrated, expired, logout };
}

/**
 * Passa a atuar por outro dos seus acessos.
 *
 * Não é operação da edição: não vai ao servidor, não entra na auditoria e vale
 * só neste aparelho — o servidor continua conhecendo todos os papéis e
 * decidindo cada escrita por conta própria. O que muda é qual deles o app usa.
 */
export function switchScope(scopeId: string) {
  writeActiveScopeId(scopeId);
}

/** Um acesso só não merece seletor: não há para onde trocar. */
export function canSwitchScope(session: FrontendSession | null) { return sessionScopes(session).length > 1; }

/**
 * Os cinco predicados de autorização decidem pelo **escopo ativo**.
 *
 * `session.role` e `session.scope` são derivados dele na leitura da sessão, e
 * por isso nenhum deles precisa saber que existe uma lista de acessos: trocar
 * de escopo troca o que o app oferece, com a mesma comparação de sempre.
 */

/** Super admin é o desenvolvedor do app, não a organização do evento. */
export function isSuperAdmin(session: FrontendSession | null) { return session?.role === 'SUPER_ADMIN'; }

export function canManageEdition(session: FrontendSession | null) { return isSuperAdmin(session) || session?.role === 'EDITION_ADMIN'; }

/** Só o super admin cria ou promove Admin da edição. */
export function canGrantRole(session: FrontendSession | null, role: 'Admin da edição' | 'Gestor de modalidade') {
  return role === 'Admin da edição' ? isSuperAdmin(session) : canManageEdition(session);
}

/** A auditoria completa da edição é exclusiva do super admin. */
export function canReadAudit(session: FrontendSession | null) { return isSuperAdmin(session); }
export function canManageDiscipline(session: FrontendSession | null, discipline?: string) { return canManageEdition(session) || (session?.role === 'DISCIPLINE_MANAGER' && (!discipline || session.scope === discipline)); }
