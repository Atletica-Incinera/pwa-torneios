import { expect, test } from '@playwright/test';

test('todo endereço que o manifesto declara responde de verdade', async ({ request }) => {
  // A versao anterior conferia os caminhos literais, e por isso nao viu o
  // defeito que deixou o app nao-instalavel: em producao o app vive sob
  // `/intereng`, e os icones declarados na raiz respondiam 404. O Chrome
  // recusa instalar aplicativo cujo icone nao carrega.
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();

  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192' }),
    expect.objectContaining({ sizes: '512x512' }),
    expect.objectContaining({ purpose: 'maskable' }),
  ]));

  const enderecos = [
    manifest.start_url,
    ...manifest.icons.map((icone: { src: string }) => icone.src),
    ...manifest.shortcuts.flatMap((atalho: { url: string; icons?: { src: string }[] }) => [
      atalho.url,
      ...(atalho.icons ?? []).map((icone) => icone.src),
    ]),
  ];
  for (const endereco of [...new Set<string>(enderecos)]) {
    expect(endereco.startsWith(manifest.scope), `"${endereco}" está fora do scope`).toBe(true);
    const resposta = await request.get(endereco);
    expect(resposta.status(), `"${endereco}" não responde`).toBeLessThan(400);
  }
});

test('a página carrega os ícones de instalação que o iOS e o Android usam', async ({ page, request }) => {
  await page.goto('/public');
  // O apple-touch-icon e o mais visivel dos tres: e ele que o iPhone usa ao
  // adicionar a tela de inicio, e sem ele o iOS poe um retrato da pagina no
  // lugar do icone.
  const icones = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(
    (links) => links.map((link) => link.getAttribute('href') ?? ''),
  );
  expect(icones.length, 'a página não declara ícone nenhum').toBeGreaterThan(2);
  for (const href of icones) {
    const resposta = await request.get(href);
    expect(resposta.status(), `o ícone "${href}" não responde`).toBeLessThan(400);
  }
});

test('service worker instala cache e entrega a tela offline', async ({ context, page }) => {
  await page.goto('/public');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cacheKeys = await page.evaluate(async () => caches.keys());
  expect(cacheKeys.some((key) => /^intereng-v\d+-pages$/.test(key))).toBeTruthy();
  await context.setOffline(true);
  try {
    await page.goto('/rota-nao-cacheada-e2e', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'SEM CONEXÃO' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('service worker aplica uma atualização somente após confirmação', async ({ page }) => {
  await page.goto('/public');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register(`/sw.js?e2e-update=${Date.now()}`);
    const installing = registration.installing;
    if (installing) await new Promise<void>((resolve) => {
      const check = () => { if (installing.state === 'installed') resolve(); };
      installing.addEventListener('statechange', check);
      check();
    });
  });
  const updateButton = page.getByRole('button', { name: 'Atualizar' });
  await expect(updateButton).toBeVisible();
  await Promise.all([page.waitForEvent('framenavigated'), updateButton.click()]);
  await expect(page.getByRole('heading', { name: 'AO VIVO' })).toBeVisible();
});

test('no iPhone o app ensina a instalar, já que o iOS não oferece o prompt', async ({ browser }) => {
  // `beforeinstallprompt` nao existe no Safari: sem esta instrucao o iPhone e
  // o unico aparelho onde o app e instalavel e nada na tela diz como.
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('/public');

  const banner = page.locator('.pwa-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Compartilhar');
  await expect(banner).toContainText('Adicionar à Tela de Início');
  // Nao oferece um botao "Instalar" que o iOS nao sabe honrar.
  await expect(banner.getByRole('button', { name: 'Instalar' })).toHaveCount(0);

  await banner.getByRole('button', { name: 'Dispensar instalação' }).click();
  await expect(banner).toHaveCount(0);
  await context.close();
});

test('em aparelho que oferece o prompt, o banner não vira tutorial de iPhone', async ({ page }) => {
  await page.goto('/public');
  await expect(page.locator('.pwa-banner')).toHaveCount(0);
});
