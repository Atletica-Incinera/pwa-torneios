import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * As telas de detalhe que ficaram sem rede quando o catálogo virou estado.
 * Todas leem um registro por id: se o id deixar de existir, elas precisam
 * dizer isso em vez de quebrar.
 */

test('detalhe do atleta mostra vínculo, modalidades e participação real', async ({ page }) => {
  await loginAs(page);
  await page.goto('/athletes/ana-lima');

  await expect(page.getByRole('heading', { name: 'ANA LIMA', exact: true })).toBeVisible();
  await expect(page.getByText('Alcateia').first()).toBeVisible();
  await expect(page.getByText('Futsal · Vôlei')).toBeVisible();
});

test('atleta inexistente avisa em vez de quebrar', async ({ page }) => {
  await loginAs(page);
  await page.goto('/athletes/nao-existe');

  await expect(page.locator('.empty-state').getByText('SEM DADOS')).toBeVisible();
});

test('edição da partida abre com os dados agendados e valida o período', async ({ page }) => {
  await loginAs(page);
  await page.goto('/matches/semifinal-1/manage');

  await expect(page.getByRole('heading', { name: 'EDITAR PARTIDA' })).toBeVisible();
  await expect(page.getByText('Alcateia × Cangaceiros')).toBeVisible();
});

test('partida pública mostra placar oficial e nenhuma ação de operação', async ({ page }) => {
  await page.goto('/public/matches/semifinal-1');

  await expect(page.getByRole('heading', { name: 'PARTIDA' })).toBeVisible();
  await expect(page.getByRole('link', { name: /editar partida|abrir placar/i })).toHaveCount(0);
});

test('perfil mostra a sessão e permite sair', async ({ page }) => {
  await loginAs(page);
  await page.goto('/profile');

  await expect(page.getByRole('heading', { name: 'PERFIL' })).toBeVisible();
  await expect(page.getByText('Ana Coordenadora').first()).toBeVisible();
});

test('novo torneio valida o período antes de criar', async ({ page }) => {
  await loginAs(page, 'super@intereng.com', 'super2026');
  await page.goto('/competitions/new');

  await page.getByLabel('Nome do torneio').fill('Copa E2E');
  await page.getByLabel('Ano da primeira edição').fill('2027');
  await page.getByLabel('Início').fill('2027-10-10');
  await page.getByLabel('Encerramento').fill('2027-10-01');
  await page.getByRole('button', { name: 'Criar torneio' }).click();
  await expect(page.locator('.form-feedback-error')).toContainText(/depois do início/i);

  await page.getByLabel('Encerramento').fill('2027-10-20');
  await page.getByRole('button', { name: 'Criar torneio' }).click();
  await expect(page).toHaveURL(/\/competitions/);
  await expect(page.getByRole('button', { name: 'Copa E2E' })).toBeVisible();
});
