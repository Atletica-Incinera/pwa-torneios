const VERSION = 'intereng-v8';
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const PUBLIC_DATA_CACHE = `${VERSION}-public-data`;
const OFFLINE_PAGE = '/offline';
const PRE_CACHE = [
  OFFLINE_PAGE,
  '/public',
  '/public/teams',
  '/public/tournaments',
  '/public/standings/general',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
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

function isPublicPage(pathname) {
  return pathname === '/public' || pathname.startsWith('/public/');
}

function isPublicSnapshot(pathname) {
  return /^\/api(?:\/v1)?\/editions\/[^/]+\/public-snapshot$/.test(pathname);
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
  if (url.pathname.startsWith('/_next/')) return;

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
