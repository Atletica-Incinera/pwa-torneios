import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('valida, confirma descarte e cadastra uma equipe sem duplicar ações', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams/new');
  await page.getByRole('button', { name: 'Cadastrar equipe' }).click();
  await expect(page.locator('.form-feedback-error')).toContainText(/preencha nome, sigla e responsável/i);
  await page.getByLabel('Nome da equipe').fill('Aurora E2E');
  await page.getByLabel('Sigla').fill('AUR');
  await page.getByLabel('Responsável').fill('Pessoa Responsável');
  await page.getByRole('link', { name: 'Cancelar' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Descartar' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByLabel('Nome da equipe')).toHaveValue('Aurora E2E');
  await page.getByRole('button', { name: 'Cadastrar equipe' }).click();
  await expect(page).toHaveURL(/\/teams\/aurora-e2e/);
  const team = await page.evaluate(() => JSON.parse(localStorage.getItem('intereng:app-state:v1') ?? '{}').teams?.['aurora-e2e']);
  expect(team?.name).toBe('Aurora E2E');
});

test('rota antiga converge para o fluxo único de modalidade e salva suas regras', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/new');
  await expect(page).toHaveURL(/\/disciplines\/new/);
  await page.getByLabel('Modalidade do catálogo').selectOption('Basquete');
  await expect(page.getByLabel('Quantidade de etapas')).toHaveValue('2');
  await expect(page.getByLabel('Minutos por etapa')).toHaveValue('10');
  await page.getByRole('button', { name: 'Salvar modalidade' }).click();
  await expect(page).toHaveURL(/\/disciplines\/basquete/);
  const discipline = await page.evaluate(() => JSON.parse(localStorage.getItem('intereng:app-state:v1') ?? '{}').disciplines?.Basquete);
  expect(discipline?.rules?.periodCount).toBe(2);
  expect(discipline?.rules?.periodDurationMinutes).toBe(10);
  expect(discipline?.rules?.clockMode).toBe('countdown');
});

test('gestor fica restrito à própria modalidade', async ({ page }) => {
  await loginAs(page, 'bruno@ufpe.br', 'futsal2026');
  await page.goto('/competitions');
  await expect(page.getByRole('heading', { name: 'ACESSO RESTRITO' })).toBeVisible();
  await page.goto('/matches?modalidade=V%C3%B4lei');
  await expect(page.getByRole('link', { name: /agendar jogo/i })).toHaveCount(0);
  await page.goto('/matches/new?modalidade=V%C3%B4lei');
  await expect(page.getByLabel('Modalidade').locator('option')).toHaveText(['Selecione a modalidade', 'Futsal']);
});

test('opera placar, anuncia atualização e desfaz com confirmação personalizada', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value() {
      (window as typeof window & { __sportSoundPlays?: number }).__sportSoundPlays = ((window as typeof window & { __sportSoundPlays?: number }).__sportSoundPlays ?? 0) + 1;
      return Promise.resolve();
    } });
  });
  await loginAs(page);
  await page.goto('/matches/live?partida=semifinal-1');
  await page.getByRole('button', { name: /Gol Alcateia/i }).click();
  await expect(page.locator('.score-blue')).toHaveText('3');
  await expect(page.locator('.sr-only[aria-live="assertive"]')).toContainText(/Placar: Alcateia, 3; Cangaceiros, 1/i);
  const recordedEvent = await page.evaluate(() => JSON.parse(localStorage.getItem('intereng:app-state:v1') ?? '{}').matches?.['semifinal-1']?.events?.[0]);
  expect(recordedEvent?.period).toBe(1);
  expect(recordedEvent?.periodElapsedSeconds).toEqual(expect.any(Number));
  expect(Number.isNaN(Date.parse(recordedEvent?.at))).toBe(false);
  expect(await page.evaluate(() => (window as typeof window & { __sportSoundPlays?: number }).__sportSoundPlays ?? 0)).toBeGreaterThan(0);
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Desfazer' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.locator('.score-blue')).toHaveText('2');
});

test('admin configura pontos e publica o ranking geral', async ({ page }) => {
  await loginAs(page);
  await page.goto('/standings');
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÃO GERAL' })).toBeVisible();
  const awardForm = page.locator('.ranking-award-form');
  await awardForm.getByLabel('Equipe da bonificação').selectOption('alcateia');
  await awardForm.getByLabel('Modalidade da bonificação').selectOption('Futsal');
  await awardForm.getByLabel('Métrica da bonificação').selectOption('metric-champion');
  await expect(awardForm.getByLabel('Pontos da bonificação')).toHaveValue('10');
  await awardForm.getByRole('button', { name: /Conceder pontos/i }).click();
  const alcateia = page.locator('.overall-ranking-row').filter({ hasText: 'Alcateia' });
  await expect(alcateia).toContainText('10');
  await page.goto('/public/standings/general');
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÃO GERAL' })).toBeVisible();
  await expect(page.locator('.overall-ranking-row').filter({ hasText: 'Alcateia' })).toContainText('10');
  await expect(page.getByText(/Conceder pontos|Métricas de pontuação/i)).toHaveCount(0);
});
