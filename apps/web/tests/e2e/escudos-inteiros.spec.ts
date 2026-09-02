import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Os escudos das atleticas sao brasoes: contorno proprio, fundo transparente e
 * uma faixa com o nome na base. O componente que os exibia impunha um disco
 * branco e um recorte circular, e o recorte comia justamente os cantos da
 * faixa -- o nome da atletica aparecia mutilado em toda tela de equipe.
 *
 * Aqui a verificacao e por medida, nao por captura: fundo transparente,
 * nenhum arredondamento e nenhum pixel da imagem fora da caixa. Regra de fundo
 * colorido nova em qualquer tema (`.theme-matches .team-mark`, `.mark-blue`,
 * `.match-score-card`...) reacende este teste, que e como o problema voltou a
 * aparecer tela a tela enquanto era corrigido.
 */
const TRANSPARENTE = 'rgba(0, 0, 0, 0)';

/*
 * A lista precisa alcancar TODA tela que mostra escudo, e nao uma amostra.
 * A primeira versao parava em `/matches` e deixava o detalhe da partida de
 * fora -- e era la que sobrevivia um quadrado laranja atras de cada brasao,
 * pintado por uma regra que nomeia `.team-mark` em vez de `.team-mark-logo`.
 * Passou semanas em producao porque nada olhava aquela tela.
 */
const ROTAS_PUBLICAS = [
  '/public',
  '/public/teams',
  '/public/teams/alcateia',
  '/public/matches',
  '/public/tournaments/futsal-m',
];
const ROTAS_INTERNAS = [
  '/teams',
  '/teams/alcateia',
  '/matches',
  '/matches/semifinal-1',
  '/matches/live?partida=semifinal-1',
  '/tournaments/futsal-m',
  '/dashboard',
];

async function inspecionar(page: import('@playwright/test').Page) {
  // Algumas rotas publicas redirecionam depois de carregar (a de placares
  // manda para a aba certa). Medir no meio disso derruba o contexto.
  await page.waitForLoadState('networkidle');
  return page.$$eval('.team-mark-logo', (els) =>
    els.map((el) => {
      const img = el.querySelector('img') as HTMLImageElement;
      const caixa = el.getBoundingClientRect();
      const dentro = img.getBoundingClientRect();
      return {
        escudo: img.getAttribute('src')?.split('/').pop() ?? '?',
        fundo: getComputedStyle(el).backgroundColor,
        fundoImagem: getComputedStyle(img).backgroundColor,
        raio: getComputedStyle(el).borderRadius,
        raioImagem: getComputedStyle(img).borderRadius,
        transborda: Math.round(
          Math.max(
            0,
            caixa.top - dentro.top,
            dentro.bottom - caixa.bottom,
            caixa.left - dentro.left,
            dentro.right - caixa.right,
          ),
        ),
      };
    }),
  );
}

function conferir(achados: Awaited<ReturnType<typeof inspecionar>>, rota: string) {
  for (const a of achados) {
    const onde = `${rota} — ${a.escudo}`;
    expect(a.fundo, `${onde}: a caixa do escudo nao pode ter fundo`).toBe(TRANSPARENTE);
    expect(a.fundoImagem, `${onde}: a imagem do escudo nao pode ter fundo`).toBe(TRANSPARENTE);
    expect(a.raio, `${onde}: sem recorte arredondado na caixa`).toMatch(/^0px/);
    expect(a.raioImagem, `${onde}: sem recorte arredondado na imagem`).toMatch(/^0px/);
    expect(a.transborda, `${onde}: a imagem esta sendo cortada pela caixa`).toBe(0);
  }
}

test('escudo aparece inteiro e sem fundo nas telas publicas', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intereng:pwa-install-dismissed', 'true'));
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00-03:00'));
  let total = 0;
  for (const rota of ROTAS_PUBLICAS) {
    await page.goto(rota);
    const achados = await inspecionar(page);
    conferir(achados, rota);
    total += achados.length;
  }
  expect(total, 'nenhum escudo encontrado — o seletor do teste ficou obsoleto').toBeGreaterThan(5);
});

test('escudo aparece inteiro e sem fundo nas telas de gestao', async ({ page }) => {
  await loginAs(page);
  let total = 0;
  for (const rota of ROTAS_INTERNAS) {
    await page.goto(rota);
    const achados = await inspecionar(page);
    conferir(achados, rota);
    total += achados.length;
  }
  expect(total, 'nenhum escudo encontrado — o seletor do teste ficou obsoleto').toBeGreaterThan(0);
});
