import type { FrontendState } from '@atletica-incinera/intereng-contract/state';
import type { Action } from '@atletica-incinera/intereng-contract/actions';

/**
 * A fronteira entre as telas e a origem dos dados.
 *
 * Duas implementações satisfazem esta interface: `localStorage` e HTTP. A
 * escolha é de ambiente, e nenhuma tela precisa saber de onde o dado veio.
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
   * Avisa quando o estado mudou por fora (outra aba, ou o socket da API) e
   * quando a ligação com a origem cai ou volta.
   */
  subscribe(onRemoteChange: (next: FrontendState) => void, onConnection?: (state: ConnectionState) => void): () => void;
};

/** A ligação com a origem dos dados. No modo local está sempre de pé. */
export type ConnectionState = 'online' | 'offline';

export type DataSource = 'local' | 'http';

/**
 * Origem dos dados escolhida por ambiente. `http` é o alvo do build de e2e
 * contra a API; `local` é o padrão e o que os e2e de navegador usam.
 */
export function resolveDataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === 'http' ? 'http' : 'local';
}
