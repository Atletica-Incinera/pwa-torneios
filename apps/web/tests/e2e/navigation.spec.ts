import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('detalhe da modalidade abre pela classificação e alterna as abas', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/futsal-m');

  const tabs = page.getByRole('navigation', { name: 'Seções da modalidade' });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Classificação' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÃO E FASES' })).toBeVisible();

  await tabs.getByRole('tab', { name: 'Participantes' }).click();
  await expect(tabs.getByRole('tab', { name: 'Participantes' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'INSCRITOS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÃO E FASES' })).toHaveCount(0);

  await tabs.getByRole('link', { name: 'Jogos' }).click();
  await expect(page).toHaveURL(/\/matches\?modalidade=Futsal/);
});

test('espectador acessa as cinco prioridades públicas sem controles administrativos', async ({ page }) => {
  await page.goto('/public?modalidade=Futsal');
  await expect(page.getByRole('heading', { name: 'AO VIVO' })).toBeVisible();
  await expect(page.getByText(/registrar gol|editar partida|configurações/i)).toHaveCount(0);
  await page.getByRole('link', { name: /^jogos$/i }).last().click();
  await expect(page.getByRole('heading', { name: 'JOGOS' })).toBeVisible();
  await page.getByRole('link', { name: /classificação/i }).last().click();
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÃO' })).toBeVisible();
  await page.getByRole('link', { name: /resultados/i }).last().click();
  await expect(page.getByRole('heading', { name: 'RESULTADOS' })).toBeVisible();
  await page.getByRole('link', { name: /^fases$/i }).last().click();
  await expect(page.getByRole('heading', { name: 'FASES' })).toBeVisible();
  await expect(page.getByText(/registrar gol|editar partida|configurações/i)).toHaveCount(0);
});

test('barra de navegação permanece fixa durante a rolagem', async ({ page }) => {
  await page.goto('/public/teams');
  const nav = page.locator('.bottom-nav');
  const initial = await nav.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const afterScroll = await nav.boundingBox();
  expect(initial).not.toBeNull();
  expect(afterScroll).not.toBeNull();
  expect(Math.abs((afterScroll?.y ?? 0) - (initial?.y ?? 0))).toBeLessThan(2);
});

test('jogos abre na agenda e mostra classificação somente pela aba', async ({ page }) => {
  await page.goto('/public/matches?modalidade=Futsal');
  await expect(page.getByRole('heading', { name: 'JOGOS' })).toBeVisible();
  await expect(page.locator('.standings-list')).toHaveCount(0);
  await page.getByRole('link', { name: 'Classificação' }).first().click();
  await expect(page).toHaveURL(/visao=classificacao/);
  await expect(page.locator('.standings-list')).toBeVisible();
});

test('detalhe da equipe apresenta classificação e desempenho por modalidade', async ({ page }) => {
  await page.goto('/public/teams/alcateia');
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÕES' })).toBeVisible();
  await expect(page.getByText(/Ranking geral do InterEng/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /ver classificação/i }).first()).toBeVisible();
});

test('admin entra e preserva a modalidade ao navegar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.locator('input[aria-label="Senha"]')).toHaveAttribute('type', 'text');
  await page.getByLabel('E-mail').fill('ana@ufpe.br');
  await page.locator('input[aria-label="Senha"]').fill('intereng2026');
  await page.getByRole('button', { name: 'ENTRAR' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/matches?modalidade=V%C3%B4lei');
  await page.getByRole('button', { name: 'Vôlei' }).click();
  await page.getByRole('link', { name: /equipes/i }).last().click();
  await page.getByRole('link', { name: /jogos/i }).last().click();
  await expect(page).toHaveURL(/modalidade=V%C3%B4lei/);
});

test('regressão visual: equipes públicas', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public/teams');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-teams-mobile.png' : 'public-teams-desktop.png', { fullPage: true });
});

test('regressão visual: placares públicos', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00-03:00'));
  await page.goto('/public?modalidade=Futsal');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-live-mobile.png' : 'public-live-desktop.png', { fullPage: true, timeout: 30_000 });
});

test('regressão visual: torneios públicos', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public/tournaments');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-tournaments-mobile.png' : 'public-tournaments-desktop.png', { fullPage: true });
});

test('regressão visual: detalhes da equipe pública', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public/teams/alcateia');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-team-detail-mobile.png' : 'public-team-detail-desktop.png', { fullPage: true });
});
