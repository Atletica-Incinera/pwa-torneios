import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * No ginásio a mesa não tem tempo de escolher o autor no meio da partida: o gol
 * entra na hora, e um seletor no caminho do botão de gol vira placar errado
 * toda vez que alguém se distrai.
 *
 * Por isso o gol sempre pôde entrar sem autor. O que faltava era onde informá-lo
 * DEPOIS — e sem isso ele ficava sem autor para sempre, e a artilharia ficava
 * com o buraco.
 */
test('a mesa informa quem marcou depois do jogo, e a artilharia conta', async ({ page }) => {
  await loginAs(page);

  // Jogo encerrado com os dois gols sem autor: o estado em que a mesa termina
  // a partida no ginasio.
  await page.goto('/matches/futsal-grupo-encerrado');
  const painel = page.locator('section.match-scorers');
  await expect(painel).toBeVisible();
  await expect(painel.locator('.info-banner')).toContainText('2 lances ainda estão sem autor');

  // Cada seletor oferece o elenco da equipe daquele lado, na modalidade do jogo.
  const linhas = painel.locator('li');
  await expect(linhas).toHaveCount(2);
  await linhas.nth(0).locator('select').selectOption({ label: 'Ana Lima' });
  await expect(painel.locator('.info-banner')).toContainText('1 lance ainda está sem autor');
  await linhas.nth(1).locator('select').selectOption({ label: 'Rafael Santos' });
  await expect(painel.locator('.info-banner')).toContainText('já têm autor');

  // E os gols passam a contar na artilharia pública.
  await page.goto('/public/scorers');
  await expect(page.getByText('Ana Lima')).toBeVisible();
  await expect(page.getByText('Rafael Santos')).toBeVisible();
});

test('o painel de autores não aparece com a partida ainda em jogo', async ({ page }) => {
  // Ao vivo quem atribui é a tela do placar, que tem a trava de operador.
  await loginAs(page);
  await page.goto('/matches/semifinal-1');
  await expect(page.locator('section.match-scorers')).toHaveCount(0);
});
