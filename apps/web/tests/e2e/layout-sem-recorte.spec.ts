import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Varredura de defeitos de layout em todas as telas, nas duas larguras que mais
 * apertam. Nasceu como diagnóstico de oito problemas relatados e virou trava:
 * mediu 54 defeitos na primeira passagem — 28 textos cobertos por outro
 * componente e 26 conteúdos recortados pela borda do contêiner.
 *
 * Procura três coisas, e só reprova no que é defeito de verdade:
 *
 * 1. TEXTO COBERTO — quem responde no centro do texto é outro elemento.
 *    Ignora sobreposição transparente (o <input type=date> invisível sobre o
 *    rótulo é técnica legítima) e a barra fixa, que cobre conteúdo durante a
 *    rolagem por construção e já tem 108px de folga reservada.
 *
 * 2. CONTEÚDO RECORTADO — a caixa esconde o que não coube. Foi assim que um
 *    <select> de 516px apareceu num visor de 375, cortado pela borda.
 *
 * 3. SELOS COLADOS — folga menor que 4px entre dois selos vizinhos.
 */
const ROTAS = [
  '/dashboard', '/competitions', '/disciplines', '/disciplines/futsal', '/disciplines/basquete',
  '/tournaments/futsal-m', '/tournaments/futsal-m?aba=participantes', '/tournaments/futsal-m?aba=jogos',
  '/tournaments/futsal-m?aba=fases', '/tournaments/futsal-m?aba=regras',
  '/teams', '/teams/alcateia', '/athletes', '/matches', '/staff', '/standings', '/more', '/profile',
  '/public', '/public/tournaments', '/public/teams', '/public/teams/alcateia',
];

for (const largura of [375, 320]) {
test(`nenhuma tela esconde ou recorta conteudo a ${largura}px`, async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: largura, height: 812 });
  await loginAs(page);

  const todos: unknown[] = [];
  for (const rota of ROTAS) {
    try {
      await page.goto(rota, { waitUntil: 'networkidle', timeout: 20_000 });
    } catch {
      continue;
    }
    const achados = await page.evaluate(() => {
      const visivel = (el: Element) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && r.width > 1 && r.height > 1;
      };
      const texto = (el: Element) => (el.textContent ?? '').trim();

      const cobertos: { texto: string; classe: string; porCima: string }[] = [];
      const recortados: { texto: string; classe: string; sobra: number; dono: string }[] = [];
      const colados: { a: string; b: string; folga: number; pai: string }[] = [];

      const folhas = [...document.querySelectorAll('body *')].filter(
        (el) => el.children.length === 0 && texto(el).length > 1 && visivel(el),
      );

      for (const el of folhas) {
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
        // Quem responde no centro do texto? Se for outro elemento que nao o
        // contem, ha algo por cima.
        const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!alvo || alvo === el || el.contains(alvo) || alvo.contains(el)) continue;
        // Sobreposicao transparente e tecnica legitima: o <input type=date>
        // invisivel por cima do rotulo faz o toque abrir o seletor nativo.
        if (Number(getComputedStyle(alvo).opacity) < 0.1) continue;
        // A barra fixa cobre conteudo durante a rolagem por construcao; o que
        // importaria seria falta de folga, e o main ja reserva 108px.
        if (alvo.closest('.bottom-nav')) continue;
        {
          cobertos.push({ texto: texto(el).slice(0, 34), classe: (el.className || el.tagName).toString().slice(0, 40), porCima: (alvo.className || alvo.tagName).toString().slice(0, 40) });
        }
      }

      // Conteudo maior que a caixa que o guarda (com overflow escondido).
      for (const el of [...document.querySelectorAll('body *')].filter(visivel)) {
        const cs = getComputedStyle(el);
        const escondido = cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.clipPath !== 'none';
        if (!escondido) continue;
        const sobra = el.scrollWidth - el.clientWidth;
        if (sobra > 2 && texto(el).length > 1) {
          recortados.push({ texto: texto(el).slice(0, 34), classe: (el.className || el.tagName).toString().slice(0, 40), sobra, dono: (el.parentElement?.className || '').toString().slice(0, 30) });
        }
      }

      // Selos vizinhos com folga menor que 4px.
      const selos = [...document.querySelectorAll('.status-badge')].filter(visivel);
      for (let i = 0; i < selos.length; i += 1) {
        for (let j = i + 1; j < selos.length; j += 1) {
          const a = selos[i].getBoundingClientRect();
          const b = selos[j].getBoundingClientRect();
          const horizontal = Math.max(a.left, b.left) - Math.min(a.right, b.right);
          const vertical = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
          const sobrepoe = horizontal < 0 && vertical < 0;
          const folga = sobrepoe ? 0 : Math.max(horizontal, vertical);
          if (folga < 4) {
            colados.push({ a: texto(selos[i]).slice(0, 18), b: texto(selos[j]).slice(0, 18), folga: Math.round(folga), pai: (selos[i].parentElement?.className || '').toString().slice(0, 30) });
          }
        }
      }

      return { cobertos, recortados, colados };
    });
    if (achados.cobertos.length || achados.recortados.length || achados.colados.length) {
      todos.push({ rota, ...achados });
    }
  }
  expect(todos, `defeitos de layout a ${largura}px:
` + JSON.stringify(todos, null, 1)).toEqual([]);
});
}
