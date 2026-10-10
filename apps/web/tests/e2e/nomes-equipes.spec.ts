import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/*
 * O nome da atlética na lista de equipes está em uma fonte larga (Aldo the
 * Apache) e o cartão gasta metade da largura com o escudo. Com tamanho fixo por
 * degrau, "COMPRESSORA" (o nome mais largo da Copa Halterada) quebrava no meio a
 * 360px. O tamanho agora acompanha a largura da tela.
 *
 * O teste troca o texto do primeiro cartão pelos nomes mais largos e mede: uma
 * linha só e nada para fora da caixa, em todas as larguras de celular.
 */
const NOMES_LARGOS = ['Compressora', 'Inquisidores', 'Cangaceiros', 'Thenebrosa'];
const LARGURAS = [320, 340, 360, 375, 390, 414, 430];

for (const rota of ['/teams', '/public/teams']) {
  test(`os nomes mais largos cabem em uma linha em ${rota}, de 320 a 430px`, async ({ page }) => {
    await loginAs(page);
    const falhas: string[] = [];
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto(rota, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
      const medidas = await page.evaluate((nomes) => {
        const h = document.querySelector('.team-card .team-copy h2, .team-card h2') as HTMLElement | null;
        if (!h) return null;
        return nomes.map((nome) => {
          h.textContent = nome;
          const altura = parseFloat(getComputedStyle(h).lineHeight);
          return {
            nome,
            linhas: Math.round(h.getBoundingClientRect().height / altura),
            sobra: h.scrollWidth - h.clientWidth,
          };
        });
      }, NOMES_LARGOS);
      expect(medidas, `nenhum cartão de equipe em ${rota}`).not.toBeNull();
      for (const m of medidas ?? []) {
        if (m.linhas !== 1 || m.sobra > 1) falhas.push(`${largura}px ${m.nome}: ${m.linhas} linha(s), sobra ${m.sobra}px`);
      }
    }
    expect(falhas, falhas.join('\n')).toEqual([]);
  });
}
