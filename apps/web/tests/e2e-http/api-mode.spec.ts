import { expect, test, type Page } from '@playwright/test';
import { activeEditionId, apiRoute, apiUrl as api, armFailure, authHeaders, credentials, isMock, realtimeMode, reset, sessionKey, unwrap } from './api';

/**
 * O app compilado com `NEXT_PUBLIC_DATA_SOURCE=http`, falando com a API.
 *
 * Aqui nada vem do navegador: a sessão, o estado e o resultado de cada operação
 * são do servidor. É o que a suíte local não consegue provar.
 *
 * O que mudou desde a primeira versão destes cenários: **não existe mais
 * snapshot da edição nem despachante de ações**. A API é um controller por
 * recurso, o estado da tela é remontado de dezenas de rotas granulares e cada
 * ação nomeada vira a chamada REST do recurso que ela muda. Os cenários provam
 * o mesmo comportamento de antes — sessão emitida pela API, operação que vai ao
 * servidor e volta como verdade, espectador sem staff, 401 devolvendo ao login,
 * renovação que não expulsa —, só que contra essa forma.
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

test('a sessão é emitida pela API e o estado vem das rotas dela', async ({ page }) => {
  const emitida = page.waitForResponse((response) => apiRoute(response.url()) === '/auth/login');
  await login(page);
  // 200, e não 201: o login da API é `@HttpCode(200)`. Aceitar qualquer 2xx
  // aqui deixaria passar justamente a diferença que dói na integração.
  expect((await emitida).status()).toBe(200);

  const session = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '{}'), sessionKey);
  // O formato do token é do servidor; o que o app garante é que ele existe e
  // que a sessão tem prazo no futuro.
  expect(session.token).toBeTruthy();
  expect(Date.parse(session.expiresAt)).toBeGreaterThan(Date.now());

  await expect(page.getByRole('heading', { name: 'O INTERENG CHEGOU!' })).toBeVisible();

  /**
   * Nenhuma rota devolve a edição inteira, então a prova de que o estado é do
   * servidor deixou de ser "o snapshot respondeu 200". O que resta é o par que
   * sustenta a remontagem — quem é o usuário e o que a edição tem — respondendo
   * com a sessão na mão, e nada da edição sobrando no navegador.
   */
  const me = page.waitForResponse((response) => apiRoute(response.url()) === '/auth/me');
  const elencos = page.waitForResponse((response) => /^\/editions\/[^/]+\/rosters$/.test(apiRoute(response.url()) ?? ''));
  await page.goto('/teams');
  expect((await me).status()).toBe(200);
  expect((await elencos).status()).toBe(200);

  await expect(page.getByRole('link', { name: /alcateia/i })).toBeVisible();
  // Nada do estado da edição é gravado no navegador: a verdade é do servidor.
  expect(await page.evaluate((key) => localStorage.getItem(key), stateKey)).toBeNull();
});

test('a página inteira compartilha uma conexão e uma carga', async ({ page, request }) => {
  test.skip(realtimeMode !== 'sse', 'com o canal de polling cada ciclo é uma carga: a contagem por página deixa de ter sentido');

  /**
   * O caminho da equipe é montado com o id do servidor.
   *
   * Fixá-lo como `/teams/alcateia` só funciona porque a semente do mock reusa a
   * chave do contrato como id; contra a API real o id é gerado, a tela abriria
   * em "equipe não encontrada" — que renderiza sem pedir nada — e a contagem
   * passaria por acidente, provando o contrário do que o cenário quer.
   */
  const equipes = unwrap<Array<{ id: string; name: string }>>(await (await request.get(`${api}/teams?search=Alcateia`, { headers: await authHeaders(request) })).json());
  const alcateia = equipes.find((team) => team.name === 'Alcateia');
  expect(alcateia, 'a semente precisa ter a equipe Alcateia para este cenário valer').toBeTruthy();

  /**
   * O canal precisa ficar de pé para ser contado uma vez.
   *
   * A rota que o app abre — `/editions/:id/stream` — não existe na API, que só
   * tem stream por partida; o navegador fecha a conexão e a reabertura entraria
   * na conta como se a página tivesse aberto duas. Segurar a resposta com
   * `retry` alto adia a reabertura para fora do cenário e isola o que aqui se
   * mede: o provider, não o canal. Quando o módulo de tempo real migrar para o
   * stream por partida, esta contagem muda de lugar — a conexão passa a existir
   * só na tela da partida — e é aqui que se conserta.
   */
  await page.route('**/editions/*/stream*', (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry: 600000\n\n' }));

  const cargas: string[] = [];
  const streams: string[] = [];
  page.on('request', (item) => {
    const path = apiRoute(item.url());
    if (!path) return;
    // `GET /competitions` é a primeira requisição de toda remontagem, e só
    // dela: contá-la conta cargas da edição, e não requisições — que agora são
    // dezenas por carga e mudam com o tamanho da edição.
    if (path === '/competitions') cargas.push(path);
    if (path.endsWith('/stream')) streams.push(path);
  });

  await login(page);
  cargas.length = 0;
  streams.length = 0;

  // `/teams/[id]` é a rota mais povoada: a página, a moldura, a guarda, a barra
  // inferior e três painéis pedem o estado. Antes do provider único eram sete
  // conexões e sete cargas — mais que o teto de seis por origem do navegador,
  // com as últimas presas na fila atrás de streams que não fecham.
  await page.goto(`/teams/${alcateia?.id}`);
  await expect(page.getByRole('heading', { name: /alcateia/i }).first()).toBeVisible();

  expect(cargas.length, `remontagens da edição: ${cargas.length}`).toBe(1);
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

test('a operação vai à API e volta como verdade', async ({ page, request }) => {
  await login(page);
  await page.goto('/teams/new');
  await page.getByLabel('Nome da equipe').fill('Aurora HTTP');
  await page.getByLabel('Sigla').fill('AUR');
  await page.getByLabel('Responsável').fill('Pessoa Responsável');

  // Não há despachante: a ação nomeada vira a rota REST do recurso.
  const criacao = page.waitForRequest((item) => apiRoute(item.url()) === '/teams' && item.method() === 'POST');
  await page.getByRole('button', { name: 'Cadastrar equipe' }).click();
  // Sigla, responsável, logo e tom não têm coluna na API. O corpo é conferido
  // inteiro, e não campo a campo, porque o `forbidNonWhitelisted` global
  // transforma um campo a mais em 400 — mandar o que a tela sabe e a API não
  // pede derruba a operação inteira.
  expect(JSON.parse((await criacao).postData() ?? '{}')).toEqual({ name: 'Aurora HTTP', slug: 'aurora-http' });

  // O operador vê que salvou, e sai do formulário.
  await expect(page.locator('.app-toast', { hasText: 'Equipe cadastrada' })).toBeVisible();
  await expect(page).not.toHaveURL(/\/teams\/new/);

  /**
   * O registro está no servidor — e com o id **dele**.
   *
   * O id que o cliente escolheu viaja como `slug` e não vira chave: quem
   * navegar para `/teams/<slug escolhido aqui>` cai numa tela que não existe.
   * Está registrado como defeito das telas; o cenário afirma a causa em vez de
   * congelar o sintoma.
   */
  const listadas = unwrap<Array<{ id: string; name: string; slug: string }>>(await (await request.get(`${api}/teams?search=Aurora`, { headers: await authHeaders(request) })).json());
  const criada = listadas.find((team) => team.name === 'Aurora HTTP');
  expect(criada?.slug).toBe('aurora-http');
  expect(criada?.id).not.toBe('aurora-http');

  // E a releitura traz a equipe do servidor para a lista, indexada pelo id dele.
  await page.goto('/teams');
  await expect(page.getByRole('link', { name: /aurora http/i })).toHaveAttribute('href', `/teams/${criada?.id}`);
});

test('operação que a API recusa mostra a mensagem dela, não um aviso genérico', async ({ page, request }) => {
  // O gancho é do mock. Na API real o que responde é a ausência da operação, e
  // não há como pedir uma que ainda não existe sem inventá-la.
  test.skip(!isMock, 'depende do gancho /test/unimplemented-action');
  const message = 'Cadastro de equipe entra na próxima versão da API.';
  // A falha é armada por rota, e não por nome de ação: nome de ação não existe
  // mais no fio, e o que o operador encontra é o recurso respondendo.
  await armFailure(request, { method: 'POST', path: '/teams', status: 501, message });

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

test('o espectador vê o que a API abre, e o que ela nega não derruba a tela', async ({ page, request }) => {
  const negadas: string[] = [];
  page.on('response', (response) => {
    const path = apiRoute(response.url());
    if (path && response.status() === 401) negadas.push(path);
  });

  await page.goto('/public/tournaments');
  // A moldura pública só sai da tela de carregamento quando a remontagem
  // termina: o título visível é o sinal de que a carga inteira passou.
  await expect(page.getByRole('heading', { name: 'MODALIDADES' })).toBeVisible();

  /**
   * O snapshot público acabou: quem separa o espectador do operador agora é o
   * servidor, rota a rota. Catálogo global e papéis da edição exigem sessão e
   * voltam 401 — que aqui é resposta, não falha, e a tela pública fica de pé
   * sem eles. Tolerar 401 **sem token** é a única concessão: com token na mão,
   * o mesmo 401 é sessão vencida e derruba a carga (cenário abaixo).
   */
  await expect.poll(() => negadas, { message: 'o servidor precisa ter negado o catálogo a quem não tem sessão' }).toContain('/teams');
  await expect.poll(() => negadas).toContain('/athletes');
  await expect.poll(() => negadas.some((path) => path.endsWith('/staff-roles'))).toBe(true);
  expect(await page.evaluate((key) => sessionStorage.getItem(key) ?? localStorage.getItem(key), sessionKey)).toBeNull();

  // O rascunho continua fora da área pública...
  await expect(page.getByRole('heading', { name: 'Futsal Masculino' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Xadrez Individual' })).toHaveCount(0);

  /**
   * ...só que quem o esconde passou a ser o front.
   *
   * `GET /editions/:id/tournaments` é aberta e não filtra por estado: o
   * rascunho viaja até o navegador de quem não tem sessão, e só o filtro de
   * publicação o mantém fora da tela. É vazamento, está registrado, e esta
   * afirmação é onde ele fica visível — no dia em que a API filtrar, o cenário
   * cai e o filtro do cliente pode deixar de ser a única barreira.
   */
  const abertas = unwrap<Array<{ name: string; status: string }>>(await (await request.get(`${api}/editions/${await activeEditionId(request)}/tournaments`)).json());
  expect(abertas.some((tournament) => tournament.status === 'DRAFT')).toBe(true);
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

test('o que outro operador cadastra chega na tela sem recarregar', async ({ page, request }) => {
  /**
   * O canal de tempo real do app abre `/editions/:id/stream`, e a API não tem
   * essa rota: só existe stream **por partida**, com evento `match-event`.
   * Enquanto o módulo de tempo real não migrar, nada é empurrado em modo `sse`
   * e nenhuma mudança de outro operador chega sozinha. Com
   * `NEXT_PUBLIC_REALTIME=poll` o cenário roda e prova o comportamento.
   */
  test.fixme(realtimeMode !== 'poll', 'o canal SSE aponta para uma rota que a API não tem; rode com NEXT_PUBLIC_REALTIME=poll até o módulo de tempo real migrar');

  await login(page);
  await page.goto('/teams');
  await expect(page.getByRole('link', { name: /alcateia/i })).toBeVisible();

  /**
   * Outro cliente opera na API, e a tela rebusca sozinha — sem recarregar, sem
   * clicar, sem esperar o próximo despacho daqui.
   *
   * O que ele faz mudou: antes era renomear a Alcateia por uma ação nomeada.
   * O catálogo da API só tem POST e GET — não existe `PATCH /teams/:id` —,
   * então a mudança que outro operador consegue fazer, e que esta tela mostra,
   * é cadastrar uma equipe.
   */
  const criada = await request.post(`${api}/teams`, { headers: await authHeaders(request), data: { name: 'Fênix Remota', slug: 'fenix-remota' } });
  expect(criada.status()).toBe(201);

  // O ciclo do canal é de cinco segundos, e a remontagem inteira vem depois.
  await expect(page.getByRole('link', { name: /fênix remota/i })).toBeVisible({ timeout: 15_000 });
});

test('canal de tempo real fora do ar: a barra avisa em vez de congelar', async ({ page }) => {
  test.skip(realtimeMode !== 'sse', 'a queda do canal de polling é exercitada nos testes de componente');
  /**
   * Conexão é obrigatória para ver em tempo real: a queda não pode ser
   * silenciosa. Hoje o cenário passaria sem esta interceptação, porque a rota
   * do stream não existe na API e o canal já nasce caído — a interceptação é o
   * que o mantém deliberado quando o canal for consertado.
   */
  await page.route('**/editions/*/stream*', (route) => route.fulfill({ status: 500, body: 'indisponível' }));
  await login(page);

  await expect(page.locator('.sync-state.sync-offline')).toContainText('Sem conexão');
});

test('rota que falha na carga vira aviso com a mensagem do servidor, não tela vazia', async ({ page, request }) => {
  test.skip(!isMock, 'depende do gancho que arma a falha por rota');
  /**
   * A remontagem lê dezenas de rotas, e uma falha derruba a carga inteira.
   *
   * Completar a coleção que faltou com vazio é indistinguível de "ninguém
   * cadastrou" na tela: a edição apareceria pronta e sem torneios, e o operador
   * cadastraria tudo de novo. O que ele precisa ler é a frase do servidor.
   */
  const message = 'O catálogo de torneios está indisponível.';
  await armFailure(request, { method: 'GET', path: `/editions/${await activeEditionId(request)}/tournaments`, status: 500, message });

  await login(page);
  const aviso = page.locator('main.global-state-screen');
  await expect(aviso).toContainText('DADOS INDISPONÍVEIS');
  await expect(aviso).toContainText(message);
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
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
  // A renovação é disparada pelo primeiro 401 da remontagem, que pode chegar
  // depois do load.
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
