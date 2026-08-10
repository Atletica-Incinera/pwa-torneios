'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };
type ConfirmOptions = { title: string; message: string; confirmLabel?: string; tone?: 'danger' | 'warning'; danger?: boolean };
type UiContextValue = { toast: (message: string, tone?: ToastTone) => void; confirm: (options: ConfirmOptions) => Promise<boolean> };
const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (answer: boolean) => void }) | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialog({ ...options, resolve });
  }), []);

  useEffect(() => {
    const onToast = (event: Event) => { const detail = (event as CustomEvent<{ message: string; tone?: ToastTone }>).detail; if (detail?.message) toast(detail.message, detail.tone); };
    const onAnnounce = (event: Event) => { const message = (event as CustomEvent<string>).detail; if (message) { setAnnouncement(''); window.requestAnimationFrame(() => setAnnouncement(message)); } };
    const onClick = (event: MouseEvent) => { const anchor = (event.target as HTMLElement).closest('a[href]'); if (anchor && !event.defaultPrevented && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) { setNavigating(true); window.setTimeout(() => setNavigating(false), 900); } };
    window.addEventListener('intereng:toast', onToast);
    window.addEventListener('intereng:announce', onAnnounce);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('intereng:toast', onToast); window.removeEventListener('intereng:announce', onAnnounce); document.removeEventListener('click', onClick, true); };
  }, [toast]);
  useEffect(() => { if (dialog) confirmRef.current?.focus(); }, [dialog]);
  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); answer(false); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [dialog]);

  function answer(value: boolean) { const current = dialog; setDialog(null); current?.resolve(value); window.requestAnimationFrame(() => openerRef.current?.focus()); }
  function skipToMain(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return;
    if (!main.id) main.id = 'app-main';
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
    main.scrollIntoView?.({ block: 'start' });
  }
  return <UiContext.Provider value={{ toast, confirm }}>
    <a href="#app-main" className="skip-link" onClick={skipToMain}>Pular para o conteúdo</a>
    <div className={`route-progress${navigating ? ' is-active' : ''}`} aria-hidden="true" />
    <div className="sr-only" aria-live="assertive" aria-atomic="true">{announcement}</div>
    {children}
    <div className="toast-region" aria-live="polite" aria-atomic="false">{toasts.map((item) => { const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertTriangle : Info; return <div className={`app-toast toast-${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'} key={item.id}><Icon size={19} /><span>{item.message}</span><button type="button" onClick={() => setToasts((current) => current.filter((entry) => entry.id !== item.id))} aria-label="Fechar mensagem"><X size={17} /></button></div>; })}</div>
    {dialog ? <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) answer(false); }}><section ref={dialogRef} className={`app-dialog dialog-${dialog.danger ? 'danger' : dialog.tone ?? 'warning'}`} role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"><AlertTriangle size={30} aria-hidden="true" /><h2 id="app-dialog-title">{dialog.title}</h2><p id="app-dialog-message">{dialog.message}</p><div><button type="button" className="secondary-button" onClick={() => answer(false)}>Cancelar</button><button ref={confirmRef} type="button" className="primary-button" onClick={() => answer(true)}>{dialog.confirmLabel ?? 'Confirmar'}</button></div></section></div> : null}
  </UiContext.Provider>;
}

export function useUi() { const value = useContext(UiContext); if (!value) throw new Error('useUi precisa estar dentro de UiProvider'); return value; }
