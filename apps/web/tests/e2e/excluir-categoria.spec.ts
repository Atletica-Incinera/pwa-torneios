import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * A categoria criada por engano ficava na lista para sempre: não havia tela
 * nenhuma que a apagasse. No InterEng 2026 sobrou uma "Futsal Masculinoo",
 * duplicata de um erro de digitação, sem como sair.
 *
 * Mas apagar categoria é mais grave do que parece: no banco a partida
 * cascateia da fase, que cascateia da categoria. Apagar uma categoria com
 * jogos levaria junto lances e resultados, sem aviso e sem volta. Por isso só
 * cai o que nunca foi usado — rascunho, sem equipe inscrita e sem jogo.
 *
 * A trava de verdade é a do servidor. O que estes testes garantem é que a tela
 * diz de antemão o que está no caminho: oferecer um botão que vai falhar é
 * pior do que não oferecer.
 */
test('a categoria que nunca foi usada pode ser excluída', async ({ page }) => {
  await loginAs(page);
  // Xadrez Individual: rascunho, sem inscritos e sem jogos.
  await page.goto('/tournaments/xadrez?aba=regras');

  const painel = page.locator('#excluir');
  await expect(painel).toBeVisible();
  await expect(painel.locator('p')).toContainText('nunca foi usada');

  const excluir = painel.getByRole('button', { name: 'Excluir categoria' });
  await expect(excluir).toBeEnabled();
  await excluir.click();
  await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();

  // A categoria deixou de existir: ficar na tela dela mostraria "não
  // encontrada", então a saída é a modalidade a que ela pertencia.
  await expect(page).toHaveURL(/\/disciplines\/xadrez/);
  // E ela some da lista da modalidade. Sem recarregar de propósito: em modo
  // local a semente é remontada a cada carga de página, e recarregar mediria a
  // semente em vez da exclusão.
  await expect(page.getByText('Xadrez Individual')).toHaveCount(0);
});

test('categoria publicada não se exclui — se arquiva pela situação', async ({ page }) => {
  await loginAs(page);
  // Vôlei Feminino: publicado, com inscritos e com jogo.
  await page.goto('/tournaments/volei-f?aba=regras');

  const painel = page.locator('#excluir');
  await expect(painel.locator('p')).toContainText('rascunho');
  await expect(painel.getByRole('button', { name: 'Excluir categoria' })).toBeDisabled();
});

test('a tela nomeia o que está no caminho, em vez de só recusar', async ({ page }) => {
  await loginAs(page);
  // Futsal Masculino: em andamento, 4 inscritas e 2 jogos.
  await page.goto('/tournaments/futsal-m?aba=regras');

  const painel = page.locator('#excluir');
  await expect(painel.getByRole('button', { name: 'Excluir categoria' })).toBeDisabled();
  // O motivo aparece antes do clique, não como erro depois de confirmar.
  await expect(painel.locator('p')).toContainText(/rascunho|jogos agendados|equipes inscritas/);
});
