import { sessionDurationMs, type FrontendSession } from './auth-adapter.ts';

/**
 * Onde a sessão fica no navegador.
 *
 * É comum aos dois adaptadores de autenticação: muda quem emite o token, não
 * onde ele é guardado. `remembered` decide entre `localStorage` (persiste) e
 * `sessionStorage` (só nesta aba).
 */
export const sessionKey = 'intereng:frontend-session';
export const sessionChangeEvent = 'intereng:session-change';
export const sessionLogoutKey = 'intereng:session-logout';

// Fallback para ambientes de teste ou modo privado que bloqueiam storage.
let volatileSession: FrontendSession | null = null;

/** Sessão guardada, mesmo vencida — quem decide o que fazer é quem chama. */
export function readStoredSession(): FrontendSession | null {
  if (typeof window === 'undefined') return null;
  let local: string | null = null;
  let raw: string | null = null;
  try {
    local = window.localStorage.getItem(sessionKey);
    raw = local ?? window.sessionStorage.getItem(sessionKey);
  } catch {
    return volatileSession;
  }
  if (!raw) {
    volatileSession = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FrontendSession>;
    if (!parsed.email || !parsed.role) return null;
    return {
      id: parsed.id ?? `legacy:${parsed.email}`,
      email: parsed.email,
      name: parsed.name ?? parsed.email.split('@')[0],
      role: parsed.role,
      scope: parsed.scope,
      remembered: parsed.remembered ?? Boolean(local),
      token: parsed.token ?? '',
      // Sessão gravada antes de existir prazo vale até o próximo login.
      expiresAt: parsed.expiresAt ?? new Date(Date.now() + sessionDurationMs).toISOString(),
    };
  } catch { return null; }
}

export function writeStoredSession(session: FrontendSession) {
  volatileSession = session;
  try {
    const target = session.remembered ? window.localStorage : window.sessionStorage;
    const other = session.remembered ? window.sessionStorage : window.localStorage;
    other.removeItem(sessionKey);
    target.setItem(sessionKey, JSON.stringify(session));
  } catch {
    // A sessão volátil permite continuar durante testes/offline.
  }
  window.dispatchEvent(new Event(sessionChangeEvent));
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  volatileSession = null;
  try { window.localStorage.removeItem(sessionKey); } catch { /* storage indisponível */ }
  try { window.sessionStorage.removeItem(sessionKey); } catch { /* storage indisponível */ }
  try { window.localStorage.setItem(sessionLogoutKey, `${Date.now()}:${Math.random()}`); } catch { /* storage indisponível */ }
  window.dispatchEvent(new Event(sessionChangeEvent));
}

/** Aplica nesta aba o logout publicado por outra aba, inclusive para sessionStorage. */
export function handleSessionStorageEvent(event: StorageEvent) {
  if (event.key !== sessionLogoutKey) return;
  volatileSession = null;
  try { window.sessionStorage.removeItem(sessionKey); } catch { /* storage indisponível */ }
}

export function readSessionLogoutMarker(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(sessionLogoutKey); } catch { return null; }
}

/**
 * A sessão foi recusada pelo servidor (401).
 *
 * Não é o mesmo que sair: marcar o prazo como vencido faz o app seguir o
 * caminho que já existe para sessão expirada — com aviso no login. Apagar
 * calado devolvia a pessoa ao login sem dizer por quê.
 */
export function expireStoredSession() {
  const session = readStoredSession();
  if (!session) return;
  if (!session.token && Date.parse(session.expiresAt) <= Date.now()) return;
  writeStoredSession({ ...session, token: '', expiresAt: new Date().toISOString() });
}

/** O token em vigor, para as requisições do adaptador HTTP. */
export function readSessionToken(): string | null {
  const session = readStoredSession();
  return session?.token || null;
}
