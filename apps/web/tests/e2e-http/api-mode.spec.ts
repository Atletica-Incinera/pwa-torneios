import { expect, test, type Page } from '@playwright/test';
import { apiUrl as api, authHeaders, credentials, isMock, reset, sessionKey, unwrap } from './api';

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

  const session = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '{}'), sessionKey);
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

test('a página inteira compartilha uma conexão e um snapshot', async ({ page }) => {
  const snapshots: string[] = [];
  const streams: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/snapshot') || path.endsWith('/public-snapshot')) snapshots.push(path);
    if (path.endsWith('/stream')) streams.push(path);
  });

  await login(page);
  snapshots.length = 0;
  streams.length = 0;

  // `/teams/[id]` é a rota mais povoada: a página, a moldura, a guarda, a barra
  // inferior e três painéis pedem o estado. Antes do provider único eram sete
  // conexões e sete snapshots — mais que o teto de seis por origem do
  // navegador, com os últimos presos na fila atrás de streams que não fecham.
  await page.goto('/teams/alcateia');
  await expect(page.getByRole('heading', { name: /alcateia/i }).first()).toBeVisible();

  expect(snapshots.length, `snapshots pedidos: ${snapshots.length}`).toBe(1);
  expect(streams.length, `streams abertos: ${streams.length}`).toBe(1);
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
  const snapshot = unwrap<{ teams: Record<string, { name: string }>; audit: Array<Record<string, unknown>> }>(await response.json());
  expect(snapshot.teams['aurora-http'].name).toBe('Aurora HTTP');
  expect(snapshot.audit[0]).toMatchObject({ action: 'Equipe cadastrada', actor: credentials.name });
});

test('operação que a API ainda não implementa mostra a mensagem dela, não um aviso genérico', async ({ page, request }) => {
  // O gancho é do mock — ele implementa todas as ações, porque roda o mesmo
  // redutor do cliente. Na API real o que responde 501 é a própria ausência da
  // operação, e não há como pedir uma que ainda não existe sem inventá-la.
  test.skip(!isMock, 'depende do gancho /test/unimplemented-action');
  const message = 'Cadastro de equipe entra na próxima versão da API.';
  await request.post(`${api}/test/unimplemented-action`, { data: { type: 'team/create', message } });

  await login(page);
  await page.goto('/teams/new');
  await page.getByLabel('Nome da equipe').fill('Aurora HTTP');
  await page.getByLabel('Sigla').fill('AUR');
  await page.getByLabel('Responsável').fill('Pessoa Responsável');
  await page.getByRole('button', { name: 'Cadastrar equipe' }).click();

  // O aviso some sozinho depois de alguns segundos: é o primeiro a conferir.
  await expect(page.locator('.app-toast.toast-error')).toContainText(message);
  await expect(page.locator('.form-feedback-error')).toHaveText(message);
  // O literal fixo faria o operador repetir a mesma ação para sempre, achando
  // que é a rede. Nenhum dos dois — o do provider e o do formulário — aparece.
  await expect(page.getByText(/Não foi possível (salvar|cadastrar)/)).toHaveCount(0);
  // E a operação não aconteceu: continua no formulário, sem equipe criada.
  await expect(page).toHaveURL(/\/teams\/new/);
});

test('o espectador usa o snapshot público, sem staff nem auditoria', async ({ page }) => {
  const publicSnapshot = page.waitForResponse((response) => response.url().includes('/public-snapshot'));
  await page.goto('/public/tournaments');
  const snapshot = unwrap<{ staff: Record<string, unknown>; audit: unknown[]; tournaments: Record<string, unknown> }>(await (await publicSnapshot).json());

  expect(snapshot.staff).toEqual({});
  expect(snapshot.audit).toEqual([]);
  expect(Object.keys(snapshot.tournaments)).not.toContain('xadrez');

  await expect(page.getByRole('heading', { name: 'MODALIDADES' })).toBeVisible();
  await expect(page.getByText('Xadrez Individual')).toHaveCount(0);
});

test('token recusado pela API devolve ao login com aviso', async ({ page }) => {
  await login(page);
  /**
   * O gatilho é a sessão do navegador, e não o estado do servidor.
   *
   * Reiniciar a semente invalidava o token só porque o mock guarda as sessões
   * num `Map`. A API real assina JWT, que é sem estado: não há sessão guardada
   * em lugar nenhum para esquecer, e o próximo pedido voltaria 200 — o cenário
   * passaria aqui e mentiria lá.
   *
   * Trocar o token por um que ninguém emitiu vale nos dois, porque a recusa
   * não depende de memória do servidor. Junto vai a credencial de renovação:
   * sem ela não há como consertar sozinho, que é o estado de quem deixou a aba
   * aberta até o refresh ser rotacionado. Se ela ficasse, o 401 viraria uma
   * renovação bem-sucedida — e o cenário deixaria de ser sobre expulsar.
   */
  await page.evaluate((key) => {
    const store = sessionStorage.getItem(key) ? sessionStorage : localStorage;
    const session = JSON.parse(store.getItem(key) ?? '{}') as Record<string, unknown>;
    delete session.refreshToken;
    session.token = 'token-que-o-servidor-nao-emitiu';
    store.setItem(key, JSON.stringify(session));
  }, sessionKey);
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
  const stored = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '{}'), sessionKey);
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
  const before = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '{}').token, sessionKey);

  // O acesso vence, a renovação continua válida — é o caso do dia a dia com
  // token curto, e o app precisa atravessar sem interromper quem trabalha.
  await request.post(`${api}/test/expire-access`);
  await page.goto('/teams');

  await expect(page.getByRole('link', { name: /alcateia/i })).toBeVisible();
  await expect(page).not.toHaveURL(/access=expired/);
  const after = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '{}').token, sessionKey);
  expect(after).not.toBe(before);
});
