const VERSION = 'intereng-v8';
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGES = ['/offline', '/public', '/public/teams', '/public/tournaments', '/public/standings/general'];
const ICONS = ['/icon.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'];
// Os escudos são a identidade visual de quase toda tela. Sem eles aqui,
// entravam no cache só depois de a equipe ter sido vista uma vez, e a
// primeira abertura offline mostrava imagem quebrada em toda parte.
// `tests/unit/service-worker.test.ts` confere que esta lista bate com a pasta.
const BADGES = ['/teams/alcateia.webp', '/teams/cangaceiros.webp', '/teams/caotica.webp', '/teams/energizada.webp', '/teams/engenhosa.webp', '/teams/graxeiros.webp', '/teams/incinera.webp', '/teams/invasora.webp', '/teams/invocados.webp', '/teams/radioativa.webp', '/teams/reativa.webp', '/teams/soberana.webp', '/teams/thenebrosa.webp', '/teams/tubaroes.webp', '/teams/voraz.webp', '/teams/zangada.webp'];
// Os sons ficam **fora** do pré-cache. São 5,9 MB contra 0,5 MB de todo o
// resto, e baixá-los na instalação atinge quem só quer ver o placar da
// arquibancada — além de derrubar o navegador quando muitos contextos instalam
// o worker em sequência, que foi como isto apareceu na suíte.
// Quem precisa deles é o mesário, e ele os aquece no momento certo:
// `warmSportsSounds()` (`app/lib/sound-effects.ts`) carrega o elenco inteiro ao
// abrir o placar ao vivo com som ligado — ainda com rede, antes de a do ginásio
// cair. Como `new Audio()` pede com `destination: 'audio'`, o
// `staleWhileRevalidate` abaixo os guarda a partir daí.
const ASSETS = [...ICONS, ...BADGES];

// Página e recurso vão para caches diferentes porque são servidos por
// estratégias diferentes: `networkFirst` procura no de páginas,
// `staleWhileRevalidate` no de recursos. Guardar tudo num só faria o
// pré-cache não ser encontrado por quem mais precisa dele — o caminho da
// imagem, que é o que fica sem rede.
// Os sons entram no mesmo cache de recursos, para o `staleWhileRevalidate`
// achá-los, mas por uma promessa própria e com a falha engolida: são 6 MB
// contra 0,5 MB de todo o resto, e um `addAll` que rejeita derruba a instalação
// inteira do service worker. Trocar o app offline por um efeito sonoro seria
// mau negócio — o que faltar aqui é recuperado na primeira reprodução com rede.
self.addEventListener('install', (event) => event.waitUntil(Promise.all([
  caches.open(PAGE_CACHE).then((cache) => cache.addAll(PAGES)),
  caches.open(ASSET_CACHE).then((cache) => cache.addAll(ASSETS)),
])));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

// Aviso enviado pelo servidor. Hoje ninguém envia — a API ainda não tem rota de
// inscrição — mas o handler existe para o dia em que tiver, e porque sem ele o
// navegador mostra a notificação genérica dele em vez da nossa.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : '' }; }
  const title = payload.title || 'InterEng';
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || '',
    tag: payload.tag || 'intereng',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.url || '/public' },
  }));
});

// Clicar no aviso deve trazer a janela que já existe para a frente, não abrir
// uma segunda cópia do app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/public';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.focus();
      if ('navigate' in client) await client.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});

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
  // `status === 200` e não `ok`: mídia costuma ser pedida por faixa, e guardar
  // um 206 é proibido pelo Cache API — `cache.put` rejeitaria sozinho, longe de
  // qualquer `catch`, e o pedaço nunca substituiria o arquivo inteiro do
  // pré-cache.
  const fresh = fetch(request).then((response) => { if (response.status === 200) cache.put(request, response.clone()); return response; }).catch(() => cached);
  return cached || fresh;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  // Chunks do Next/HMR nunca devem entrar no cache do PWA. Em desenvolvimento
  // isso evita servir artefatos antigos depois de um rebuild.
  if (new URL(event.request.url).pathname.startsWith('/_next/')) return;
  if (event.request.mode === 'navigate') { event.respondWith(networkFirst(event.request)); return; }
  const destination = event.request.destination;
  // `'audio'` é o `destination` de `new Audio(src)`. Sem ele o pré-cache dos
  // sons nunca seria consultado, e a lista acima não serviria para nada.
  if (['image', 'font', 'style', 'script', 'audio'].includes(destination)) event.respondWith(staleWhileRevalidate(event.request));
});
