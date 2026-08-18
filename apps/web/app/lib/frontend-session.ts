'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthError, type AuthAdapter, type FrontendRole, type FrontendSession } from './repositories/auth-adapter';
import { createLocalAuthAdapter, demoUsers } from './repositories/local-auth-adapter';
import { createHttpAuthAdapter } from './repositories/http-auth-adapter';
import { clearStoredSession, handleSessionStorageEvent, readStoredSession, sessionChangeEvent, writeStoredSession } from './repositories/session-storage';
import { resolveDataSource } from './repositories/state-adapter';

export type { FrontendRole, FrontendSession };
export { demoUsers };

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

/** Seleciona explicitamente uma atribuição de papel realmente concedida ao staff. */
export function selectEditionRole(roleAssignmentId: string): boolean {
  const current = readStoredSession();
  if (!current) return false;
  const selected = current.editionRoles.find((role) => role.roleAssignmentId === roleAssignmentId);
  if (!selected) return false;
  if (selected.role === 'DISCIPLINE_MANAGER' && (!selected.editionDisciplineId || !selected.disciplineName)) return false;
  writeStoredSession({
    ...current,
    role: selected.role,
    scope: selected.role === 'DISCIPLINE_MANAGER' ? selected.disciplineName ?? undefined : undefined,
    selectedRoleAssignmentId: selected.roleAssignmentId,
    selectedEditionId: selected.editionId,
    selectedEditionDisciplineId: selected.role === 'DISCIPLINE_MANAGER'
      ? selected.editionDisciplineId ?? undefined
      : undefined,
  });
  return true;
}

export function useFrontendSession() {
  const [session, setSession] = useState<FrontendSession | null>(null);
  const [expired, setExpired] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    const sync = () => {
      // O prazo é lido antes de restaurar: restaurar já descarta a sessão vencida.
      const wasExpired = isSessionExpired();
      void adapter.restore().then((restored) => {
        if (!active) return;
        setSession(restored);
        setExpired(!restored && wasExpired);
        setHydrated(true);
      });
    };
    const syncStorage = (event: StorageEvent) => { handleSessionStorageEvent(event); sync(); };
    sync();
    window.addEventListener(sessionChangeEvent, sync);
    window.addEventListener('storage', syncStorage);
    return () => { active = false; window.removeEventListener(sessionChangeEvent, sync); window.removeEventListener('storage', syncStorage); };
  }, []);
  const logout = useCallback(() => { void adapter.signOut(); }, []);
  return { session, hydrated, expired, logout };
}

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
