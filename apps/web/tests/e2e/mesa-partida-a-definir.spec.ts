import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * O confronto do mata-mata entra na agenda antes de existir resultado, com um
 * rótulo no lugar do participante. A mesa não pode abrir o placar de um jogo
 * assim: o lance e a pontuação ficariam pendurados em ninguém.
 *
 * A API recusa. Mas a recusa da API chega DEPOIS de o operador confirmar uma
 * ação, e como um erro genérico. A checagem da tela existe para o motivo
 * aparecer antes, com a frase que diz o que falta — e ela estava morta: a
 * função recebia a partida sem as marcas de "a definir", então nunca via que
 * havia algo a impedir.
 */
test('a mesa não abre o placar de um jogo que ainda espera um resultado', async ({ page }) => {
  await loginAs(page);
  await page.goto('/matches/futsal-m-advanced-r1-1');

  // O jogo aparece na agenda com os rótulos, e não como se fossem equipes.
  await expect(page.getByText('Vencedor do Jogo 1')).toBeVisible();

  await page.goto('/matches/live?partida=futsal-m-advanced-r1-1');
  await page.getByRole('button', { name: /^INICIAR PARTIDA/i }).click();

  // Nenhuma confirmação é oferecida: a recusa vem antes, dizendo o que falta.
  await expect(page.getByText(/depende de um resultado anterior/i)).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('o jogo com os dois participantes definidos continua começando', async ({ page }) => {
  // A trava não pode ter passado a valer para todo mundo.
  await loginAs(page);
  await page.goto('/matches/live?partida=volei-grupo-a');

  await page.getByRole('button', { name: /^INICIAR PARTIDA/i }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toContainText('Iniciar partida');
});
