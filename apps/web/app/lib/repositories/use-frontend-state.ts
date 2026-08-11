'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initialFrontendState, readFrontendState, type FrontendState } from '../frontend-state.ts';
import type { Action } from './actions.ts';
import { createLocalStateAdapter } from './local-adapter.ts';
import { createHttpStateAdapter } from './http-adapter.ts';
import { createRealtimeChannel } from './realtime-channel.ts';
import { UnauthorizedError } from './auth-adapter.ts';
import { clearStoredSession } from './session-storage.ts';
import { resolveDataSource, type StateAdapter } from './state-adapter.ts';

export type StateStatus = 'loading' | 'ready' | 'error';
export type DispatchResult = { ok: boolean; error?: string };

function createAdapter(): StateAdapter {
  // A origem é escolhida por ambiente: os e2e continuam no adaptador local.
  if (resolveDataSource() === 'http') return createHttpStateAdapter({ connect: createRealtimeChannel() });
  return createLocalStateAdapter();
}

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message, tone } }));
}

/**
 * Sessão recusada pela origem dos dados (o 401 da Fase 5): encerra o acesso.
 * Quem redireciona é a guarda de rota, que já observa a sessão.
 */
function handleUnauthorized(caught: unknown) {
  if (caught instanceof UnauthorizedError) clearStoredSession();
}

export function useFrontendState() {
  const [state, setState] = useState<FrontendState>(initialFrontendState);
  const [status, setStatus] = useState<StateStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const adapter = useMemo(createAdapter, []);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const loaded = await adapter.load();
      if (!mounted.current) return;
      setState(loaded);
      setError(null);
      setStatus('ready');
    } catch (caught) {
      handleUnauthorized(caught);
      if (!mounted.current) return;
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os dados.');
      setStatus('error');
    }
  }, [adapter]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const unsubscribe = adapter.subscribe((next) => { if (mounted.current) setState(next); });
    return () => { mounted.current = false; unsubscribe(); };
  }, [adapter, refresh]);

  /** Executa uma operação nomeada. É por aqui que a Fase 1 passa a escrever. */
  const dispatch = useCallback(async (action: Action): Promise<DispatchResult> => {
    try {
      const next = await adapter.apply(action, readFrontendState());
      setState(next);
      if (action.audit) toast(action.audit.action, 'success');
      return { ok: true };
    } catch (caught) {
      handleUnauthorized(caught);
      const message = caught instanceof Error ? caught.message : 'Não foi possível salvar. Tente novamente.';
      toast('Não foi possível salvar. Tente novamente.', 'error');
      return { ok: false, error: message };
    }
  }, [adapter]);

  return { state, status, error, hydrated: status === 'ready', dispatch, refresh };
}
