import type { FrontendState } from '@atletica-incinera/intereng-contract/state';
import { readActor, readFrontendState, stateChangeEvent, writeFrontendState } from '../browser-state.ts';
import { applyAction, type Action } from '@atletica-incinera/intereng-contract/actions';
import type { StateAdapter } from './state-adapter.ts';

/**
 * Estado no `localStorage` do próprio navegador. É a origem padrão e a que os
 * e2e de navegador (`tests/e2e/`) usam, para aquela suíte não depender de
 * servidor de pé. A de modo http (`tests/e2e-http/`) roda contra o adaptador
 * HTTP de propósito — a escolha é por ambiente, não por evolução do projeto.
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
