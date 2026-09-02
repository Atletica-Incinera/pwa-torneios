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

/**
 * O mata-mata o app resolve sozinho, lendo a classificação. Já o grupo de três
 * jogado como mini-chave — "VORAZ × PERDEDOR J3", que a planilha traz dentro
 * da fase de grupos — não segue regra nenhuma que o app conheça: quem sabe
 * quem joga é a organização.
 *
 * Sem esta tela esses jogos ficavam impossíveis de operar. E como a geração do
 * mata-mata exige TODOS os jogos da fase de grupos encerrados, a chave da
 * categoria inteira nunca seria montada — são doze jogos assim no InterEng
 * 2026, travando quatro chaveamentos.
 */
test('o organizador define quem joga, e a partida passa a ser operável', async ({ page }) => {
  await loginAs(page);
  await page.goto('/matches/futsal-m-advanced-r1-1/manage');

  const definir = page.locator('form.definir-participante');
  await expect(definir).toBeVisible();
  await expect(definir).toContainText('depende de um resultado anterior');

  // Um seletor por lado a definir, com as equipes inscritas na categoria.
  await definir.getByLabel(/Vencedor do Jogo 1/).selectOption('Alcateia');
  await definir.getByLabel(/Vencedor do Jogo 2/).selectOption('Cangaceiros');
  await definir.getByRole('button', { name: 'Definir participante' }).click();

  // Definidos os dois lados, o formulário sai e a mesa passa a poder abrir.
  await expect(definir).toHaveCount(0);
  await page.goto('/matches/live?partida=futsal-m-advanced-r1-1');
  await page.getByRole('button', { name: /^INICIAR PARTIDA/i }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('a mesma equipe nos dois lados é recusada', async ({ page }) => {
  await loginAs(page);
  await page.goto('/matches/futsal-m-advanced-r1-1/manage');

  const definir = page.locator('form.definir-participante');
  await definir.getByLabel(/Vencedor do Jogo 1/).selectOption('Alcateia');
  await definir.getByLabel(/Vencedor do Jogo 2/).selectOption('Alcateia');
  await definir.getByRole('button', { name: 'Definir participante' }).click();

  await expect(definir.getByRole('alert')).toContainText('diferentes');
});

test('partida com os dois lados definidos não mostra o formulário', async ({ page }) => {
  await loginAs(page);
  await page.goto('/matches/semifinal-1/manage');
  await expect(page.locator('form.definir-participante')).toHaveCount(0);
});
