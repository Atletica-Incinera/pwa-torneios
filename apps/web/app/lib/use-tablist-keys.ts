'use client';

import { useCallback, type KeyboardEvent } from 'react';

/**
 * Navegação por teclado num conjunto de abas, como manda o padrão ARIA:
 * ←/→ andam entre as abas (com volta nas pontas) e Home/End vão às extremidades.
 * Sem isso, `role="tab"` só respondia a Tab + Enter.
 */
export function useTablistKeys<T extends string>(ids: readonly T[], active: T, onChange: (id: T) => void) {
  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const index = ids.indexOf(active);
    if (index < 0 || !ids.length) return;

    if (step) {
      event.preventDefault();
      onChange(ids[(index + step + ids.length) % ids.length]);
      return;
    }
    if (event.key === 'Home') { event.preventDefault(); onChange(ids[0]); return; }
    if (event.key === 'End') { event.preventDefault(); onChange(ids[ids.length - 1]); }
  }, [active, ids, onChange]);
}
