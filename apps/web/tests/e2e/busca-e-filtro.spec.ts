import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * As buscas comparavam texto com acento e caixa, e so o nome entrava na conta.
 * Na pratica: "caotica" nao encontrava a Caotica, "joao" nao encontrava o Joao
 * Pedro, e procurar pela sigla nao encontrava nada. Digitar sem acento e o
 * padrao de quem procura com pressa.
 *
 * O botao de arquivadas funcionava, mas sem nenhuma equipe arquivada ele
 * aceitava o clique e deixava a lista igual -- indistinguivel de defeito.
 */
test('busca de equipe ignora acento e aceita a sigla', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams');
  const busca = page.getByLabel('Buscar equipe');
  const cartoes = page.locator('.team-card');

  await busca.fill('caotica');
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Caótica');

  await busca.fill('Caótica');
  await expect(cartoes).toHaveCount(1);

  await busca.fill('tubaroes');
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Tubarões');

  // Sigla: quem opera a mesa conhece a equipe pelo apelido curto do placar.
  await busca.fill('GRX');
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Graxeiros');
});

test('busca de atleta ignora acento e alcança equipe e modalidade', async ({ page }) => {
  await loginAs(page);
  await page.goto('/athletes');
  const busca = page.getByLabel('Buscar atleta');
  const cartoes = page.locator('.athlete-card');

  await busca.fill('joao');
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('João');

  await busca.fill('João');
  await expect(cartoes).toHaveCount(1);
});

test('filtro de arquivadas fica inerte quando não há nenhuma', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams');
  const filtro = page.getByRole('button', { name: /Mostrar.*equipes arquivadas/ });
  await expect(filtro).toBeDisabled();
  await expect(filtro).toHaveAttribute('title', /Nenhuma equipe arquivada/);

  const antes = await page.locator('.team-card').count();
  await page.goto('/teams/alcateia');
  await page.getByRole('button', { name: 'Arquivar' }).click();
  const confirmar = page.getByRole('button', { name: /^(Arquivar|Confirmar)$/ }).last();
  if (await confirmar.count()) await confirmar.click();

  await page.goto('/teams');
  await expect(page.locator('.team-card')).toHaveCount(antes - 1);
  const habilitado = page.getByRole('button', { name: /Mostrar as 1 equipes arquivadas/ });
  await expect(habilitado).toBeEnabled();
  await habilitado.click();
  await expect(page.locator('.team-card')).toHaveCount(antes);
});
