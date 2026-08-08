const VERSION = 'intereng-v3';
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const PRE_CACHE = ['/offline', '/public', '/public/matches', '/public/teams', '/public/tournaments', '/icon.svg'];

self.addEventListener('install', (event) => event.waitUntil(caches.open(PAGE_CACHE).then((cache) => cache.addAll(PRE_CACHE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))).then(() => self.clients.claim())));

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
  if (event.request.mode === 'navigate') { event.respondWith(networkFirst(event.request)); return; }
  const destination = event.request.destination;
  if (['image', 'font', 'style', 'script'].includes(destination)) event.respondWith(staleWhileRevalidate(event.request));
});
