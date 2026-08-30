import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * A organizacao decidiu operar a mesa sem relogio: o jogo comeca no play,
 * consta como Ao vivo e termina quando o operador encerra, sem minutagem em
 * lugar nenhum.
 *
 * O modo ja existia no regulamento (`clockMode: 'none'`), mas a tela ainda
 * reservava o espaco do relogio para anunciar "SEM CRONOMETRO", e a sumula
 * numerava os lances como `#1`, `#2` -- o que parece minuto para quem le.
 */
async function tirarOCronometro(page: import('@playwright/test').Page) {
  await page.goto('/disciplines/futsal');
  await page.getByRole('button', { name: /Editar regras/i }).click();
  await page.getByLabel(/Funcionamento do relógio/i).selectOption('none');
  await page.getByRole('button', { name: /^Salvar/ }).first().click();
  await expect(page.getByRole('button', { name: /Editar regras/i })).toBeVisible();
}

test('mesa sem cronômetro não mostra relógio nem minutagem', async ({ page }) => {
  await loginAs(page);
  await tirarOCronometro(page);

  await page.goto('/matches/live?partida=semifinal-1');
  await expect(page.locator('.score-hero')).toBeVisible();

  await expect(page.locator('.game-clock'), 'o relógio continua na tela da mesa').toHaveCount(0);
  await expect(page.getByText('SEM CRONÔMETRO')).toHaveCount(0);
  // A etapa continua: ela diz onde a partida está, e não é minutagem.
  await expect(page.locator('.game-period')).toBeVisible();
  // O fluxo pedido continua inteiro.
  await expect(page.getByRole('button', { name: /Encerrar partida/i })).toBeVisible();
});

test('lance registrado sem cronômetro não ganha número que pareça minuto', async ({ page }) => {
  await loginAs(page);
  await tirarOCronometro(page);

  await page.goto('/matches/live?partida=semifinal-1');
  await expect(page.locator('.score-hero')).toBeVisible();
  await page.getByRole('button', { name: /Gol Alcateia/i }).click();

  const linha = page.locator('.timeline-item').first();
  await expect(linha).toBeVisible();
  const texto = (await linha.innerText()).replace(/\s+/g, ' ');
  expect(texto, `a súmula mostrou "${texto}"`).not.toMatch(/#\d|\d{1,2}:\d{2}/);
});

test('detalhe da partida sem cronômetro não anuncia a ausência do relógio', async ({ page }) => {
  await loginAs(page);
  await tirarOCronometro(page);
  await page.goto('/matches/semifinal-1');
  await expect(page.getByText('SEM CRONÔMETRO')).toHaveCount(0);
  await expect(page.locator('.spectator-clock-row .game-clock')).toHaveCount(0);
});

test('modalidade nova já nasce sem cronômetro', async ({ page }) => {
  await loginAs(page);
  await page.goto('/disciplines/new');
  await expect(page.getByLabel(/Funcionamento do relógio/i)).toHaveValue('none');
  // E o campo de minutos por etapa some junto, porque não tem o que preencher.
  await expect(page.getByLabel(/Minutos por etapa/i)).toHaveCount(0);
});
