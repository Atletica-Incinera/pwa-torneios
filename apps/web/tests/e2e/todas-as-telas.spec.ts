import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Varredura de todas as telas do app.
 *
 * Nove rotas não eram visitadas por teste nenhum — entre elas a lista pública
 * de jogos, a de fases, a de resultados e a promoção de super admin. Uma tela
 * que ninguém abre é uma tela que pode estar quebrada há semanas sem ninguém
 * saber, e o evento é o pior momento para descobrir.
 *
 * A verificação é rasa de propósito: a tela responde, tem conteúdo e não
 * derruba erro no console. O que cada uma faz é assunto dos testes próprios
 * delas; aqui o que se garante é que nenhuma está morta.
 */
const PUBLICAS = [
  '/',
  '/public',
  '/public/matches',
  '/public/matches/semifinal-1',
  '/public/phases',
  '/public/results',
  '/public/scorers',
  '/public/standings',
  '/public/standings/general',
  '/public/teams',
  '/public/teams/alcateia',
  '/public/tournaments',
  '/public/tournaments/futsal-m',
  '/offline',
];

const INTERNAS = [
  '/dashboard',
  '/matches',
  '/matches/semifinal-1',
  '/matches/semifinal-1/manage',
  '/matches/live?partida=semifinal-1',
  '/matches/new',
  '/teams',
  '/teams/alcateia',
  '/teams/alcateia/athletes',
  '/teams/alcateia/athletes/new',
  '/teams/new',
  '/athletes',
  '/athletes/ana-lima',
  '/disciplines',
  '/disciplines/futsal',
  '/disciplines/new',
  '/tournaments',
  '/tournaments/futsal-m',
  '/tournaments/futsal-m/manage',
  '/tournaments/new',
  '/standings',
  '/staff',
  '/staff/new',
  '/staff/promote',
  '/competitions',
  '/competitions/new',
  '/audit',
  '/profile',
  '/more',
];

/** Erros que não são da tela: extensões, favicon, ruído de rede do ambiente. */
function relevante(texto: string) {
  return !/favicon|ERR_INTERNET_DISCONNECTED|net::ERR_ABORTED|Download the React DevTools/i.test(
    texto,
  );
}

async function abrir(page: import('@playwright/test').Page, rota: string) {
  const erros: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && relevante(msg.text())) erros.push(msg.text());
  });
  page.on('pageerror', (erro) => erros.push(erro.message));

  await page.goto(rota);
  // A tela respondeu e tem conteúdo: `main` existe e não está vazio.
  const conteudo = (await page.locator('main').first().textContent()) ?? '';
  expect(conteudo.trim().length, `${rota} abriu vazia`).toBeGreaterThan(0);
  // O erro do Next aparece assim quando um componente estoura na renderização.
  await expect(page.getByText(/Application error|Unhandled Runtime Error/i), rota).toHaveCount(0);
  expect(erros, `${rota} derrubou erro no console`).toEqual([]);
}

for (const rota of PUBLICAS) {
  test(`tela pública ${rota}`, async ({ page }) => {
    await abrir(page, rota);
  });
}

test('telas internas', async ({ page }) => {
  // Um login só: entrar em cada uma delas custaria trinta vezes o mesmo trabalho.
  await loginAs(page);
  for (const rota of INTERNAS) {
    await abrir(page, rota);
  }
});

/**
 * A regra genérica se disfarçava de decisão: a tela mostrava "2 × 20 min com
 * cronômetro" para o Queimado do mesmo jeito que mostra para o futsal, e nada
 * dizia que aquilo era um palpite do app.
 *
 * Quem resolve é o admin. O que o app faz é não deixar a lacuna passar por
 * decisão — no dia do evento, a mesa abriria o placar do queimado com um
 * relógio regressivo que não tem nada a ver com o jogo.
 */
test('modalidade sem regulamento definido avisa, em vez de fingir que tem', async ({ page }) => {
  await loginAs(page);
  await page.goto('/disciplines/queimado');

  const aviso = page.locator('.info-banner.banner-atencao');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('ainda não tem regulamento definido');
  await expect(aviso).toContainText('Editar regras');
});

test('modalidade com regulamento próprio não mostra o aviso', async ({ page }) => {
  await loginAs(page);
  await page.goto('/disciplines/futsal');
  await expect(page.locator('.info-banner.banner-atencao')).toHaveCount(0);
});
