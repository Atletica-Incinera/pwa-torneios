'use client';

import { useCallback, useEffect, useState } from 'react';
import { readFrontendState } from './frontend-state';

export type FrontendRole = 'SUPER_ADMIN' | 'EDITION_ADMIN' | 'DISCIPLINE_MANAGER';
export type FrontendSession = { email: string; name: string; role: FrontendRole; scope?: string; remembered: boolean };

const sessionKey = 'intereng:frontend-session';
const sessionEvent = 'intereng:session-change';
const demoUsers = [
  { email: 'super@intereng.com', password: 'super2026', name: 'Super Admin', role: 'SUPER_ADMIN' as const },
  { email: 'ana@ufpe.br', password: 'intereng2026', name: 'Ana Coordenadora', role: 'EDITION_ADMIN' as const },
  { email: 'bruno@ufpe.br', password: 'futsal2026', name: 'Bruno Martins', role: 'DISCIPLINE_MANAGER' as const, scope: 'Futsal' },
];

export function readFrontendSession(): FrontendSession | null {
  if (typeof window === 'undefined') return null;
  const local = window.localStorage.getItem(sessionKey);
  const raw = local ?? window.sessionStorage.getItem(sessionKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FrontendSession>;
    if (!parsed.email || !parsed.role) return null;
    const demo = demoUsers.find((user) => user.email === parsed.email);
    return { email: parsed.email, name: parsed.name ?? demo?.name ?? parsed.email.split('@')[0], role: parsed.role, scope: parsed.scope, remembered: parsed.remembered ?? Boolean(local) };
  } catch { return null; }
}

export function authenticateFrontend(email: string, password: string, remembered: boolean): { session?: FrontendSession; error?: string } {
  const normalized = email.trim().toLowerCase();
  const state = readFrontendState();
  const stored = state.staff[normalized];
  if (stored?.revoked) return { error: 'Este acesso foi revogado pelo administrador da edição.' };
  const demo = demoUsers.find((user) => user.email === normalized && user.password === password);
  const invited = stored && password === 'intereng2026' ? { email: normalized, name: stored.name, role: stored.role === 'Admin da edição' ? 'EDITION_ADMIN' as const : 'DISCIPLINE_MANAGER' as const, scope: stored.scope } : undefined;
  const user = demo ?? invited;
  if (!user) return { error: 'E-mail ou senha inválidos.' };
  const session: FrontendSession = { email: user.email, name: user.name, role: user.role, scope: 'scope' in user ? user.scope : undefined, remembered };
  const target = remembered ? window.localStorage : window.sessionStorage;
  const other = remembered ? window.sessionStorage : window.localStorage;
  other.removeItem(sessionKey);
  target.setItem(sessionKey, JSON.stringify(session));
  window.dispatchEvent(new Event(sessionEvent));
  return { session };
}

export function clearFrontendSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(sessionKey);
  window.sessionStorage.removeItem(sessionKey);
  window.dispatchEvent(new Event(sessionEvent));
}

export function useFrontendSession() {
  const [session, setSession] = useState<FrontendSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { const sync = () => { setSession(readFrontendSession()); setHydrated(true); }; sync(); window.addEventListener(sessionEvent, sync); window.addEventListener('storage', sync); return () => { window.removeEventListener(sessionEvent, sync); window.removeEventListener('storage', sync); }; }, []);
  const logout = useCallback(() => clearFrontendSession(), []);
  return { session, hydrated, logout };
}

export function canManageEdition(session: FrontendSession | null) { return session?.role === 'SUPER_ADMIN' || session?.role === 'EDITION_ADMIN'; }
export function canManageDiscipline(session: FrontendSession | null, discipline?: string) { return canManageEdition(session) || (session?.role === 'DISCIPLINE_MANAGER' && (!discipline || session.scope === discipline)); }
