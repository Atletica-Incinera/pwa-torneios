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
  /** Executa uma operação e devolve o estado resultante, que é a verdade. */
  apply(action: Action, current: FrontendState): Promise<FrontendState>;
  /** Avisa quando o estado mudou por fora (outra aba hoje, socket depois). */
  subscribe(onRemoteChange: (next: FrontendState) => void): () => void;
};

export type DataSource = 'local' | 'http';

/** Origem dos dados escolhida por ambiente. Só `local` existe até a Fase 5. */
export function resolveDataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === 'http' ? 'http' : 'local';
}
