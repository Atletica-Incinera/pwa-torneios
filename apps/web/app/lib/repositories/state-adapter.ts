import type { FrontendState } from '../frontend-state.ts';
import type { Action } from './actions.ts';

/**
 * A fronteira entre as telas e a origem dos dados.
 *
 * Hoje existe uma implementação (`localStorage`). Quando o backend entrar, a
 * implementação HTTP satisfaz esta mesma interface e a escolha passa a ser de
 * ambiente — nenhuma tela precisa saber de onde o dado veio.
 */
export type StateAdapter = {
  /** Snapshot completo da edição. */
  load(): Promise<FrontendState>;
  /**
   * Executa uma operação e devolve o estado resultante, que é a verdade.
   * Quem aplica é quem sabe do estado atual — o cliente não o carrega junto.
   */
  apply(action: Action): Promise<FrontendState>;
  /**
   * Avisa quando o estado mudou por fora (outra aba, ou uma revisão da API) e
   * quando a ligação com a origem cai ou volta.
   */
  subscribe(onRemoteChange: (next: FrontendState) => void, onConnection?: (state: ConnectionState) => void): () => void;
};

/** A ligação com a origem dos dados. No modo local está sempre de pé. */
export type ConnectionState = 'online' | 'offline';

export type DataSource = 'local' | 'http';

/** Origem dos dados escolhida por ambiente. */
export function resolveDataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === 'http' ? 'http' : 'local';
}
