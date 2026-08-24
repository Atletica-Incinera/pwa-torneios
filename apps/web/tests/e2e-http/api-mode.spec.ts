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
  await page.goto('/login');
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

test('a tela de login não expõe credenciais de demonstração', async ({ page }) => {
  // Achado em produção: o painel de acessos de demonstração (senhas fixas,
  // "Admin: ana@ufpe.br · intereng2026") ficava visível mesmo compilado
  // contra a API real, sem checar a origem dos dados.
  await page.goto('/login');
  await expect(page.getByText('Acessos de demonstração')).toHaveCount(0);
});

test('credencial errada mostra a mensagem da API', async ({ page }) => {
  await page.goto('/login');
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
  // Acesso global é dado de administração: não pode vazar junto do resto.
  expect(payload.superAdmins).toEqual([]);
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

test('conta com a senha inicial só alcança a troca de senha', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('nova@ufpe.br');
  await page.locator('input[aria-label="Senha"]').fill('intereng2026');
  await page.getByRole('button', { name: 'ENTRAR' }).click();

  // A edição nem chega a carregar: com a marca de pé a API recusa o snapshot
  // com 403, e é a tela de troca que ocupa o lugar do app.
  await expect(page.getByRole('heading', { name: 'TROQUE SUA SENHA' })).toBeVisible();
  // Digitar outra rota não escapa da exigência.
  await page.goto('/teams');
  await expect(page.getByRole('heading', { name: 'TROQUE SUA SENHA' })).toBeVisible();

  await page.getByLabel('Senha atual').fill('intereng2026');
  await page.getByLabel('Nova senha', { exact: true }).fill('senhaEscolhida1');
  await page.getByLabel('Repita a nova senha').fill('senhaEscolhida1');
  await page.getByRole('button', { name: 'Trocar e entrar' }).click();

  // Com a senha trocada e a sessão nova em mãos, a mesma rota carrega.
  await expect(page.getByRole('link', { name: /alcateia/i })).toBeVisible();
});

test('a página pública carrega normalmente para quem está com a senha inicial pendente', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('nova@ufpe.br');
  await page.locator('input[aria-label="Senha"]').fill('intereng2026');
  await page.getByRole('button', { name: 'ENTRAR' }).click();
  await expect(page.getByRole('heading', { name: 'TROQUE SUA SENHA' })).toBeVisible();

  // Achado em produção: /public não passa pelo guard que intercepta rotas
  // privadas, e o adaptador decidia buscar o snapshot autenticado só por haver
  // um token em mãos — mesmo de uma conta que a API recusa por inteiro. O
  // visitante via a tela genérica de erro em vez da página pública.
  const publicSnapshot = page.waitForResponse((response) => response.url().includes('/public-snapshot'));
  await page.goto('/public/tournaments');
  expect((await publicSnapshot).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'MODALIDADES' })).toBeVisible();
});

test('sistema recém-migrado, sem nenhuma competição: onboarding em vez de erro', async ({ page, request }) => {
  // Achado em produção: o cutover real caiu exatamente neste estado — banco
  // migrado, super admin criado, zero competições. O dashboard e /competitions
  // indexavam a primeira competição sem checar se existia; a API devolvia 404
  // "não foi possível determinar a competição ativa" para tudo, e a tela de
  // erro genérica ocupava o lugar de qualquer página privada — inclusive a
  // única capaz de criar a primeira.
  await request.post(`${api}/test/no-active-edition`);
  await login(page, 'super@intereng.com', 'super2026');

  await expect(page.getByText('Nenhum torneio cadastrado')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DADOS INDISPONÍVEIS' })).toHaveCount(0);

  await page.goto('/competitions');
  await expect(page.getByText('Nenhum torneio cadastrado')).toBeVisible();

  await page.getByRole('link', { name: 'Criar torneio' }).first().click();
  await page.waitForURL(/\/competitions\/new/);
  await page.getByLabel('Nome do torneio').fill('InterEng');
  await page.getByLabel('Ano da primeira edição').fill('2027');
  await page.getByLabel('Início').fill('2027-10-10');
  await page.getByLabel('Encerramento').fill('2027-10-17');
  await page.getByRole('button', { name: 'Criar torneio' }).click();

  // Diferente do competition/create normal (nasce inativo, exige ativação à
  // parte): o bootstrap cria já ativo — é o que faz "active" voltar a
  // resolver no mesmo instante. O onboarding sai de cena e o dashboard mostra
  // dados de verdade.
  await page.waitForURL(/\/competitions/);
  await expect(page.getByRole('button', { name: 'InterEng', exact: true })).toBeVisible();
  await expect(page.getByText('Nenhum torneio cadastrado')).toHaveCount(0);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'O INTERENG CHEGOU!' })).toBeVisible();
  await expect(page.getByText('Nenhum torneio cadastrado')).toHaveCount(0);
});

test('o endpoint de bootstrap recusa quando já existe alguma competição', async ({ request }) => {
  // O bootstrap é só para a saída do zero. Depois da primeira competição, o
  // caminho normal (competition/create via /editions/active/actions) volta a
  // funcionar, e tentar o bootstrap de novo precisa ser recusado — não
  // silenciosamente promovido a "criar mais uma". A suíte padrão (sem
  // /test/no-active-edition) já começa com uma competição semeada.
  const login = await request.post(`${api}/auth/login`, {
    data: { email: 'super@intereng.com', password: 'super2026' },
  });
  const { data } = await login.json();

  const response = await request.post(`${api}/competitions/bootstrap`, {
    headers: { Authorization: `Bearer ${data.token}` },
    data: { name: 'Outro', slug: 'outro', year: 2028, start: '2028-01-01', end: '2028-01-08' },
  });
  expect(response.status()).toBe(409);
});

test('super admin concede super admin a outra conta, e a concessão aparece', async ({ page }) => {
  await login(page, 'super@intereng.com', 'super2026');
  await page.goto('/staff');
  await page.getByRole('link', { name: 'Conceder super admin' }).click();
  await page.waitForURL(/\/staff\/promote/);

  const action = page.waitForRequest((item) => item.url().includes('/editions/active/actions') && item.method() === 'POST');
  await page.getByLabel('Nome').fill('Novo Super Admin');
  await page.getByLabel('E-mail').fill('novo-super@intereng.com');
  await page.getByRole('button', { name: 'Conceder super admin' }).click();
  expect(JSON.parse((await action).postData() ?? '{}').type).toBe('staff/promoteSuperAdmin');

  await page.waitForURL(/\/staff$/);
  // Achado em produção: a concessão gravava a flag no servidor e a tela ficava
  // idêntica, porque a lista de staff é montada só das atribuições de edição —
  // e super admin não tem nenhuma. Do ponto de vista de quem concedeu, a função
  // não funcionava.
  await expect(page.getByRole('heading', { name: 'SUPER ADMINISTRADORES' })).toBeVisible();
  await expect(page.getByText('novo-super@intereng.com')).toBeVisible();
});

test('admin da edição não alcança a concessão de super admin', async ({ page }) => {
  // staff/promoteSuperAdmin é ação global (só super admin) do lado da API;
  // sem bloquear a rota também no front, a pessoa preenche o formulário
  // inteiro só para receber um erro genérico no fim.
  await login(page);
  await page.goto('/staff/promote');
  await expect(page.getByRole('heading', { name: 'ACESSO RESTRITO' })).toBeVisible();
});

test('sem tempo real, a barra de contexto avisa em vez de congelar', async ({ page }) => {
  await login(page);
  // A API de mentira não tem socket: a ligação de tempo real não sobe.
  await expect(page.locator('.sync-state.sync-offline')).toContainText('Sem conexão');
});
