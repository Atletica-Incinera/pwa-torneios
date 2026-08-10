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
