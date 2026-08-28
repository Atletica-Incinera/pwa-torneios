import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('categoria abre na tabela e alterna as abas sem sair da tela', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/futsal-m');

  const tabs = page.getByRole('tablist', { name: 'Seções da categoria' });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Tabela' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÃO E FASES' })).toBeVisible();

  await tabs.getByRole('tab', { name: 'Participantes' }).click();
  await expect(tabs.getByRole('tab', { name: 'Participantes' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/aba=participantes/);
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÃO E FASES' })).toHaveCount(0);

  await tabs.getByRole('tab', { name: 'Jogos' }).click();
  await expect(page.getByRole('heading', { name: 'AGENDA DA CATEGORIA' })).toBeVisible();

  // Abas navegam por seta, como manda o padrão ARIA.
  await tabs.getByRole('tab', { name: 'Jogos' }).press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Fases' })).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: 'Fases' }).press('Home');
  await expect(tabs.getByRole('tab', { name: 'Tabela' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\/tournaments\/futsal-m/);
});

test('a gestão da categoria virou a aba Regras', async ({ page }) => {
  await loginAs(page);
  await page.goto('/tournaments/futsal-m/manage');
  await expect(page).toHaveURL(/\/tournaments\/futsal-m\?aba=regras/);
  await expect(page.getByRole('heading', { name: 'PARTICIPANTES E ORDEM DO SORTEIO' })).toBeVisible();
});

test('modalidade lista suas categorias e leva à categoria', async ({ page }) => {
  await loginAs(page);
  await page.goto('/disciplines');
  await expect(page.getByRole('heading', { name: 'MODALIDADES' })).toBeVisible();
  await page.getByRole('link', { name: /futsal/i }).first().click();
  await expect(page.getByRole('heading', { name: 'CATEGORIAS' })).toBeVisible();
  await page.getByRole('link', { name: /futsal masculino/i }).first().click();
  await expect(page).toHaveURL(/\/tournaments\/futsal-m/);
});

test('espectador navega por três destinos e vê as abas da categoria', async ({ page }) => {
  await page.goto('/public');
  await expect(page.getByRole('heading', { name: 'AO VIVO' })).toBeVisible();
  await expect(page.getByText(/registrar gol|editar partida|configurações/i)).toHaveCount(0);

  const nav = page.getByRole('navigation', { name: 'Navegação pública' });
  // Quatro desde que a artilharia ganhou aba propria: ao vivo, modalidades,
  // equipes e artilharia.
  await expect(nav.getByRole('link')).toHaveCount(4);

  await nav.getByRole('link', { name: 'Modalidades' }).click();
  await expect(page.getByRole('heading', { name: 'MODALIDADES' })).toBeVisible();
  await page.getByRole('link', { name: /futsal masculino/i }).first().click();

  const tabs = page.getByRole('tablist', { name: 'Seções da categoria' });
  await expect(tabs.getByRole('tab', { name: 'Tabela' })).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: 'Jogos' }).click();
  // Uma aba só para os jogos, como no admin: próximos e encerrados na sequência.
  await expect(page.getByRole('heading', { name: 'PRÓXIMOS JOGOS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'JOGOS ENCERRADOS' })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Fases' }).click();
  await expect(page.getByRole('heading', { name: 'ETAPAS DA DISPUTA' })).toBeVisible();
  await expect(page.getByText(/registrar gol|editar partida|configurações/i)).toHaveCount(0);
});

test('cards mostram inscrição pendente em vez de número inventado', async ({ page }) => {
  // A semente publicada nasce com inscritos — sem eles a API recusa agendar, e
  // "Em andamento" ainda travaria a estrutura sem caminho de conserto. Quem
  // exercita o caso "sem ninguém inscrito" é a categoria em rascunho, que só a
  // área administrativa enxerga.
  await loginAs(page);
  await page.goto('/disciplines/xadrez');
  const rascunho = page.locator('.tournament-card').filter({ hasText: 'Xadrez Individual' });
  await expect(rascunho).toContainText('Inscrição pendente');
  await expect(rascunho).not.toContainText('inscritas');

  await page.goto('/public/tournaments');
  const publicada = page.locator('.tournament-card').filter({ hasText: 'Futsal Masculino' });
  await expect(publicada).toContainText('4 inscritas');
});

test('as rotas públicas antigas levam para modalidades', async ({ page }) => {
  for (const legacy of ['/public/matches', '/public/standings', '/public/results', '/public/phases']) {
    await page.goto(legacy);
    await expect(page).toHaveURL(/\/public\/tournaments/);
  }
});

test('barra de navegação permanece fixa durante a rolagem', async ({ page }) => {
  await page.goto('/public/teams');
  const nav = page.locator('.bottom-nav');
  const initial = await nav.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const afterScroll = await nav.boundingBox();
  expect(initial).not.toBeNull();
  expect(afterScroll).not.toBeNull();
  expect(Math.abs((afterScroll?.y ?? 0) - (initial?.y ?? 0))).toBeLessThan(2);
});

test('detalhe da equipe apresenta classificação e desempenho por modalidade', async ({ page }) => {
  await page.goto('/public/teams/alcateia');
  await expect(page.getByRole('heading', { name: 'CLASSIFICAÇÕES' })).toBeVisible();
  await expect(page.getByText(/Ranking geral do InterEng/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /ver classificação/i }).first()).toBeVisible();
});

test('admin entra e preserva a modalidade ao navegar', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.locator('input[aria-label="Senha"]')).toHaveAttribute('type', 'text');
  await page.getByLabel('E-mail').fill('ana@ufpe.br');
  await page.locator('input[aria-label="Senha"]').fill('intereng2026');
  await page.getByRole('button', { name: 'ENTRAR' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/matches?modalidade=V%C3%B4lei');
  await page.getByRole('button', { name: 'Vôlei' }).click();
  await page.getByRole('link', { name: /^equipes$/i }).last().click();
  await page.getByRole('link', { name: /^jogos$/i }).last().click();
  await expect(page).toHaveURL(/modalidade=V%C3%B4lei/);
});

test('regressão visual: equipes públicas', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public/teams');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-teams-mobile.png' : 'public-teams-desktop.png', { fullPage: true });
});

test('regressão visual: placares públicos', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00-03:00'));
  await page.goto('/public');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-live-mobile.png' : 'public-live-desktop.png', { fullPage: true, timeout: 30_000 });
});

test('regressão visual: modalidades públicas', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public/tournaments');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-tournaments-mobile.png' : 'public-tournaments-desktop.png', { fullPage: true });
});

test('regressão visual: detalhes da equipe pública', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.goto('/public/teams/alcateia');
  const mobile = test.info().project.name === 'mobile-chromium';
  await expect(page).toHaveScreenshot(mobile ? 'public-team-detail-mobile.png' : 'public-team-detail-desktop.png', { fullPage: true });
});

test('sem os dados da edição, a tela pública avisa e oferece nova tentativa', async ({ page }) => {
  // O espectador só vê resultado oficial: falhando o snapshot, nada é exibido
  // como se fosse definitivo — aparece o aviso com nova tentativa.
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(key: string) {
      if (key === 'intereng:app-state:v1') throw new Error('Armazenamento indisponível.');
      return original.call(this, key);
    };
  });
  await page.goto('/public');
  const alert = page.locator('main.global-state-screen[role="alert"]');
  await expect(alert).toContainText('DADOS INDISPONÍVEIS');
  await expect(alert.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AO VIVO', exact: true })).toHaveCount(0);
});

test('endereço antigo de aba pública ainda abre a seção certa', async ({ page }) => {
  // Agenda e resultados viraram uma aba só; o link antigo continua funcionando.
  await page.goto('/public/tournaments/futsal-m?aba=resultados');
  const tabs = page.getByRole('tablist', { name: 'Seções da categoria' });
  await expect(tabs.getByRole('tab', { name: 'Jogos' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'JOGOS ENCERRADOS' })).toBeVisible();
});
