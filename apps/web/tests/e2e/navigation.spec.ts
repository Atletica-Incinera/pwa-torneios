import { expect, test } from '@playwright/test';

test('espectador navega entre jogos, equipes e torneios sem controles administrativos', async ({ page }) => {
  await page.goto('/public?modalidade=Futsal');
  await expect(page.getByRole('heading', { name: 'AO VIVO' })).toBeVisible();
  await expect(page.getByText(/registrar gol|editar partida|configurações/i)).toHaveCount(0);
  await page.getByRole('link', { name: /equipes/i }).last().click();
  await expect(page.getByRole('heading', { name: 'EQUIPES' })).toBeVisible();
  await page.getByRole('link', { name: /torneios/i }).last().click();
  await expect(page.getByRole('heading', { name: 'TORNEIOS' })).toBeVisible();
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

test('layout público permanece estável nos viewports responsivos', async ({ page }) => {
  await page.goto('/public/teams');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-teams-mobile.png' : 'public-teams-desktop.png', { fullPage: true });
});
