import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Oito defeitos visuais relatados a partir do app em produção. Cada um vira
 * aqui uma medida, e não uma impressão: a maioria só é visível em tela
 * estreita, e "parece melhor" não impede o retorno na semana seguinte.
 */


test('rótulo da navegação só quebra em sílaba, nunca no meio da palavra', async ({ page }) => {
  // `overflow-wrap: anywhere` quebrava "Modalidades" em "Modalidad/es". O que
  // ficou proibido e a quebra arbitraria, nao a quebra: com cinco colunas de
  // largura igual, "Modalidades" nao cabe numa linha em tela estreita, e
  // insistir nisso era o que desalinhava os icones. `hyphens: auto` com
  // `lang="pt-BR"` quebra na silaba e mostra o hifen.
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page);
  await expect(page.locator('.nav-item').first()).toBeVisible();
  const rotulos = await page.locator('.nav-item > span:not(.nav-icon)').evaluateAll((spans) =>
    spans.filter((s) => s.textContent?.trim()).map((s) => {
      const cs = getComputedStyle(s);
      const altura = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const caixa = s.getBoundingClientRect();
      const item = (s.parentElement as HTMLElement).getBoundingClientRect();
      return {
        texto: s.textContent?.trim(),
        linhas: Math.round(caixa.height / altura),
        quebraArbitraria: cs.overflowWrap,
        hifenizacao: cs.hyphens,
        transborda: Math.round(Math.max(0, item.left - caixa.left, caixa.right - item.right)),
      };
    }));
  expect(rotulos.length).toBeGreaterThan(0);
  for (const item of rotulos) {
    expect(item.quebraArbitraria, `"${item.texto}" pode quebrar em qualquer letra`).not.toMatch(
      /anywhere|break-word/,
    );
    expect(item.hifenizacao, `"${item.texto}" sem hifenização`).toBe('auto');
    expect(item.linhas, `"${item.texto}" ocupou ${item.linhas} linhas`).toBeLessThanOrEqual(2);
    expect(item.transborda, `"${item.texto}" transborda a própria coluna`).toBe(0);
  }
});

test('ícones da navegação ficam igualmente espaçados e na mesma linha', async ({ page }) => {
  // As colunas eram `repeat(5, minmax(44px, auto))` com `space-between`: cada
  // uma ficava do tamanho do proprio rotulo, entao "Modalidades" ocupava o
  // dobro de "Mais". Medidos na producao, os centros caiam em 32, 146, 259,
  // 355 e 450px -- vaos de 114, 113, 96 e 95.
  await loginAs(page);
  for (const largura of [480, 375, 320]) {
    await page.setViewportSize({ width: largura, height: 812 });
    await expect(page.locator('.nav-item').first()).toBeVisible();
    const icones = await page.locator('.bottom-nav .nav-item').evaluateAll((itens) =>
      itens.map((el) => {
        const caixa = el.getBoundingClientRect();
        const svg = (el.querySelector('svg') as SVGElement).getBoundingClientRect();
        return {
          centro: svg.x + svg.width / 2,
          topo: Math.round(svg.y),
          desvio: Math.round(svg.x + svg.width / 2 - (caixa.x + caixa.width / 2)),
        };
      }));
    expect(icones.length).toBe(5);
    const topos = new Set(icones.map((i) => i.topo));
    expect(topos.size, `a ${largura}px os ícones estão em ${topos.size} alturas diferentes`).toBe(1);
    for (const icone of icones) {
      expect(Math.abs(icone.desvio), `ícone fora do centro da própria coluna a ${largura}px`).toBeLessThanOrEqual(1);
    }
    const vaos = icones.slice(1).map((icone, i) => Math.round(icone.centro - icones[i].centro));
    const maior = Math.max(...vaos);
    const menor = Math.min(...vaos);
    expect(maior - menor, `a ${largura}px os vãos entre ícones variam: ${vaos.join(', ')}`).toBeLessThanOrEqual(1);
  }
});

test('título da tela cabe em uma linha ao lado do botão de ação', async ({ page }) => {
  // O botão rotulado dividia a linha com o h1 e deixava 146px de 375 para o
  // título — "MODALIDADES" pede 191px e partia no meio.
  await loginAs(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/disciplines');
  const h1 = page.locator('.page-heading h1').first();
  await expect(h1).toBeVisible();
  const medida = await h1.evaluate((el) => {
    const cs = getComputedStyle(el);
    const altura = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
    return { linhas: Math.round(el.getBoundingClientRect().height / altura), largura: el.clientWidth };
  });
  expect(medida.linhas).toBe(1);
  expect(medida.largura).toBeGreaterThan(250);
});

test('nome da modalidade é maior que o número decorativo do cartão', async ({ page }) => {
  // Estava invertido: nome com 19px e o índice "01" com 38px.
  await loginAs(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/disciplines');
  const tamanhos = await page.locator('.discipline-card').first().evaluate((card) => ({
    nome: parseFloat(getComputedStyle(card.querySelector('h2')!).fontSize),
    indice: parseFloat(getComputedStyle(card.querySelector('.discipline-index')!).fontSize),
  }));
  expect(tamanhos.nome).toBeGreaterThanOrEqual(tamanhos.indice);
});

test('campos de regra não ficam em três colunas espremidas no celular', async ({ page }) => {
  // A media query existia, mas vinha ANTES da regra base no arquivo e perdia o
  // empate de especificidade. Resultado: três colunas de 88px num aparelho de
  // 375px, com rótulo de cinco linhas sobre campo minúsculo.
  await loginAs(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/disciplines/futsal');
  await page.getByRole('button', { name: /editar regras/i }).first().click();
  const grade = page.locator('.rule-fields').first();
  await expect(grade).toBeVisible();
  const colunas = await grade.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(colunas).toBe(1);
});

test('campo em foco fica visivelmente diferente do campo em repouso', async ({ page }) => {
  // `outline: 0` apagava o anel global e a regra de foco pintava a borda da cor
  // que ela já tinha: o campo focado era byte a byte igual ao não focado.
  await loginAs(page);
  await page.goto('/staff/new');
  const campo = page.locator('.entity-form input').first();
  // O primeiro campo do formulario nasce com autoFocus: sem isto, o estado
  // "de repouso" seria medido ja focado e o teste passaria por engano.
  await campo.evaluate((el: HTMLElement) => el.blur());
  const repouso = await campo.evaluate((el) => {
    const cs = getComputedStyle(el);
    return `${cs.borderColor}|${cs.boxShadow}|${cs.outlineStyle}`;
  });
  await campo.focus();
  const foco = await campo.evaluate((el) => {
    const cs = getComputedStyle(el);
    return `${cs.borderColor}|${cs.boxShadow}|${cs.outlineStyle}`;
  });
  expect(foco).not.toBe(repouso);
});

test('a tela de torneios não tem texto abaixo do contraste mínimo', async ({ page }) => {
  // Fundo laranja com texto creme mede 1,85:1. O mínimo da WCAG AA é 4,5:1
  // para texto normal; seis elementos desta tela estavam abaixo.
  await loginAs(page);
  await page.goto('/competitions');
  await expect(page.getByRole('heading', { name: 'INTERENG' })).toBeVisible();
  const ruins = await page.evaluate(() => {
    const canal = (cor: string) => (cor.match(/[0-9.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number).map((v) => {
      const n = v / 255;
      return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    const luz = (cor: string) => { const [r, g, b] = canal(cor); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const razao = (a: string, b: string) => {
      const [alto, baixo] = luz(a) > luz(b) ? [luz(a), luz(b)] : [luz(b), luz(a)];
      return (alto + 0.05) / (baixo + 0.05);
    };
    const fundo = (el: Element): string => {
      let n: Element | null = el;
      while (n) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0)')) return bg;
        n = n.parentElement;
      }
      return 'rgb(255, 255, 255)';
    };
    return [...document.querySelectorAll('main *')]
      .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 2)
      .map((el) => ({
        texto: (el.textContent ?? '').trim().slice(0, 40),
        razao: Math.round(razao(getComputedStyle(el).color, fundo(el)) * 100) / 100,
      }))
      .filter((x) => x.razao < 4.5);
  });
  expect(ruins, `abaixo de 4,5:1 — ${JSON.stringify(ruins)}`).toEqual([]);
});

test('as datas da edição aparecem no formato brasileiro', async ({ page }) => {
  // A tela mostrava o dateKey cru (2026-09-05) em vez de 05/09/2026.
  await loginAs(page);
  await page.goto('/competitions');
  const periodo = page.locator('.featured-context span').last();
  await expect(periodo).toHaveText(/\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/);
});

test('selo de status não quebra por dentro', async ({ page }) => {
  // A correção anterior fazia o selo encolher e quebrar a palavra: "Rascunho"
  // ocupava duas linhas em 72px e "Fase de grupos" três. Selo é rótulo curto —
  // ou cabe inteiro, ou desce para a linha seguinte. Quem quebra é a linha.
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page);
  await page.goto('/disciplines/xadrez');
  const cartao = page.locator('.tournament-card').first();
  await expect(cartao).toBeVisible();
  const medida = await cartao.evaluate((card) => {
    const linhas = (el: Element) => { const f = document.createRange(); f.selectNodeContents(el); return f.getClientRects().length; };
    const borda = card.getBoundingClientRect();
    return [...card.querySelectorAll('.status-badge')].map((el) => ({
      texto: (el.textContent ?? '').trim(),
      linhas: linhas(el),
      estoura: el.getBoundingClientRect().right > borda.right + 1,
    }));
  });
  expect(medida.length).toBeGreaterThan(0);
  for (const selo of medida) {
    expect(selo.linhas, `selo "${selo.texto}" quebrou em ${selo.linhas} linhas`).toBe(1);
    expect(selo.estoura, `selo "${selo.texto}" ultrapassou o cartão`).toBe(false);
  }
});
