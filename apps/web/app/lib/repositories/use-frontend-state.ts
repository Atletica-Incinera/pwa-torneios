'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initialFrontendState, type FrontendState } from '../frontend-state.ts';
import { preferencesChangeEvent, withDevicePreferences, writeDevicePreferences, type DevicePreferences } from './device-preferences.ts';
import type { Action } from './actions.ts';
import { createLocalStateAdapter } from './local-adapter.ts';
import { createHttpStateAdapter } from './http-adapter.ts';
import { createRealtimeChannel } from './realtime-channel.ts';
import { UnauthorizedError } from './auth-adapter.ts';
import { clearStoredSession } from './session-storage.ts';
import { resolveDataSource, type ConnectionState, type StateAdapter } from './state-adapter.ts';

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
  const [connection, setConnection] = useState<ConnectionState>('online');
  const adapter = useMemo(createAdapter, []);
  const source = useMemo(resolveDataSource, []);
  const mounted = useRef(true);

  const absorb = useCallback((next: FrontendState) => {
    // O que a tela lê é o estado da edição com as preferências deste aparelho.
    if (mounted.current) setState(withDevicePreferences(next));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const loaded = await adapter.load();
      if (!mounted.current) return;
      absorb(loaded);
      setError(null);
      setStatus('ready');
    } catch (caught) {
      handleUnauthorized(caught);
      if (!mounted.current) return;
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os dados.');
      setStatus('error');
    }
  }, [absorb, adapter]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const unsubscribe = adapter.subscribe(absorb, (next) => { if (mounted.current) setConnection(next); });
    return () => { mounted.current = false; unsubscribe(); };
  }, [absorb, adapter, refresh]);

  useEffect(() => {
    // Preferência muda em outra tela do mesmo aparelho: todas acompanham.
    const sync = () => setState((current) => withDevicePreferences(current));
    window.addEventListener(preferencesChangeEvent, sync);
    return () => window.removeEventListener(preferencesChangeEvent, sync);
  }, []);

  useEffect(() => {
    // Conexão é obrigatória para ver em tempo real: quando ela volta, recarrega.
    if (source !== 'http') return;
    const offline = () => setConnection('offline');
    const online = () => { setConnection('online'); void refresh(); };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); };
  }, [refresh, source]);

  /** Executa uma operação nomeada. É por aqui que a Fase 1 passa a escrever. */
  const dispatch = useCallback(async (action: Action): Promise<DispatchResult> => {
    try {
      const next = await adapter.apply(action);
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

  /**
   * Preferência do aparelho. Não é operação da edição: não vai ao servidor,
   * não entra na auditoria e não depende de conexão.
   */
  const setPreference = useCallback((patch: Partial<DevicePreferences>) => {
    writeDevicePreferences(patch);
    setState((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  }, []);

  return { state, status, error, hydrated: status === 'ready', source, connection, dispatch, setPreference, refresh };
}
