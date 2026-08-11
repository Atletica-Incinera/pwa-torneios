const VERSION = 'intereng-v6';
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const PRE_CACHE = ['/offline', '/public', '/public/teams', '/public/tournaments', '/public/standings/general', '/icon.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => event.waitUntil(caches.open(PAGE_CACHE).then((cache) => cache.addAll(PRE_CACHE))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) { const cache = await caches.open(PAGE_CACHE); await cache.put(request, response.clone()); }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('/offline'));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request).then((response) => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => cached);
  return cached || fresh;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  // Chunks do Next/HMR nunca devem entrar no cache do PWA. Em desenvolvimento
  // isso evita servir artefatos antigos depois de um rebuild.
  if (new URL(event.request.url).pathname.startsWith('/_next/')) return;
  if (event.request.mode === 'navigate') { event.respondWith(networkFirst(event.request)); return; }
  const destination = event.request.destination;
  if (['image', 'font', 'style', 'script'].includes(destination)) event.respondWith(staleWhileRevalidate(event.request));
});
