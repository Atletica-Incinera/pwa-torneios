import { parseFrontendState, seededFrontendState, type FrontendState } from './frontend-state.ts';

/**
 * A metade de `frontend-state` que só existe no navegador.
 *
 * O contrato é puro: separar aqui é o que permite ao servidor importar o
 * mesmo formato e as mesmas regras sem arrastar `window`.
 */
export const storageKey = 'intereng:app-state:v1';
export const stateChangeEvent = 'intereng:state-change';
const eventName = stateChangeEvent;
const sessionKey = 'intereng:frontend-session';

export function readFrontendState() {
  if (typeof window === 'undefined') return seededFrontendState;
  return parseFrontendState(window.localStorage.getItem(storageKey), seededFrontendState);
}
/** Grava o snapshot e avisa as telas abertas. Lança se o storage recusar. */
export function writeFrontendState(next: FrontendState) {
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  window.dispatchEvent(new Event(eventName));
}

/** Quem está operando, para a auditoria. Lido da sessão gravada no navegador. */
export function readActor() {
  try {
    const raw = window.localStorage.getItem(sessionKey) ?? window.sessionStorage.getItem(sessionKey);
    return raw ? (JSON.parse(raw) as { name?: string }).name ?? 'Usuário do app' : 'Usuário do app';
  } catch { return 'Usuário do app'; }
}
