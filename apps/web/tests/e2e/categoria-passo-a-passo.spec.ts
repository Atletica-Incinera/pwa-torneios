import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Montar uma categoria e a parte mais densa do app: quatro paineis numerados,
 * e ate aqui nada dizia que eram uma sequencia nem que dava para parar no
 * meio. As etapas 3 e 4 ja se explicavam; a 1 e a 2 caiam direto nos
 * controles -- "ordem do sorteio", "classificados", "grupos separados por
 * virgula" -- sem dizer o que significam.
 *
 * Isto e texto, nao comportamento: os testes existentes de montagem de
 * categoria continuam sendo a garantia de que nada mudou de funcionamento.
 */
test('a aba de gestão abre dizendo que são quatro etapas em ordem', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/futsal-m?aba=regras');
  const abertura = page.locator('.passo-a-passo');
  await expect(abertura).toBeVisible();
  await expect(abertura).toContainText('Quatro etapas');
  // O que mais assusta quem chega: achar que precisa terminar tudo de uma vez.
  await expect(abertura).toContainText('aos poucos');
});

test('as quatro etapas explicam o que fazer antes dos controles', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/futsal-m?aba=regras');

  for (const [id, trecho] of [
    ['participants', 'cabeça de chave'],
    ['phases', 'Mata-mata'],
    ['advancement', 'grupo'],
    ['generate', 'confrontos'],
  ] as const) {
    const painel = page.locator(`#${id}`);
    await expect(painel, `a etapa #${id} sumiu`).toBeVisible();
    await expect(painel.locator('p').first(), `a etapa #${id} não explica nada`).toContainText(
      new RegExp(trecho, 'i'),
    );
  }
});

test('permite digitar espaços e vírgulas nos nomes dos grupos', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/new?modalidade=Futsal');
  await page.getByLabel('Nome da categoria').fill('Futsal Grupos E2E');
  await page.getByRole('button', { name: 'Criar categoria' }).click();
  await page.waitForURL(/\/tournaments\/category-.*\?aba=regras/);
  const grupos = page.getByLabel('Grupos separados por vírgula').first();

  await grupos.fill('');
  await grupos.pressSequentially('Grupo A, Grupo B');

  await expect(grupos).toHaveValue('Grupo A, Grupo B');
  await grupos.press('Tab');
  await expect(grupos).toHaveValue('Grupo A, Grupo B');
});

test('a criação da categoria manda para a aba com o nome que aparece na tela', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/new');
  const nota = page.locator('.form-contract-note');
  await expect(nota).toContainText('Gestão');
  // A aba `regras` na URL se chama "Gestão" na tela. Mandar para "Regras"
  // faria a pessoa procurar uma aba que não existe.
  await expect(nota).not.toContainText('aba Regras');
});
