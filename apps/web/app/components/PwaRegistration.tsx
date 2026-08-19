'use client';

import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { appPath } from '../lib/base-path';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const installDismissedKey = 'intereng:pwa-install-dismissed';

export function PwaRegistration() {
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const reloadAfterUpdate = useRef(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setInstallDismissed(window.sessionStorage.getItem(installDismissedKey) === 'true');
    const onOnline = () => { setOnline(true); window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message: 'Conexão restabelecida.', tone: 'success' } })); };
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    let refreshing = false;
    const onControllerChange = () => { if (reloadAfterUpdate.current && !refreshing) { refreshing = true; window.location.reload(); } };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      // O escopo é declarado junto: sem ele o service worker registrado em
      // `/intereng/sw.js` só controlaria esse diretório por acaso, e sem o
      // prefixo o navegador pediria `/sw.js` na raiz do domínio — que em
      // produção é de outro site.
      navigator.serviceWorker.register(appPath('/sw.js'), { scope: appPath('/') }).then((registration) => {
        if (registration.waiting) setUpdateWorker(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateWorker(worker);
          });
        });
        void registration.update();
      }).catch(() => undefined);
    } else if ('serviceWorker' in navigator) {
      // Um SW de produção pode continuar registrado no mesmo host usado pelo
      // `next dev`, servindo chunks antigos e causando 403 no HMR. O ambiente
      // de desenvolvimento deve sempre voltar ao servidor local.
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
      if ('caches' in window) void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstall);
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function dismissInstall() {
    window.sessionStorage.setItem(installDismissedKey, 'true');
    setInstallDismissed(true);
  }

  function applyUpdate() {
    reloadAfterUpdate.current = true;
    updateWorker?.postMessage({ type: 'SKIP_WAITING' });
  }

  const canInstall = Boolean(installPrompt && !installDismissed);
  if (online && !canInstall && !updateWorker) return null;
  const mode = !online ? 'offline' : updateWorker ? 'update' : 'install';
  return (
    <aside className={`pwa-banner ${mode === 'install' ? 'can-install' : mode === 'offline' ? 'is-offline' : 'has-update'}`} role="status" aria-live="polite">
      {mode === 'offline' ? <WifiOff size={18} aria-hidden="true" /> : mode === 'update' ? <RefreshCw size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
      <span>{mode === 'offline' ? 'Você está offline. Dados já carregados continuam disponíveis.' : mode === 'update' ? 'Uma nova versão do InterEng está pronta.' : 'Instale o InterEng para abrir mais rápido.'}</span>
      {mode === 'update' ? <button type="button" onClick={applyUpdate}>Atualizar</button> : null}
      {mode === 'install' ? <button type="button" onClick={install}>Instalar</button> : null}
      {mode === 'install' ? <button type="button" className="pwa-dismiss" onClick={dismissInstall} aria-label="Dispensar instalação"><X size={16} /></button> : null}
    </aside>
  );
}
