import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * A classificacao geral entre modalidades e restrita a organizacao.
 *
 * Esconder os links nao bastaria: o snapshot publico e uma rota aberta e
 * levava a pontuacao inteira junto. Aqui se trava o lado da tela; o lado do
 * dado esta no mapper da API, que devolve o ranking vazio quando o snapshot e
 * publico.
 */
const ROTAS_PUBLICAS = ['/public', '/public/teams', '/public/tournaments', '/public/standings'];

test('área pública não oferece caminho para a classificação geral', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  for (const rota of ROTAS_PUBLICAS) {
    await page.goto(rota);
    await expect(
      page.locator('a[href*="/standings/general"]'),
      `${rota} ainda tem link para o ranking geral`,
    ).toHaveCount(0);
    await expect(
      page.getByText(/classificação geral/i),
      `${rota} ainda anuncia a classificação geral`,
    ).toHaveCount(0);
  }
});

test('endereço antigo do ranking público leva para as categorias', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public/standings/general');
  await expect(page).toHaveURL(/\/public\/tournaments$/);
});

test('detalhe público da equipe não mostra a posição no ranking geral', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public/teams/alcateia');
  await expect(page.locator('.team-overall-summary')).toHaveCount(0);
});

test('a organização continua enxergando a classificação geral', async ({ page }) => {
  await loginAs(page);
  await page.goto('/standings');
  await expect(page.getByRole('heading', { name: /classificação geral/i }).first()).toBeVisible();
  await page.goto('/teams/alcateia');
  await expect(page.locator('.team-overall-summary')).toHaveCount(1);
});
