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

test('aceitar o descarte navega de verdade, sem recarregar o app', async ({ page }) => {
  // Só o ramo "Cancelar" era exercitado. O ramo aceito reconstruía a URL a
  // partir do DOM e o `basePath` entrava duas vezes: em produção isso virava
  // uma rota inexistente, o Next desistia da navegação por RSC e caía numa
  // navegação dura para o 404 — com o `beforeunload` ainda armado, que era o
  // segundo "quer mesmo sair?" antes de o app inteiro se perder.
  await loginAs(page);
  await page.goto('/teams/new');
  await page.getByLabel('Nome da equipe').fill('Descartada E2E');
  // Marca de vida do documento: sobrevive a navegação do router e some em
  // qualquer recarga. É o que distingue as duas — `framenavigated` não serve,
  // porque também dispara em navegação de mesmo documento.
  await page.evaluate(() => { (window as unknown as { __spa: boolean }).__spa = true; });

  await page.getByRole('link', { name: 'Cancelar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();

  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole('heading', { name: 'EQUIPES' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa)).toBe(true);
});

test('cadastro de equipe guarda o registro', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams/new');
  await page.getByLabel('Nome da equipe').fill('Aurora E2E');
  await page.getByLabel('Sigla').fill('AUR');
  await page.getByLabel('Responsável').fill('Pessoa Responsável');
  await page.getByRole('button', { name: 'Cadastrar equipe' }).click();
  await expect(page).toHaveURL(/\/teams\/aurora-e2e/);
  const team = await page.evaluate(() => JSON.parse(localStorage.getItem('intereng:app-state:v1') ?? '{}').teams?.['aurora-e2e']);
  expect(team?.name).toBe('Aurora E2E');
});

test('publicar libera a agenda antes de os confrontos existirem', async ({ page }) => {
  // A ordem estava invertida: publicar exigia confrontos já gerados, e a agenda
  // só enxerga categoria publicada. Quem quisesse montar os jogos à mão era
  // obrigado a passar pela chave automática primeiro.
  await loginAs(page);
  await page.goto('/tournaments/new?modalidade=Futsal');
  await page.getByLabel('Nome da categoria').fill('Futsal Ordem E2E');
  await page.getByRole('button', { name: 'Criar categoria' }).click();
  await page.waitForURL(/\?aba=regras/);

  const participantes = page.locator('.participant-selector input[type="checkbox"]');
  await participantes.nth(0).check();
  await participantes.nth(1).check();

  await page.getByLabel('Situação da categoria').selectOption('Publicado');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByLabel('Situação da categoria')).toHaveValue('Publicado');

  await page.goto('/matches/new?modalidade=Futsal');
  await expect(page.getByLabel('Modalidade')).toHaveValue('Futsal');
  await expect(page.getByLabel('Categoria')).toContainText('Futsal Ordem E2E');
});

test('modalidade sem categoria publicada aparece no dropdown, com o motivo', async ({ page }) => {
  // O relato: "mesmo tendo a modalidade ativa, não dá pra selecionar uma
  // modalidade no dropdown". A lista vinha das categorias publicadas, então a
  // modalidade sumia — sem nenhuma pista de que faltava publicar.
  await loginAs(page);
  await page.goto('/matches/new');
  await page.getByLabel('Modalidade').selectOption('Handebol');
  await expect(page.getByRole('link', { name: 'Crie uma categoria' })).toBeVisible();

  await page.getByLabel('Modalidade').selectOption('Xadrez');
  await expect(page.getByRole('link', { name: 'Publique a categoria' })).toBeVisible();
});

test('adicionar modalidade carrega e salva o regulamento padrão', async ({ page }) => {
  await loginAs(page);
  await page.goto('/disciplines/new');
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

test('o + da modalidade cria categoria, não outra modalidade', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/new?modalidade=Futsal');
  await expect(page.getByRole('heading', { name: 'CRIAR CATEGORIA' })).toBeVisible();
  await expect(page.getByLabel('Modalidade')).toHaveValue('Futsal');
  await page.getByLabel('Nome da categoria').fill('Futsal Misto E2E');
  await page.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(page).toHaveURL(/\/tournaments\/category-[a-z0-9-]+\?aba=regras/);
  await expect(page.getByRole('heading', { name: 'PARTICIPANTES E ORDEM DO SORTEIO' })).toBeVisible();
  const created = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('intereng:app-state:v1') ?? '{}').tournaments ?? {}).find((item: unknown) => (item as { name?: string }).name === 'Futsal Misto E2E'));
  expect((created as { discipline?: string; status?: string })?.discipline).toBe('Futsal');
  expect((created as { discipline?: string; status?: string })?.status).toBe('Rascunho');
});

test('remove atleta da equipe e o elenco recalcula', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams/alcateia');
  // O cabeçalho conta o elenco real, não o número fixo do catálogo.
  await expect(page.getByText('2 atletas cadastrados na edição')).toBeVisible();

  // Ana Lima joga Futsal, que já está no mata-mata: o elenco está travado.
  await page.getByRole('button', { name: 'Remover Ana Lima da equipe' }).click();
  await expect(page.locator('.app-toast.toast-error')).toContainText(/mata-mata/i);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  // Vôlei ainda está na fase de grupos: o elenco pode ser alterado.
  await page.locator('details.team-modality').filter({ hasText: 'Vôlei' }).locator('summary').click();
  await page.getByRole('button', { name: 'Remover Marina Souza da equipe' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Remover' }).click();

  await expect(page.getByText('1 atleta cadastrado na edição')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remover Marina Souza da equipe' })).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('intereng:app-state:v1') ?? '{}').athletes?.['marina-souza']);
  expect(stored?.removed).toBe(true);
  expect(stored?.name).toBe('Marina Souza');
});

test('auditoria é exclusiva do super admin', async ({ page }) => {
  await loginAs(page, 'ana@ufpe.br', 'intereng2026');
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'ACESSO RESTRITO' })).toBeVisible();
  await page.goto('/more');
  await expect(page.getByRole('link', { name: /auditoria/i })).toHaveCount(0);
});

test('auditoria começa vazia e passa a registrar o que foi feito', async ({ page }) => {
  await loginAs(page, 'super@intereng.com', 'super2026');
  await page.goto('/audit');
  // Nunca mostrar exemplo: um registro inventado aqui seria lido como real.
  await expect(page.locator('.empty-state').getByText('SEM REGISTROS')).toBeVisible();
  await expect(page.getByText('Nenhuma alteração registrada ainda.')).toBeVisible();

  await page.goto('/teams/alcateia');
  await page.locator('details.team-modality').filter({ hasText: 'Vôlei' }).locator('summary').click();
  await page.getByRole('button', { name: 'Remover Marina Souza da equipe' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remover' }).click();

  await page.goto('/audit');
  await expect(page.locator('.empty-state')).toHaveCount(0);
  await expect(page.getByText('Atleta removido da equipe')).toBeVisible();
});

test('só o super admin concede acesso de admin da edição', async ({ page }) => {
  await loginAs(page, 'ana@ufpe.br', 'intereng2026');
  await page.goto('/staff/new');
  // O organizador convida gestor, não outro admin.
  await expect(page.getByLabel('Papel').locator('option')).toHaveText(['Gestor de modalidade']);

  await page.goto('/login');
  await loginAs(page, 'super@intereng.com', 'super2026');
  await page.goto('/staff/new');
  await expect(page.getByLabel('Papel').locator('option')).toHaveText(['Admin da edição', 'Gestor de modalidade']);
});

test('gestor cria categoria dentro da própria modalidade', async ({ page }) => {
  await loginAs(page, 'bruno@ufpe.br', 'futsal2026');
  await page.goto('/tournaments/new');
  await expect(page.getByRole('heading', { name: 'CRIAR CATEGORIA' })).toBeVisible();
  // Só a modalidade do escopo dele é oferecida.
  await expect(page.getByLabel('Modalidade').locator('option')).toHaveText(['Futsal']);
});

test('renomeia categoria e torneio, e a correção aparece nas listas', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/futsal-m?aba=regras');
  await page.getByRole('button', { name: 'Renomear categoria' }).click();
  await page.getByLabel('Nome da categoria').fill('Futsal Masculino A');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await page.goto('/disciplines/futsal');
  await expect(page.getByText('Futsal Masculino A')).toBeVisible();

  // Renomear o torneio é ação global no servidor (competition/rename está em
  // GLOBAL_ACTIONS): o admin da edição via a tela inteira e cada botão dela
  // terminava em 403 com aviso genérico. Agora a tela é legível para ele e
  // editável só para quem o servidor deixa editar.
  await page.goto('/competitions');
  await expect(page.getByRole('button', { name: /Renomear InterEng/i })).toHaveCount(0);
  await expect(page.getByText(/definidos pelo super administrador/i)).toBeVisible();

  await loginAs(page, 'super@intereng.com', 'super2026');
  await page.goto('/competitions');
  await page.getByRole('button', { name: /Renomear InterEng/i }).click();
  await page.getByLabel('Nome do torneio').fill('InterEng UFPE');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByRole('button', { name: 'InterEng UFPE', exact: true })).toBeVisible();
});

test('a migalha do cadastro de atleta não leva a lugar nenhum', async ({ page }) => {
  await loginAs(page);
  await page.goto('/teams/alcateia/athletes/new');
  await page.getByRole('navigation', { name: 'Caminho da página' }).getByRole('link', { name: 'Atletas' }).click();
  // Antes caía em 404; agora volta para a equipe, onde o elenco vive.
  await expect(page).toHaveURL(/\/teams\/alcateia$/);
  await expect(page.getByRole('heading', { name: 'ALCATEIA', exact: true })).toBeVisible();
});

test('gestor cadastra atleta, e apenas na modalidade dele', async ({ page }) => {
  // O elenco deixou de ser exclusivo do admin da edição. O que continua travado
  // é o alcance: o formulário oferece só a modalidade do gestor, porque o
  // servidor recusa qualquer outra — oferecer a lista inteira seria deixar a
  // pessoa preencher tudo para receber erro no fim.
  await loginAs(page, 'bruno@ufpe.br', 'futsal2026');
  await page.goto('/teams/alcateia/athletes/new');
  await expect(page.getByRole('heading', { name: 'ACESSO RESTRITO' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'NOVO ATLETA' })).toBeVisible();

  await page.getByLabel('Nome completo').fill('Atleta do Gestor');
  await page.getByRole('button', { name: 'Cadastrar e continuar' }).click();

  const modalidades = page.locator('.modality-check');
  await expect(modalidades).toHaveCount(1);
  await expect(modalidades.first()).toContainText('Futsal');
  // Sem "Pular por enquanto": salvar sem modalidade seria recusado pelo servidor.
  await expect(page.getByRole('button', { name: 'Pular por enquanto' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(page).toHaveURL(/\/teams\/alcateia/);
  // Presença no elenco, não visibilidade: os grupos por modalidade são um
  // acordeão e só o primeiro nasce aberto (`open={index === 0}`). Se o atleta
  // cair num grupo fechado ele existe e fica oculto, e o teste reprovaria por
  // um detalhe de apresentação que não é o que ele verifica.
  await expect(page.locator('.roster-manage-row', { hasText: 'Atleta do Gestor' })).toHaveCount(1);
});

test('gestor fica restrito à própria modalidade', async ({ page }) => {
  await loginAs(page, 'bruno@ufpe.br', 'futsal2026');
  await page.goto('/competitions');
  await expect(page.getByRole('heading', { name: 'ACESSO RESTRITO' })).toBeVisible();
  await page.goto('/teams/new');
  await expect(page.getByRole('heading', { name: 'ACESSO RESTRITO' })).toBeVisible();
  // Pedir a agenda de outra modalidade não leva o gestor para fora do escopo:
  // a tela volta para a modalidade dele, e o agendamento oferecido é o dela.
  // (A asserção anterior exigia zero links "agendar jogo" aqui e já falhava —
  // o botão do cabeçalho sempre teve nome acessível e sempre foi o de Futsal.)
  await page.goto('/matches?modalidade=V%C3%B4lei');
  await expect(page.getByText('Jogos e resultados somente de Futsal')).toBeVisible();
  await expect(page.getByRole('link', { name: /agendar jogo de vôlei/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Agendar jogo de Futsal' })).toBeVisible();
  await page.goto('/matches/new?modalidade=V%C3%B4lei');
  await expect(page.getByLabel('Modalidade').locator('option')).toHaveText(['Selecione a modalidade', 'Futsal']);
});

test('gestor alcança a própria modalidade pela navegação principal', async ({ page }) => {
  await loginAs(page, 'bruno@ufpe.br', 'futsal2026');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Modalidades' }).click();
  await expect(page.getByRole('heading', { name: 'ACESSO RESTRITO' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'MODALIDADES' })).toBeVisible();
  // Vê apenas o próprio escopo, e não pode adicionar modalidade.
  await expect(page.locator('.discipline-card')).toHaveCount(1);
  await expect(page.locator('.discipline-card')).toContainText('Futsal');
  await expect(page.getByRole('link', { name: 'Adicionar modalidade' })).toHaveCount(0);

  await page.locator('.discipline-card').click();
  await expect(page.getByRole('heading', { name: 'CATEGORIAS' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar regras' })).toBeVisible();
  // Habilitar/remover modalidade continua sendo do admin da edição.
  await expect(page.getByRole('button', { name: 'Remover da edição' })).toHaveCount(0);
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

test('falha ao gravar mostra erro e preserva o que foi digitado', async ({ page }) => {
  await loginAs(page);
  // Conexão é obrigatória: sem fila offline, a escrita que falha precisa avisar.
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'intereng:app-state:v1') throw new Error('Não foi possível salvar.');
      return original.call(this, key, value);
    };
  });
  await page.goto('/teams/new');
  await page.getByLabel('Nome da equipe').fill('Equipe Sem Rede');
  await page.getByLabel('Sigla').fill('ESR');
  await page.getByLabel('Responsável').fill('Pessoa Responsável');
  await page.getByRole('button', { name: 'Cadastrar equipe' }).click();

  await expect(page.locator('.app-toast.toast-error')).toContainText(/não foi possível salvar/i);
  await expect(page).toHaveURL(/\/teams\/new/);
  await expect(page.getByLabel('Nome da equipe')).toHaveValue('Equipe Sem Rede');
  await expect(page.getByRole('button', { name: 'Cadastrar equipe' })).toBeEnabled();
});

test('sessão expirada volta ao login com aviso', async ({ page }) => {
  await loginAs(page);
  // O prazo da sessão vence enquanto o app está aberto.
  await page.evaluate(() => {
    for (const store of [localStorage, sessionStorage]) {
      const raw = store.getItem('intereng:frontend-session');
      if (raw) store.setItem('intereng:frontend-session', JSON.stringify({ ...JSON.parse(raw), expiresAt: new Date(Date.now() - 1000).toISOString() }));
    }
  });

  await page.goto('/teams');
  await expect(page).toHaveURL(/\?access=expired/);
  await expect(page.getByRole('status')).toContainText(/sessão expirou/i);
});

test('o painel do gestor não oferece porta fechada', async ({ page }) => {
  await loginAs(page, 'bruno@ufpe.br', 'futsal2026');
  await page.goto('/dashboard');

  // A consulta global de atletas é da edição inteira: some do painel do gestor.
  await expect(page.locator('.stat-card')).toHaveCount(3);
  await expect(page.getByRole('link', { name: /atletas/i })).toHaveCount(0);
  // Volta por URL, e não por `goBack()`: o histórico só é confiável se cada
  // clique empilhar exatamente uma entrada, e basta um que não navegue para o
  // laço andar para trás demais e cair na tela de login — que era a falha
  // intermitente, reproduzida em 1 de 3 execuções locais.
  const destinos = await page.locator('.stat-card').evaluateAll((cards) =>
    cards.map((card) => (card as HTMLAnchorElement).getAttribute('href') ?? ''));
  for (const destino of destinos) {
    await page.goto(destino);
    await expect(page.getByRole('heading', { name: 'ACESSO RESTRITO' })).toHaveCount(0);
  }
});

test('preferência do aparelho não vira operação da edição', async ({ page }) => {
  await loginAs(page, 'super@intereng.com', 'super2026');
  await page.goto('/matches?modalidade=Futsal');
  await page.getByRole('button', { name: 'Vôlei' }).click();
  await expect(page).toHaveURL(/modalidade=V%C3%B4lei/);

  const preferencia = await page.evaluate(() => JSON.parse(localStorage.getItem('intereng:preferences:v1') ?? '{}'));
  expect(preferencia.selectedDiscipline).toBe('Vôlei');

  // Som, modalidade e notificação são do aparelho: não entram na auditoria.
  await page.goto('/audit');
  await expect(page.getByText(/preferência/i)).toHaveCount(0);
});
