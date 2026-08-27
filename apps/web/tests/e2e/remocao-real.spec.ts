import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * "Remover" no app sempre foi uma marca. A modalidade desativada ficava na
 * lista com uma tarja "REMOVIDA" e o acesso revogado ficava entre os acessos
 * com uma tarja "REVOGADO" — as duas telas anunciavam uma coisa e mostravam
 * justamente o contrario dela.
 *
 * O que se trava aqui: inativo sai da lista principal, o caminho de volta
 * continua existindo num grupo recolhido, e excluir apaga em vez de marcar.
 */
test('modalidade desativada sai da lista e vai para o grupo recolhido', async ({ page }) => {
  await loginAs(page);
  await page.goto('/disciplines');

  const cartoes = page.locator('.poster-list .discipline-card');
  const antes = await cartoes.count();
  const nome = (await cartoes.first().locator('h2').textContent())?.trim() ?? '';
  expect(nome).not.toBe('');

  await cartoes.first().click();
  await page.getByRole('button', { name: 'Desativar' }).click();
  await page.getByRole('button', { name: 'Desativar' }).last().click();

  await page.goto('/disciplines');
  const principais = page.locator('.poster-list:not(.grupo-inativos .poster-list) .discipline-card');
  await expect(principais).toHaveCount(antes - 1);
  await expect(principais.filter({ hasText: nome })).toHaveCount(0);

  const grupo = page.locator('details.grupo-inativos');
  await expect(grupo).toHaveCount(1);
  await expect(grupo.locator('summary')).toContainText('Desativadas (1)');
  // O grupo comeca fechado; o conteudo existe e e o caminho para reativar.
  await expect(grupo.locator('.discipline-card').filter({ hasText: nome })).toHaveCount(1);
  await expect(page.getByText('Removida', { exact: true })).toHaveCount(0);
});

test('excluir fica bloqueado enquanto a modalidade tem categoria', async ({ page }) => {
  // A trava e do servidor, mas oferecer um botao que vai falhar e pior que nao
  // oferecer: a tela diz de antemao o que esta no caminho.
  await loginAs(page);
  await page.goto('/disciplines');
  await page.locator('.poster-list .discipline-card').first().click();

  const excluir = page.getByRole('button', { name: 'Excluir' });
  await expect(excluir).toBeDisabled();
  await expect(excluir).toHaveAttribute('title', /categoria/);
});

test('acesso revogado sai da lista de acessos', async ({ page }) => {
  await loginAs(page);
  await page.goto('/staff');

  const cartoes = page.locator('.section-block.no-top .staff-card');
  const antes = await cartoes.count();
  expect(antes).toBeGreaterThan(0);

  const revogavel = page.locator('.section-block.no-top .staff-card').filter({
    has: page.getByRole('button', { name: /^Revogar acesso de/ }),
  }).first();
  const alvo = (await revogavel.locator('h2').textContent())?.trim() ?? '';
  await revogavel.getByRole('button', { name: /^Revogar acesso de/ }).click();
  await page.getByRole('button', { name: 'Revogar' }).last().click();

  await expect(page.locator('.section-block.no-top .staff-card')).toHaveCount(antes - 1);
  const grupo = page.locator('details.grupo-inativos');
  await expect(grupo.locator('summary')).toContainText('Acesso revogado (1)');
  await expect(grupo.locator('.staff-card').filter({ hasText: alvo })).toHaveCount(1);
});
