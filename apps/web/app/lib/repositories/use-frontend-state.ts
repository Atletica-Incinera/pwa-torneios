'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialFrontendState, type FrontendState } from '../frontend-state.ts';
import { preferencesChangeEvent, withDevicePreferences, writeDevicePreferences, type DevicePreferences } from './device-preferences.ts';
import type { Action } from './actions.ts';
import { createLocalStateAdapter } from './local-adapter.ts';
import { createHttpStateAdapter } from './http-adapter.ts';
import { createRealtimeChannel } from './realtime-channel.ts';
import { UnauthorizedError } from './auth-adapter.ts';
import { expireStoredSession, sessionChangeEvent } from './session-storage.ts';
import { resolveDataSource, type ConnectionState, type StateAdapter } from './state-adapter.ts';

export type StateStatus = 'loading' | 'ready' | 'error';
export type DispatchResult = { ok: boolean; error?: string };

function createAdapter(): StateAdapter {
  // O adaptador local só é usado quando a suíte legada o solicita explicitamente.
  if (resolveDataSource() === 'http') return createHttpStateAdapter({ connect: createRealtimeChannel() });
  return createLocalStateAdapter();
}

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message, tone } }));
}

/**
 * Sessão recusada pela origem dos dados: vence o acesso, como se o prazo
 * tivesse acabado. Quem redireciona é a guarda de rota, que já observa isso.
 */
function handleUnauthorized(caught: unknown) {
  if (caught instanceof UnauthorizedError) expireStoredSession();
}

function useFrontendStateValue(initialState?: FrontendState) {
  const [state, setState] = useState<FrontendState>(initialState ?? initialFrontendState);
  const [status, setStatus] = useState<StateStatus>(initialState ? 'ready' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('online');
  // O estado inicial pode vir do servidor do Next (snapshot público, com cache
  // de até 30 s). Serve para a primeira pintura da área pública, não para as
  // telas internas: formulário que guarda o valor inicial capturava dado velho.
  const [fresh, setFresh] = useState(!initialState);
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
      setFresh(true);
    } catch (caught) {
      handleUnauthorized(caught);
      if (!mounted.current) return;
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os dados.');
      setStatus('error');
    }
  }, [absorb, adapter]);

  // O que chega pelo canal em tempo real também é um carregamento bem-sucedido.
  // Antes só o `refresh` limpava o erro: depois de uma queda curta do servidor
  // (um deploy), o canal voltava e trazia a edição, mas a tela continuava em
  // "Dados indisponíveis" até alguém tocar em "Tentar novamente".
  const absorbLive = useCallback((next: FrontendState) => {
    absorb(next);
    if (!mounted.current) return;
    setError(null);
    setStatus('ready');
    setFresh(true);
  }, [absorb]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const unsubscribe = adapter.subscribe(absorbLive, (next) => { if (mounted.current) setConnection(next); });
    return () => { mounted.current = false; unsubscribe(); };
  }, [absorbLive, adapter, refresh]);

  useEffect(() => {
    // Em erro, tenta de novo sozinho: quem está na quadra não deveria precisar
    // saber que o servidor reiniciou.
    if (status !== 'error' || source !== 'http') return;
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh, source, status]);

  useEffect(() => {
    // Preferência muda em outra tela do mesmo aparelho: todas acompanham.
    const sync = () => setState((current) => withDevicePreferences(current));
    window.addEventListener(preferencesChangeEvent, sync);
    return () => window.removeEventListener(preferencesChangeEvent, sync);
  }, []);

  useEffect(() => {
    if (source !== 'http') return;
    const syncScope = () => { void refresh(); };
    window.addEventListener(sessionChangeEvent, syncScope);
    return () => window.removeEventListener(sessionChangeEvent, syncScope);
  }, [refresh, source]);

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
  /**
   * `silent` cala os avisos automáticos: uma operação em lote (colar a lista
   * do elenco) mostra um resumo só no fim, em vez de um aviso por item.
   */
  const dispatch = useCallback(async (action: Action, options: { silent?: boolean } = {}): Promise<DispatchResult> => {
    try {
      const next = await adapter.apply(action);
      absorb(next);
      if (action.audit && !options.silent) toast(action.audit.action, 'success');
      return { ok: true };
    } catch (caught) {
      handleUnauthorized(caught);
      // O servidor manda o motivo em português ("O ranking geral está fechado",
      // "Você não tem permissão…"). Trocá-lo pelo texto genérico
      // transformava toda regra de negócio recusada num "tente novamente" que
      // nunca ia dar certo — e ninguém descobria o porquê.
      const message = caught instanceof Error && caught.message ? caught.message : 'Não foi possível salvar. Tente novamente.';
      if (!options.silent) toast(message, 'error');
      return { ok: false, error: message };
    }
  }, [absorb, adapter]);

  /**
   * Preferência do aparelho. Não é operação da edição: não vai ao servidor,
   * não entra na auditoria e não depende de conexão.
   */
  const setPreference = useCallback((patch: Partial<DevicePreferences>) => {
    writeDevicePreferences(patch);
    setState((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  }, []);

  return { state, status, error, hydrated: status === 'ready', fresh, source, connection, dispatch, setPreference, refresh };
}

type FrontendStateValue = ReturnType<typeof useFrontendStateValue>;

const FrontendStateContext = createContext<FrontendStateValue | null>(null);

export function FrontendStateProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: FrontendState;
}) {
  const value = useFrontendStateValue(initialState);
  return createElement(FrontendStateContext.Provider, { value }, children);
}

export function useFrontendState() {
  const value = useContext(FrontendStateContext);
  if (!value) throw new Error('useFrontendState precisa estar dentro de FrontendStateProvider');
  return value;
}
