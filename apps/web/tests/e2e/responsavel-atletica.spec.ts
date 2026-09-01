import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Nao existia papel para a atletica: os dois que havia se prendem a edicao
 * inteira ou a uma modalidade. Dar acesso a uma atletica significava dar
 * acesso a mais do que ela deveria ver.
 *
 * O acesso e criado a partir da propria equipe, e nao da tela de Staff, porque
 * o vinculo e com esta equipe -- quem esta olhando a Alcateia nao precisa
 * escolher "Alcateia" num seletor para dizer de quem e o acesso.
 */
test('admin cria o acesso do responsável a partir da tela da equipe', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams/alcateia');

  const secao = page.locator('.acesso-atletica');
  await expect(secao).toBeVisible();
  // O que o papel alcanca fica escrito: quem concede precisa saber o que esta
  // concedendo.
  await expect(secao).toContainText('Não enxerga o elenco das outras equipes');

  await secao.getByLabel('Nome do responsável').fill('Bruna Alves');
  await secao.getByLabel('E-mail').fill('bruna@atletica.test');
  await secao.getByLabel('Senha inicial').fill('senhaprovisoria');
  await secao.getByRole('button', { name: /Criar acesso/i }).click();

  await expect(secao.getByText('bruna@atletica.test')).toBeVisible();
});

test('senha inicial não fica guardada no navegador de quem convidou', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams/alcateia');
  const secao = page.locator('.acesso-atletica');
  await secao.getByLabel('Nome do responsável').fill('Bruna Alves');
  await secao.getByLabel('E-mail').fill('bruna@atletica.test');
  await secao.getByLabel('Senha inicial').fill('senhaprovisoria');
  await secao.getByRole('button', { name: /Criar acesso/i }).click();
  await expect(secao.getByText('bruna@atletica.test')).toBeVisible();

  const guardado = await page.evaluate(() => localStorage.getItem('intereng:app-state:v1') ?? '');
  expect(guardado, 'a senha do responsável ficou no armazenamento local').not.toContain(
    'senhaprovisoria',
  );
});

test('a senha inicial é recusada quando é curta demais', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams/alcateia');
  const secao = page.locator('.acesso-atletica');
  await secao.getByLabel('Nome do responsável').fill('Bruna Alves');
  await secao.getByLabel('E-mail').fill('bruna@atletica.test');
  await secao.getByLabel('Senha inicial').fill('123');
  await secao.getByRole('button', { name: /Criar acesso/i }).click();
  await expect(secao.getByRole('alert')).toContainText('pelo menos 8 caracteres');
});

test('o gestor de modalidade não vê a seção de acesso da atlética', async ({ page }) => {
  await loginAs(page, 'bruno@ufpe.br', 'futsal2026');
  await page.goto('/teams/alcateia');
  await expect(page.locator('.acesso-atletica')).toHaveCount(0);
});
