import { readActor, readFrontendState, stateChangeEvent, writeFrontendState, type FrontendState } from '../frontend-state.ts';
import { applyAction } from './reducer.ts';
import type { StateAdapter } from './state-adapter.ts';
import type { Action } from './actions.ts';

/**
 * Estado no `localStorage` do próprio navegador — o comportamento que o app tem
 * hoje. Continua sendo a origem usada pelos testes e2e depois que o adaptador
 * HTTP existir, para a suíte não depender de servidor.
 */
export function createLocalStateAdapter(): StateAdapter {
  return {
    async load() {
      // Primeiro carregamento devolve a semente da edição; depois, o que foi gravado.
      return readFrontendState();
    },

    async apply(action: Action) {
      // Lê na hora de gravar: outra aba pode ter mudado o estado neste meio-tempo.
      const current = readFrontendState();
      const next = applyAction(current, action, { actor: readActor() });
      if (next === current) return current;
      writeFrontendState(next);
      return next;
    },

    subscribe(onRemoteChange) {
      // `storage` cobre outra aba; o evento próprio cobre esta mesma aba.
      const sync = () => onRemoteChange(readFrontendState());
      window.addEventListener(stateChangeEvent, sync);
      window.addEventListener('storage', sync);
      return () => {
        window.removeEventListener(stateChangeEvent, sync);
        window.removeEventListener('storage', sync);
      };
    },
  };
}
