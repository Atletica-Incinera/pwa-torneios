import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * A artilharia so existe se a mesa disser quem marcou. Antes disto o evento
 * nem tinha campo de atleta: o modelo da API guardava `athleteId`, nenhuma
 * acao aceitava o campo, e o autor nunca chegava a ser gravado.
 *
 * O que estes testes travam e a ordem das coisas na mesa. A pergunta vem
 * DEPOIS do gol entrar no placar -- um seletor antes seria placar errado toda
 * vez que a mesa se distraisse no meio da escolha.
 */
async function marcarGol(page: import('@playwright/test').Page) {
  await page.goto('/matches/live?partida=semifinal-1');
  await expect(page.locator('.score-hero')).toBeVisible();
  const antes = await page.locator('.score-blue').innerText();
  await page.getByRole('button', { name: /Gol Alcateia/i }).click();
  return antes;
}

test('o gol entra no placar antes de a mesa dizer quem marcou', async ({ page }) => {
  await loginAs(page);
  const antes = await marcarGol(page);

  // O placar ja subiu, com o seletor ainda aberto: e este o ponto.
  await expect(page.locator('.score-blue')).not.toHaveText(antes);
  await expect(page.locator('.autor-do-lance')).toBeVisible();
  await expect(page.locator('.autor-do-lance')).toContainText('Quem marcou pelo Alcateia?');
});

test('autor escolhido vira artilheiro na área pública', async ({ page }) => {
  await loginAs(page);
  await marcarGol(page);

  const opcoes = page.locator('.autor-chip:not(.autor-pular)');
  await expect(opcoes.first()).toBeVisible();
  const nome = (await opcoes.first().innerText()).trim();
  await opcoes.first().click();
  await expect(page.locator('.autor-do-lance')).toHaveCount(0);

  await page.goto('/public/scorers');
  const linha = page.locator('.artilharia-linha').filter({ hasText: nome });
  await expect(linha).toHaveCount(1);
  await expect(linha.locator('.artilharia-posicao')).toHaveText('1º');
});

test('não identificar mantém o gol e conta a lacuna', async ({ page }) => {
  await loginAs(page);
  const antes = await marcarGol(page);
  await page.locator('.autor-chip.autor-pular').click();
  await expect(page.locator('.autor-do-lance')).toHaveCount(0);
  // O gol continua valendo: artilharia e desejavel, nao obrigatoria.
  await expect(page.locator('.score-blue')).not.toHaveText(antes);

  await page.goto('/public/scorers');
  await expect(page.getByText(/sem o nome de quem marcou/i)).toBeVisible();
});

test('artilharia pública aparece na navegação do espectador', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public');
  const aba = page.locator('.public-bottom-nav').getByRole('link', { name: /artilharia/i });
  await expect(aba).toBeVisible();
  await aba.click();
  await expect(page).toHaveURL(/\/public\/scorers$/);
  await expect(page.getByRole('heading', { name: 'ARTILHARIA' })).toBeVisible();
});
