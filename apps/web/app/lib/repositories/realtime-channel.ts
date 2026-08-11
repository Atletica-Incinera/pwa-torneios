import type { Socket } from 'socket.io-client';
import type { FrontendState } from '../frontend-state.ts';
import { apiBaseUrl } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';
import { normalizeSnapshot, type RealtimeConnect } from './http-adapter.ts';

/**
 * Tempo real pelo gateway `live-matches` que a API já expõe.
 *
 * A edição inteira cabe num snapshot pequeno, então o servidor emite o estado
 * novo a cada operação e a tela apenas o absorve — sem reconciliar patch, sem
 * ordem de eventos para acertar. É o que faz o placar do ginásio e o celular da
 * arquibancada mostrarem o mesmo número.
 *
 * O cliente do socket entra por importação dinâmica: quem roda no modo local
 * nunca baixa esse pedaço.
 */
export const snapshotEvent = 'edition-snapshot';

export function createRealtimeChannel(namespace = 'live-matches'): RealtimeConnect {
  return (onSnapshot: (next: FrontendState) => void) => {
    const base = apiBaseUrl();
    const origin = base.startsWith('http') ? base : window.location.origin;
    let socket: Socket | undefined;
    let closed = false;
    void import('socket.io-client').then(({ io }) => {
      if (closed) return;
      socket = io(`${origin}/${namespace}`, { transports: ['websocket'], auth: { token: readSessionToken() } });
      socket.on(snapshotEvent, (payload: Partial<FrontendState>) => onSnapshot(normalizeSnapshot(payload)));
    });
    return () => { closed = true; socket?.close(); };
  };
}
