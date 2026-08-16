import { expect, test, type Page } from '@playwright/test';
import { apiUrl as api, authHeaders, credentials, isMock, reset } from './api';

/**
 * O app compilado com `NEXT_PUBLIC_DATA_SOURCE=http`, falando com a API.
 *
 * Aqui nada vem do navegador: o snapshot, o token e o resultado de cada
 * operação são do servidor. É o que a suíte local não consegue provar.
 *
 * A mesma suíte roda contra o mock (`npm run test:e2e:http`, padrão, sem
 * servidor) e contra a API real (`npm run test:e2e:api`).
 */
const stateKey = 'intereng:app-state:v1';

test.beforeEach(async ({ request }) => { await reset(request); });

async function login(page: Page, email = credentials.email, password = credentials.password) {
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
  // O formato do token é do servidor; o que o app garante é que ele existe e
  // que a sessão tem prazo no futuro.
  expect(session.token).toBeTruthy();
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
  const response = await request.get(`${api}/editions/active/snapshot`, { headers: await authHeaders(request) });
  const payload = await response.json() as { data?: Record<string, never> };
  const snapshot = (payload.data ?? payload) as { teams: Record<string, { name: string }>; audit: Array<Record<string, unknown>> };
  expect(snapshot.teams['aurora-http'].name).toBe('Aurora HTTP');
  expect(snapshot.audit[0]).toMatchObject({ action: 'Equipe cadastrada', actor: credentials.name });
});

test('o espectador usa o snapshot público, sem staff nem auditoria', async ({ page }) => {
  const publicSnapshot = page.waitForResponse((response) => response.url().includes('/public-snapshot'));
  await page.goto('/public/tournaments');
  const payload = await (await publicSnapshot).json();

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

test('o que outro operador muda chega na tela sem recarregar', async ({ page, request }) => {
  await login(page);
  await page.goto('/teams');
  await expect(page.getByRole('link', { name: /alcateia/i })).toBeVisible();

  // Outro cliente opera na API. O stream avisa e a tela rebusca sozinha —
  // sem recarregar, sem clicar, sem esperar o próximo despacho daqui.
  const renamed = await request.post(`${api}/editions/active/actions`, {
    headers: await authHeaders(request),
    data: { type: 'team/update', payload: { id: 'alcateia', patch: { name: 'Alcateia Renomeada' } } },
  });
  expect(renamed.status()).toBe(200);

  await expect(page.getByRole('link', { name: /alcateia renomeada/i })).toBeVisible();
});

test('stream fora do ar: a barra avisa em vez de congelar', async ({ page }) => {
  // Conexão é obrigatória para ver em tempo real: a queda não pode ser silenciosa.
  await page.route('**/editions/*/stream*', (route) => route.fulfill({ status: 500, body: 'indisponível' }));
  await login(page);

  await expect(page.locator('.sync-state.sync-offline')).toContainText('Sem conexão');
});

test('renovação que não recebe resposta não expulsa para o login', async ({ page, request }) => {
  // O caso real: o operador clica num link enquanto o acesso está sendo
  // renovado. A navegação descarrega a página e o navegador aborta a
  // requisição em voo. Isso é rede, não credencial recusada — e por um tempo
  // era tratado igual, mandando para o login quem tinha sessão boa.
  test.skip(!isMock, 'depende do gancho /test/expire-access');
  await page.goto('/');
  await login(page);
  await request.post(`${api}/test/expire-access`);

  let aborted = false;
  await page.route('**/auth/refresh', async (route) => {
    if (aborted) return route.continue();
    aborted = true;
    return route.abort('failed');
  });

  await page.goto('/teams');
  // A renovação é disparada pelo primeiro 401, que pode chegar depois do load.
  await expect.poll(() => aborted, { message: 'a renovação precisa ter sido abortada para o cenário valer' }).toBe(true);

  // Esperar o que NÃO deve acontecer não tem sinal positivo para aguardar: a
  // janela existe para a guarda chegar a decidir e, se for o caso, redirecionar.
  await page.waitForTimeout(500);

  // O que não pode acontecer de jeito nenhum: a sessão ser dada como vencida.
  await expect(page).not.toHaveURL(/access=expired/);
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('intereng:frontend-session') ?? '{}'));
  expect(Date.parse(stored.expiresAt), 'a sessão não pode ser carimbada como vencida').toBeGreaterThan(Date.now());

  // E a sessão continua servindo: recarregar entra direto, sem passar pelo
  // login. Recarregar em vez de clicar em "Tentar novamente" é de propósito —
  // o botão recompõe só uma das pipelines de estado da página, e o que este
  // cenário precisa provar é que a sessão sobreviveu, não quantas telas o
  // botão conserta.
  await page.reload();
  await expect(page.getByRole('link', { name: /alcateia/i })).toBeVisible();
});

test('acesso vencido é renovado sozinho, sem devolver ao login', async ({ page, request }) => {
  // O gancho que vence o acesso sem derrubar a renovação é do mock: na API real
  // o mesmo caminho é exercitado esperando o token curto expirar.
  test.skip(!isMock, 'depende do gancho /test/expire-access');
  await page.goto('/');
  await login(page);
  const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem('intereng:frontend-session') ?? '{}').token);

  // O acesso vence, a renovação continua válida — é o caso do dia a dia com
  // token curto, e o app precisa atravessar sem interromper quem trabalha.
  await request.post(`${api}/test/expire-access`);
  await page.goto('/teams');

  await expect(page.getByRole('link', { name: /alcateia/i })).toBeVisible();
  await expect(page).not.toHaveURL(/access=expired/);
  const after = await page.evaluate(() => JSON.parse(sessionStorage.getItem('intereng:frontend-session') ?? '{}').token);
  expect(after).not.toBe(before);
});
