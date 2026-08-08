'use client';

import { Download, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
export function PwaRegistration() {
  const [online, setOnline] = useState(true); const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null); const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message: 'Conexão restabelecida.', tone: 'success' } })); };
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); window.addEventListener('beforeinstallprompt', onInstall);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch(() => undefined);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeinstallprompt', onInstall); };
  }, []);
  async function install() { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }
  if (online && (!installPrompt || dismissed)) return null;
  return <aside className={`pwa-banner${online ? ' can-install' : ' is-offline'}`} role="status">{online ? <Download size={18} /> : <WifiOff size={18} />}<span>{online ? 'Instale o InterEng para abrir mais rápido.' : 'Você está offline. Dados já carregados continuam disponíveis.'}</span>{online ? <button type="button" onClick={install}>Instalar</button> : null}{online ? <button type="button" className="pwa-dismiss" onClick={() => setDismissed(true)} aria-label="Dispensar instalação"><X size={16} /></button> : null}</aside>;
}
