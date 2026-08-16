import { expect, test } from '@playwright/test';

test('manifesto publica ícones instaláveis e maskable', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: '/icon-192.png', sizes: '192x192' }),
    expect.objectContaining({ src: '/icon-512.png', sizes: '512x512' }),
    expect.objectContaining({ src: '/icon-maskable-512.png', purpose: 'maskable' }),
  ]));
});

test('todo atalho do manifesto abre uma rota final', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json() as { shortcuts: Array<{ name: string; url: string }> };
  expect(manifest.shortcuts.length).toBeGreaterThan(0);
  for (const shortcut of manifest.shortcuts) {
    // Sem seguir o salto: um atalho que cai em redirect custa uma navegação
    // inteira toda vez que alguém abre o app pela tela inicial.
    const response = await request.get(shortcut.url, { maxRedirects: 0 });
    expect(response.status(), `${shortcut.name} → ${shortcut.url}`).toBe(200);
  }
});

test('o documento declara a cor da barra e libera as áreas seguras', async ({ page }) => {
  await page.goto('/public');
  // Duas metas que só existem se o `viewport` for exportado do layout. Sem a
  // primeira a barra do navegador ignora o manifesto; sem `viewport-fit` os
  // `env(safe-area-inset-*)` do CSS voltam zero no iOS.
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#022734');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
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
