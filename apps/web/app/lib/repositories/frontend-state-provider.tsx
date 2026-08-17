'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialFrontendState, type FrontendState } from '@atletica-incinera/intereng-contract/state';
import type { Action } from '@atletica-incinera/intereng-contract/actions';
import { collectMatchNotifications, showMatchNotifications } from '../match-notifications.ts';
import { scopeChangeEvent } from './active-scope.ts';
import { preferencesChangeEvent, withDevicePreferences, writeDevicePreferences, type DevicePreferences } from './device-preferences.ts';
import { createLocalStateAdapter } from './local-adapter.ts';
import { createHttpStateAdapter } from './http-adapter.ts';
import { createRealtimeChannel } from './realtime-channel.ts';
import { UnauthorizedError } from './auth-adapter.ts';
import { expireStoredSession, readStoredSession, sessionChangeEvent } from './session-storage.ts';
import { resolveDataSource, type ConnectionState, type StateAdapter } from './state-adapter.ts';

/**
 * O estado da edição, uma vez só para o app inteiro.
 *
 * Antes cada `useFrontendState()` criava o próprio adaptador e a própria
 * conexão de tempo real. Como a árvore de uma tela administrativa monta o hook
 * na página, na moldura, na guarda e na barra inferior, uma rota como
 * `/teams/[id]` abria **sete** conexões e disparava sete vezes a mesma
 * requisição de snapshot — contra um teto de seis conexões por origem no
 * navegador. As últimas ficavam na fila atrás de streams que nunca fecham.
 *
 * Pior que o desperdício: eram sete cópias independentes do estado, que podiam
 * divergir, e o botão de nova tentativa da tela de erro recompunha só a cópia
 * da guarda — as outras continuavam em erro, e a tela aparecia com o estado
 * inicial, que não é vazio.
 */
export type StateStatus = 'loading' | 'ready' | 'error';
export type DispatchResult = { ok: boolean; error?: string };

type FrontendStateValue = {
  state: FrontendState;
  status: StateStatus;
  error: string | null;
  hydrated: boolean;
  source: ReturnType<typeof resolveDataSource>;
  connection: ConnectionState;
  dispatch: (action: Action) => Promise<DispatchResult>;
  setPreference: (patch: Partial<DevicePreferences>) => void;
  refresh: () => Promise<void>;
};

const FrontendStateContext = createContext<FrontendStateValue | null>(null);

function createAdapter(): StateAdapter {
  // A origem é escolhida por ambiente: os e2e continuam no adaptador local.
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

/**
 * Quem está pedindo os dados, agora.
 *
 * É o token **e** o escopo em uso: os dois decidem o que a carga devolve. O
 * token diz de quem é a sessão; o escopo diz por qual dos papéis dela o app
 * está atuando, e no modo `http` é ele que resolve a edição a carregar e o que
 * o servidor concede — `GET /editions/:id/staff-roles`, por exemplo, só
 * responde a quem administra aquela edição.
 */
function currentIdentity() {
  const session = readStoredSession();
  return `${session?.token ?? ''}|${session?.activeScopeId ?? ''}`;
}

export function FrontendStateProvider({ children, adapter: injected }: { children: React.ReactNode; adapter?: StateAdapter }) {
  const [state, setState] = useState<FrontendState>(initialFrontendState);
  const [status, setStatus] = useState<StateStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('online');
  // O adaptador injetado existe para teste: sem ele, a origem vem do ambiente.
  const adapter = useMemo(() => injected ?? createAdapter(), [injected]);
  const source = useMemo(resolveDataSource, []);
  const mounted = useRef(true);
  const lastSnapshot = useRef<FrontendState | null>(null);
  /**
   * Ordem das absorções, no mesmo padrão que o canal de tempo real já usa para
   * os seus próprios refetches.
   *
   * Sem isto, um snapshot pedido antes e entregue depois sobrescreve um mais
   * novo. O caso que dói é o placar ao vivo: cada toque despacha uma ação e
   * absorve a resposta do servidor, enquanto uma busca disparada segundos antes
   * ainda está no ar — e ao chegar, desfaz o gol na tela.
   */
  const issued = useRef(0);
  const applied = useRef(0);

  /** Devolve se absorveu: quem chegou tarde não deve nem notificar. */
  const absorb = useCallback((next: FrontendState, ticket: number) => {
    if (ticket < applied.current) return false;
    applied.current = ticket;
    // O que a tela lê é o estado da edição com as preferências deste aparelho.
    lastSnapshot.current = next;
    if (mounted.current) setState(withDevicePreferences(next));
    return true;
  }, []);

  /**
   * Mudança vinda de fora: além de absorver, pode valer um aviso.
   *
   * Só aqui, e não em `absorb`: a carga inicial não tem o que comparar, e a
   * própria escrita não deve notificar quem acabou de fazê-la.
   */
  const absorbRemote = useCallback((next: FrontendState) => {
    const before = lastSnapshot.current;
    // Chegou agora: é o mais recente que existe, e leva o bilhete mais alto.
    if (!absorb(next, ++issued.current)) return;
    if (!before) return;
    const { notifications, selectedDiscipline } = withDevicePreferences(next).preferences;
    if (!notifications) return;
    void showMatchNotifications(collectMatchNotifications(before, next, { discipline: selectedDiscipline }));
  }, [absorb]);

  const refresh = useCallback(async () => {
    const ticket = ++issued.current;
    try {
      const loaded = await adapter.load();
      if (!mounted.current) return;
      absorb(loaded, ticket);
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
    const unsubscribe = adapter.subscribe(absorbRemote, (next) => { if (mounted.current) setConnection(next); });
    return () => { mounted.current = false; unsubscribe(); };
  }, [absorbRemote, adapter, refresh]);

  useEffect(() => {
    // Preferência muda em outra tela do mesmo aparelho: todas acompanham.
    const sync = () => setState((current) => withDevicePreferences(current));
    window.addEventListener(preferencesChangeEvent, sync);
    return () => window.removeEventListener(preferencesChangeEvent, sync);
  }, []);

  useEffect(() => {
    /**
     * Entrar e sair precisam recarregar o estado.
     *
     * O provider vive no layout raiz, que não remonta na navegação do App
     * Router: sem isto, o snapshot público carregado na tela de login
     * sobreviveria ao login — o operador entraria e veria a visão do
     * espectador, sem staff, sem auditoria e sem rascunho. E na saída seria o
     * contrário: rascunho e staff continuariam na tela pública.
     *
     * O gatilho é a **troca de identidade**, não o evento em si. Vencer a
     * sessão emite o mesmo evento preservando o token; recarregar ali levaria a
     * outro 401, que venceria de novo, sem fim.
     *
     * Trocar de escopo entra no mesmo gancho, e por isto: é a mesma pergunta —
     * "quem está pedindo mudou?" — e a resposta muda o que a carga traz. No
     * modo `http` o escopo escolhe a edição a remontar e decide o que o
     * servidor concede; sem recarregar, a pessoa passaria a admin de uma edição
     * continuando a ver os dados da outra. Comparar o valor, e não reagir ao
     * evento, é o que impede o laço: um evento de escopo que não mudou nada não
     * recarrega nada.
     */
    let identity = currentIdentity();
    const sync = () => {
      const next = currentIdentity();
      if (next === identity) return;
      identity = next;
      void refresh();
    };
    window.addEventListener(sessionChangeEvent, sync);
    window.addEventListener(scopeChangeEvent, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(sessionChangeEvent, sync); window.removeEventListener(scopeChangeEvent, sync); window.removeEventListener('storage', sync); };
  }, [refresh]);

  useEffect(() => {
    // Conexão é obrigatória para ver em tempo real: quando ela volta, recarrega.
    if (source !== 'http') return;
    const offline = () => setConnection('offline');
    const online = () => { setConnection('online'); void refresh(); };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); };
  }, [refresh, source]);

  /** Executa uma operação nomeada. É o único caminho de escrita do app. */
  const dispatch = useCallback(async (action: Action): Promise<DispatchResult> => {
    const ticket = ++issued.current;
    try {
      const next = await adapter.apply(action);
      absorb(next, ticket);
      if (action.audit) toast(action.audit.action, 'success');
      return { ok: true };
    } catch (caught) {
      handleUnauthorized(caught);
      // A mensagem do servidor é a interface: o despachante da API responde 501
      // para a operação que ainda não existe lá, e é esse texto que faz o
      // operador parar de tentar. Um literal fixo no lugar dele o faria repetir
      // a mesma ação para sempre, achando que é a rede.
      const message = caught instanceof Error ? caught.message : 'Não foi possível salvar. Tente novamente.';
      toast(message, 'error');
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

  const value = useMemo<FrontendStateValue>(
    () => ({ state, status, error, hydrated: status === 'ready', source, connection, dispatch, setPreference, refresh }),
    [connection, dispatch, error, refresh, setPreference, source, state, status],
  );

  return <FrontendStateContext.Provider value={value}>{children}</FrontendStateContext.Provider>;
}

/**
 * O estado da edição.
 *
 * Fora do provider isto lança, e é o que se quer: um componente que monte
 * sozinho leria o estado inicial — que **não** é vazio, traz a competição e as
 * edições — e renderizaria uma edição plausível e sem dados, sem nenhum aviso.
 * Falhar alto na montagem é melhor que uma tela que parece carregada.
 */
export function useFrontendState() {
  const value = useContext(FrontendStateContext);
  if (!value) throw new Error('useFrontendState precisa estar dentro de FrontendStateProvider');
  return value;
}
