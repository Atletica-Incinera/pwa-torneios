import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * O service worker é JavaScript solto, servido como está: não passa pelo
 * compilador e nenhum import o liga ao resto do projeto. Sem esta conferência,
 * somar um escudo em `public/teams` e esquecer de listá-lo no pré-cache não
 * quebra nada — só faz a imagem sumir na primeira abertura offline, meses
 * depois, sem erro nenhum.
 */
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = readFileSync(resolve(web, 'public/sw.js'), 'utf8');

function listed(constant: string) {
  const match = new RegExp(`const ${constant} = \\[([^\\]]*)\\]`).exec(source);
  assert.ok(match, `${constant} não encontrado em sw.js`);
  return match[1].split(',').map((entry) => entry.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

test('todo escudo da pasta está no pré-cache do service worker', () => {
  const onDisk = readdirSync(resolve(web, 'public/teams')).map((file) => `/teams/${file}`);
  const badges = listed('BADGES');
  assert.deepEqual([...badges].sort(), [...onDisk].sort());
});

/**
 * Os sons não entram no pré-cache — são 5,9 MB, e a explicação está no `sw.js`.
 * O que precisa continuar amarrado é a tabela do app à pasta: um arquivo
 * renomeado deixa o placar mudo no gol, e nada mais avisaria.
 */
test('todo som que o app toca existe na pasta', () => {
  const source = readFileSync(resolve(web, 'app/lib/sound-effects.ts'), 'utf8');
  const referenced = [...source.matchAll(/'(\/sounds\/[^']+)'/g)].map((match) => match[1]);
  assert.ok(referenced.length > 0, 'nenhum som referenciado em sound-effects.ts');

  const onDisk = new Set(readdirSync(resolve(web, 'public/sounds'))
    .filter((file) => /\.(mp3|wav)$/.test(String(file)))
    .map((file) => `/sounds/${file}`));
  for (const src of referenced) assert.ok(onDisk.has(src), `${src} é tocado pelo app e não existe em public/sounds/`);
});

test('o pré-cache não aponta para arquivo que não existe', () => {
  const files = new Set(readdirSync(resolve(web, 'public'), { recursive: true })
    .map((entry) => `/${String(entry).replace(/\\/g, '/')}`));
  for (const asset of [...listed('ICONS'), ...listed('BADGES')]) {
    assert.ok(files.has(asset), `${asset} está no pré-cache e não existe em public/`);
  }
});

/**
 * `PAGES` não são arquivos em `public/`: são rotas do Next, e o `install` faz
 * `cache.addAll(PAGES)` — onde **um único 404 rejeita a instalação inteira** do
 * service worker. Renomear uma rota deixaria o PWA sem nada offline.
 *
 * Sem subir o servidor, o que dá para afirmar é que existe o `page` do
 * App Router correspondente, que é o que separa 200 de 404. O que fica de fora
 * é o que só aparece em execução: uma página que chame `notFound()`, que
 * dependa de dado ausente ou que estoure na renderização passa por aqui e
 * continua derrubando a instalação. Provar isso exigiria o app compilado e de
 * pé — é a suíte e2e, não este teste.
 */
test('toda página do pré-cache corresponde a uma rota do App Router', () => {
  const routes = new Set(readdirSync(resolve(web, 'app'), { recursive: true })
    .map((entry) => String(entry).replace(/\\/g, '/'))
    .filter((entry) => /(^|\/)page\.[jt]sx?$/.test(entry))
    // Grupo de rota — `(publico)` — organiza a pasta e não aparece na URL.
    .map((entry) => `/${entry.replace(/\/?page\.[jt]sx?$/, '')}`.replace(/\/\([^/]+\)/g, '')));
  for (const page of listed('PAGES')) {
    assert.ok(routes.has(page), `${page} está no pré-cache e não é rota em app/`);
  }
});

test('a versão do cache sobe quando o pré-cache muda', () => {
  // Não dá para verificar a intenção, mas dá para exigir o formato: um número
  // no fim, que é o que o `activate` usa para apagar o cache anterior.
  assert.match(source, /const VERSION = 'intereng-v\d+';/);
});

/**
 * Executa o service worker num escopo de mentira e devolve os ouvintes que ele
 * registrou, com o que foi chamado.
 *
 * Chromium sem cabeça recusa a permissão de notificação — `Notification.permission`
 * é sempre `denied` —, então não há como provar este caminho num cenário de
 * navegador. Aqui as ramificações ficam testáveis sem depender disso.
 */
type FakeClient = { url: string; focus: () => Promise<void>; navigate: (url: string) => Promise<void> };

function runWorker() {
  const listeners: Record<string, (event: never) => void> = {};
  const shown: Array<{ title: string; options: Record<string, unknown> }> = [];
  const opened: string[] = [];
  const clients: FakeClient[] = [];

  const self = {
    addEventListener: (name: string, handler: (event: never) => void) => { listeners[name] = handler; },
    skipWaiting: () => undefined,
    location: { origin: 'https://intereng.test' },
    clients: {
      claim: async () => undefined,
      matchAll: async () => clients,
      openWindow: async (url: string) => { opened.push(url); },
    },
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => { shown.push({ title, options }); },
    },
  };
  const caches = {
    open: async () => ({ addAll: async () => undefined, match: async () => undefined, put: async () => undefined, keys: async () => [] }),
    keys: async () => [], delete: async () => true, match: async () => undefined,
  };

  // `new Function` em vez de import: o arquivo é servido como está, sem módulo
  // nem exportação, e é exatamente essa forma que o navegador vai executar.
  new Function('self', 'caches', 'fetch', 'URL', source)(self, caches, async () => ({ ok: false }), URL);
  return { listeners, shown, opened, clients };
}

/** Recolhe o que o ouvinte pendurou em `waitUntil`, para o teste poder esperar. */
function waited(event: Record<string, unknown>) {
  const pending: Array<Promise<unknown>> = [];
  event.waitUntil = (promise: Promise<unknown>) => { pending.push(promise); };
  return pending;
}

test('o aviso enviado pelo servidor vira notificação com título, corpo e destino', async () => {
  const worker = runWorker();
  const event = { data: { json: () => ({ title: 'Futsal · começou', body: 'Alcateia × Cangaceiros', tag: 'partida:semi-1', url: '/matches/live?partida=semi-1' }) } } as Record<string, unknown>;
  const pending = waited(event);
  worker.listeners.push(event as never);
  await Promise.all(pending);

  assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0].title, 'Futsal · começou');
  assert.equal(worker.shown[0].options.body, 'Alcateia × Cangaceiros');
  assert.equal(worker.shown[0].options.tag, 'partida:semi-1');
  assert.deepEqual(worker.shown[0].options.data, { url: '/matches/live?partida=semi-1' });
});

test('corpo que não é JSON não derruba o aviso', async () => {
  const worker = runWorker();
  const event = { data: { json: () => { throw new SyntaxError('não é JSON'); }, text: () => 'texto solto' } } as Record<string, unknown>;
  const pending = waited(event);
  worker.listeners.push(event as never);
  await Promise.all(pending);

  // Sem este ramo o navegador mostra a notificação genérica dele no lugar.
  assert.equal(worker.shown[0].title, 'InterEng');
  assert.equal(worker.shown[0].options.body, 'texto solto');
});

test('clicar no aviso traz a janela aberta para a frente, sem abrir uma segunda', async () => {
  const worker = runWorker();
  const navigated: string[] = [];
  let focused = 0;
  worker.clients.push({
    url: 'https://intereng.test/public',
    focus: async () => { focused += 1; },
    navigate: async (url: string) => { navigated.push(url); },
  });

  const event = { notification: { close: () => undefined, data: { url: '/matches/live?partida=semi-1' } } } as Record<string, unknown>;
  const pending = waited(event);
  worker.listeners.notificationclick(event as never);
  await Promise.all(pending);

  assert.equal(focused, 1);
  assert.deepEqual(navigated, ['/matches/live?partida=semi-1']);
  assert.deepEqual(worker.opened, []);
});

test('sem janela aberta, o clique abre uma', async () => {
  const worker = runWorker();
  const event = { notification: { close: () => undefined, data: { url: '/public' } } } as Record<string, unknown>;
  const pending = waited(event);
  worker.listeners.notificationclick(event as never);
  await Promise.all(pending);
  assert.deepEqual(worker.opened, ['/public']);
});
