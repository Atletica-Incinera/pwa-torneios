const VERSION = 'intereng-v9';
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const PUBLIC_DATA_CACHE = `${VERSION}-public-data`;
// Em produção o app é servido sob /intereng. O escopo do próprio registro é a
// única fonte desse prefixo que não exige injetá-lo na compilação, e sem ele
// todo caminho aqui apontava para a raiz do domínio: o pré-cache falhava
// inteiro (uma URL ausente derruba o `addAll`) e a página pública nunca era
// reconhecida como pública.
const SCOPE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const app = (path) => `${SCOPE}${path}`;
const OFFLINE_PAGE = app('/offline');
const PRE_CACHE = [
  OFFLINE_PAGE,
  app('/public'),
  app('/public/teams'),
  app('/public/tournaments'),
  app('/public/standings/general'),
  app('/icon.svg'),
  app('/icon-192.png'),
  app('/icon-512.png'),
  app('/icon-maskable-512.png'),
  app('/apple-touch-icon.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGE_CACHE).then((cache) => cache.addAll(PRE_CACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function appRoute(pathname) {
  return SCOPE && pathname.startsWith(SCOPE) ? pathname.slice(SCOPE.length) || '/' : pathname;
}

function isPublicPage(pathname) {
  const route = appRoute(pathname);
  return route === '/public' || route.startsWith('/public/');
}

function isPublicSnapshot(pathname) {
  // Sem âncora no início: em produção a API vive sob outro prefixo do mesmo
  // domínio (/intereng-api/api/v1), e a versão ancorada nunca casava — o
  // snapshot público simplesmente não era guardado para o modo offline.
  return /\/api(?:\/v1)?\/editions\/[^/]+\/public-snapshot$/.test(pathname);
}

function canStore(request, response) {
  return !request.headers.has('authorization') && response?.ok && response.type !== 'opaque';
}

function canStorePublicAsset(request, response) {
  return !request.headers.has('authorization') && (response?.ok || response?.type === 'opaque');
}

async function publicPageNetworkFirst(request) {
  try {
    const response = await fetch(request);
    if (canStore(request, response)) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match(OFFLINE_PAGE)) || Response.error();
  }
}

async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_PAGE)) || Response.error();
  }
}

async function publicSnapshotNetworkFirst(request) {
  const cache = await caches.open(PUBLIC_DATA_CACHE);
  try {
    const response = await fetch(request);
    if (canStore(request, response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || new Response(
      JSON.stringify({ error: { code: 'OFFLINE', message: 'Snapshot público indisponível offline.' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

async function assetStaleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then(async (response) => {
      // Logotipos S3/MinIO são públicos e chegam como resposta opaca quando a
      // imagem é cross-origin. O Cache Storage pode preservá-los para o offline.
      if (canStorePublicAsset(request, response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Nunca intercepta snapshot privado nem qualquer requisição autenticada.
  if (request.headers.has('authorization')) return;

  if (isPublicSnapshot(url.pathname)) {
    event.respondWith(publicSnapshotNetworkFirst(request));
    return;
  }

  if (!sameOrigin) {
    if (request.destination === 'image') event.respondWith(assetStaleWhileRevalidate(request));
    return;
  }
  // Chunks do Next/HMR nunca entram no cache do PWA para não sobreviver a builds.
  if (appRoute(url.pathname).startsWith('/_next/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      isPublicPage(url.pathname)
        ? publicPageNetworkFirst(request)
        : networkOnlyWithOfflineFallback(request),
    );
    return;
  }

  // Navegações internas do App Router pedem RSC em vez de um documento HTML.
  if (request.headers.has('rsc') && isPublicPage(url.pathname)) {
    event.respondWith(publicPageNetworkFirst(request));
    return;
  }

  const destination = request.destination;
  if (['image', 'font', 'style', 'script'].includes(destination)) {
    event.respondWith(assetStaleWhileRevalidate(request));
  }
});
