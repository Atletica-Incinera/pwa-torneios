'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };
type ConfirmOptions = { title: string; message: string; confirmLabel?: string; tone?: 'danger' | 'warning'; danger?: boolean };
type UiContextValue = { toast: (message: string, tone?: ToastTone) => void; confirm: (options: ConfirmOptions) => Promise<boolean> };
const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (answer: boolean) => void }) | null>(null);
  const [navigating, setNavigating] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...options, resolve })), []);

  useEffect(() => {
    const onToast = (event: Event) => { const detail = (event as CustomEvent<{ message: string; tone?: ToastTone }>).detail; if (detail?.message) toast(detail.message, detail.tone); };
    const onClick = (event: MouseEvent) => { const anchor = (event.target as HTMLElement).closest('a[href]'); if (anchor && !event.defaultPrevented && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) { setNavigating(true); window.setTimeout(() => setNavigating(false), 900); } };
    window.addEventListener('intereng:toast', onToast);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('intereng:toast', onToast); document.removeEventListener('click', onClick, true); };
  }, [toast]);
  useEffect(() => { if (dialog) confirmRef.current?.focus(); }, [dialog]);
  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') answer(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [dialog]);

  function answer(value: boolean) { const current = dialog; setDialog(null); current?.resolve(value); }
  return <UiContext.Provider value={{ toast, confirm }}>
    <a href="#app-main" className="skip-link">Pular para o conteúdo</a>
    <div className={`route-progress${navigating ? ' is-active' : ''}`} aria-hidden="true" />
    {children}
    <div className="toast-region" aria-live="polite" aria-atomic="false">{toasts.map((item) => { const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertTriangle : Info; return <div className={`app-toast toast-${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'} key={item.id}><Icon size={19} /><span>{item.message}</span><button type="button" onClick={() => setToasts((current) => current.filter((entry) => entry.id !== item.id))} aria-label="Fechar mensagem"><X size={17} /></button></div>; })}</div>
    {dialog ? <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) answer(false); }}><section className={`app-dialog dialog-${dialog.danger ? 'danger' : dialog.tone ?? 'warning'}`} role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"><AlertTriangle size={30} /><h2 id="app-dialog-title">{dialog.title}</h2><p id="app-dialog-message">{dialog.message}</p><div><button type="button" className="secondary-button" onClick={() => answer(false)}>Cancelar</button><button ref={confirmRef} type="button" className="primary-button" onClick={() => answer(true)}>{dialog.confirmLabel ?? 'Confirmar'}</button></div></section></div> : null}
  </UiContext.Provider>;
}

export function useUi() { const value = useContext(UiContext); if (!value) throw new Error('useUi precisa estar dentro de UiProvider'); return value; }
