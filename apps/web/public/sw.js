const VERSION = 'intereng-v7';
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGES = ['/offline', '/public', '/public/teams', '/public/tournaments', '/public/standings/general'];
const ICONS = ['/icon.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'];
// Os escudos são a identidade visual de quase toda tela. Sem eles aqui,
// entravam no cache só depois de a equipe ter sido vista uma vez, e a
// primeira abertura offline mostrava imagem quebrada em toda parte.
// `tests/unit/service-worker.test.ts` confere que esta lista bate com a pasta.
const BADGES = ['/teams/alcateia.webp', '/teams/cangaceiros.webp', '/teams/caotica.webp', '/teams/energizada.webp', '/teams/engenhosa.webp', '/teams/graxeiros.webp', '/teams/incinera.webp', '/teams/invasora.webp', '/teams/invocados.webp', '/teams/radioativa.webp', '/teams/reativa.webp', '/teams/soberana.webp', '/teams/thenebrosa.webp', '/teams/tubaroes.webp', '/teams/voraz.webp', '/teams/zangada.webp'];
const ASSETS = [...ICONS, ...BADGES];

// Página e recurso vão para caches diferentes porque são servidos por
// estratégias diferentes: `networkFirst` procura no de páginas,
// `staleWhileRevalidate` no de recursos. Guardar tudo num só faria o
// pré-cache não ser encontrado por quem mais precisa dele — o caminho da
// imagem, que é o que fica sem rede.
self.addEventListener('install', (event) => event.waitUntil(Promise.all([
  caches.open(PAGE_CACHE).then((cache) => cache.addAll(PAGES)),
  caches.open(ASSET_CACHE).then((cache) => cache.addAll(ASSETS)),
])));
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
