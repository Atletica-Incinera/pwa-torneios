import { expect, test, type Page } from '@playwright/test';

/**
 * O app compilado com `NEXT_PUBLIC_DATA_SOURCE=http`, falando com a API.
 *
 * Aqui nada vem do navegador: o snapshot, o token e o resultado de cada
 * operação são do servidor. É o que a suíte local não consegue provar.
 */
const api = 'http://127.0.0.1:3201';
const stateKey = 'intereng:app-state:v1';

test.beforeEach(async ({ request }) => { await request.get(`${api}/test/reset`); });

async function login(page: Page, email = 'ana@ufpe.br', password = 'intereng2026') {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[aria-label="Senha"]').fill(password);
  await page.getByRole('button', { name: 'ENTRAR' }).click();
  await page.waitForURL(/\/dashboard/);
}

test('a sessão é emitida pela API e o snapshot vem de lá', async ({ page }) => {
  const snapshot = page.waitForResponse((response) => response.url().includes('/editions/active/snapshot'));
  await login(page);
  expect((await snapshot).status()).toBe(200);

  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('intereng:frontend-session') ?? '{}'));
  expect(session.token).toBe('token-ana@ufpe.br');
  expect(Date.parse(session.expiresAt)).toBeGreaterThan(Date.now());

  await expect(page.getByRole('heading', { name: 'O INTERENG CHEGOU!' })).toBeVisible();
  await page.goto('/teams');
  await expect(page.getByRole('link', { name: /alcateia/i })).toBeVisible();
  // Nada do estado da edição é gravado no navegador: a verdade é do servidor.
  expect(await page.evaluate((key) => localStorage.getItem(key), stateKey)).toBeNull();
});

test('credencial errada mostra a mensagem da API', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail').fill('ana@ufpe.br');
  await page.locator('input[aria-label="Senha"]').fill('senha-errada');
  await page.getByRole('button', { name: 'ENTRAR' }).click();

  await expect(page.getByRole('status')).toContainText(/inválidos/i);
  await expect(page).toHaveURL(/\/$|\/\?/);
});

test('a operação vai à API e a resposta é o que a tela mostra', async ({ page, request }) => {
  await login(page);
  await page.goto('/teams/new');
  await page.getByLabel('Nome da equipe').fill('Aurora HTTP');
  await page.getByLabel('Sigla').fill('AUR');
  await page.getByLabel('Responsável').fill('Pessoa Responsável');

  const action = page.waitForRequest((item) => item.url().includes('/editions/active/actions') && item.method() === 'POST');
  await page.getByRole('button', { name: 'Cadastrar equipe' }).click();
  expect(JSON.parse((await action).postData() ?? '{}').type).toBe('team/create');

  await expect(page).toHaveURL(/\/teams\/aurora-http/);
  await expect(page.getByRole('heading', { name: 'AURORA HTTP', exact: true })).toBeVisible();

  // O registro está no servidor, e o autor da auditoria é quem o token diz.
  // A resposta vem envelopada em `{ data }`, como na API real.
  const { data: snapshot } = await (await request.get(`${api}/editions/active/snapshot`, { headers: { Authorization: 'Bearer token-ana@ufpe.br' } })).json();
  expect(snapshot.teams['aurora-http'].name).toBe('Aurora HTTP');
  expect(snapshot.audit[0]).toMatchObject({ action: 'Equipe cadastrada', actor: 'Ana Coordenadora' });
});

test('o espectador usa o snapshot público, sem staff nem auditoria', async ({ page }) => {
  const publicSnapshot = page.waitForResponse((response) => response.url().includes('/public-snapshot'));
  await page.goto('/public/tournaments');
  const { data: payload } = await (await publicSnapshot).json();

  expect(payload.staff).toEqual({});
  expect(payload.audit).toEqual([]);
  expect(Object.keys(payload.tournaments)).not.toContain('xadrez');

  await expect(page.getByRole('heading', { name: 'MODALIDADES' })).toBeVisible();
  await expect(page.getByText('Xadrez Individual')).toHaveCount(0);
});

test('token recusado pela API devolve ao login com aviso', async ({ page }) => {
  await login(page);
  // O servidor reinicia e esquece a sessão: o próximo carregamento leva 401.
  await page.request.get(`${api}/test/reset`);
  await page.goto('/teams');

  await expect(page).toHaveURL(/\?access=expired/);
  await expect(page.getByRole('status')).toContainText(/sessão expirou/i);
});

test('sem tempo real, a barra de contexto avisa em vez de congelar', async ({ page }) => {
  await login(page);
  // A API de mentira não tem socket: a ligação de tempo real não sobe.
  await expect(page.locator('.sync-state.sync-offline')).toContainText('Sem conexão');
});
