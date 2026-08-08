'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUi } from '../components/UiProvider';

export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter(); const { confirm } = useUi();
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const intercept = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.href === window.location.href || anchor.hash && anchor.pathname === window.location.pathname) return;
      event.preventDefault(); event.stopImmediatePropagation();
      confirm({ title: 'DESCARTAR ALTERAÇÕES?', message: 'As informações preenchidas nesta tela ainda não foram salvas.', confirmLabel: 'Descartar', tone: 'danger' }).then((accepted) => { if (accepted) router.push(`${anchor.pathname}${anchor.search}${anchor.hash}`); });
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', intercept, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', intercept, true); };
  }, [confirm, dirty, router]);
}
