'use client';

import { useEffect, useRef } from 'react';
import { useUi } from '../components/UiProvider';

/**
 * Intercepta a saída de uma tela com formulário preenchido.
 *
 * Quem navega, ao aceitar o descarte, é o próprio `<Link>` — o clique original é
 * repetido com uma trava para não reabrir o diálogo. Reconstruir a URL a partir
 * do DOM parecia equivalente e não é: `anchor.pathname` já vem com o `basePath`
 * (`/intereng` em produção) e o `router.push` prefixa de novo, produzindo uma
 * rota inexistente. O Next não trata isso como 404 suave: ele desiste da
 * navegação por RSC e faz `location.assign`, ou seja, uma navegação dura para
 * uma página de erro — que ainda por cima disparava o `beforeunload` ainda
 * armado, e era esse o segundo "quer mesmo sair?" que o usuário via antes de
 * perder o app. Repetir o clique também dispensa tratar origem externa,
 * `mailto:`, `download` e `target`, que o push manual quebrava em silêncio.
 */
export function useUnsavedChanges(dirty: boolean) {
  const { confirm } = useUi();
  const bypass = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    // Enquanto a saída aceita está em voo o hook sai de cena: nem o aviso do
    // navegador, nem um segundo diálogo por outro clique.
    let leaving = false;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (leaving) return; event.preventDefault(); event.returnValue = ''; };
    const intercept = (event: MouseEvent) => {
      if (bypass.current) { bypass.current = false; return; }
      if (leaving || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.origin !== window.location.origin) return;
      if (anchor.href === window.location.href || anchor.hash && anchor.pathname === window.location.pathname) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void confirm({ title: 'DESCARTAR ALTERAÇÕES?', message: 'As informações preenchidas nesta tela ainda não foram salvas.', confirmLabel: 'Descartar', tone: 'danger' }).then((accepted) => {
        if (!accepted || !anchor.isConnected) return;
        leaving = true;
        bypass.current = true;
        anchor.click();
      });
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', intercept, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', intercept, true); };
  }, [confirm, dirty]);
}
