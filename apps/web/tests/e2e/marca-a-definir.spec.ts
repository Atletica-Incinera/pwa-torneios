import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * O confronto do mata-mata entra na agenda antes de existir resultado, com um
 * rótulo no lugar do participante: "Vencedor do Jogo 16". Ele é marcado com
 * `.mark-neutral` — cinza, sem escudo e sem inicial — justamente para não ser
 * lido como um time.
 *
 * Pintado da cor de equipe, "Vencedor do Jogo 16" vira uma atlética com esse
 * nome. E três regras de tema pintavam a marca sem olhar o tom, cada uma
 * vencendo `.mark-neutral` na cascata: a da tela de partidas, a do resumo da
 * partida e a da gestão com jogo agendado.
 *
 * Esse é o mesmo tipo de defeito que comeu os escudos, e voltou a aparecer
 * aqui: regra contextual que pinta `.team-mark` sem exceção nenhuma. Por isso
 * a verificação é por MEDIDA da cascata, em cada contexto que pinta marca — e
 * não por captura de tela, que só mostraria o caso que a semente cobre.
 */
const CINZA = 'rgb(154, 163, 175)';

/** Os invólucros que cada regra de tema exige para valer. */
const CONTEXTOS = [
  { nome: 'tela de partidas', fora: 'theme-matches', dentro: '' },
  { nome: 'gestão com jogo agendado', fora: 'management-screen theme-matches', dentro: 'scheduled-score' },
  { nome: 'resumo da partida', fora: '', dentro: 'match-summary-teams' },
  { nome: 'cartão de jogo', fora: 'match-score-card', dentro: 'team-side' },
  { nome: 'área pública', fora: 'public-app-theme', dentro: 'match-score-card' },
];

async function medir(page: import('@playwright/test').Page) {
  return page.evaluate((contextos) => {
    return contextos.map(({ nome, fora, dentro }) => {
      const externo = document.createElement('div');
      if (fora) externo.className = fora;
      const interno = document.createElement('div');
      if (dentro) interno.className = dentro;
      const neutra = document.createElement('span');
      neutra.className = 'team-mark mark-neutral';
      neutra.textContent = '?';
      const equipe = document.createElement('span');
      equipe.className = 'team-mark mark-pink';
      equipe.textContent = 'A';
      interno.append(neutra, equipe);
      externo.appendChild(interno);
      document.body.appendChild(externo);
      const medida = {
        nome,
        neutra: getComputedStyle(neutra).backgroundColor,
        equipe: getComputedStyle(equipe).backgroundColor,
      };
      externo.remove();
      return medida;
    });
  }, CONTEXTOS);
}

test('a marca do confronto a definir não é pintada de cor de equipe', async ({ page }) => {
  await page.goto('/public');
  for (const medida of await medir(page)) {
    expect(medida.neutra, `${medida.nome}: a marca neutra foi pintada`).toBe(CINZA);
    // A exclusão não pode ter apagado a cor de quem tem cor.
    expect(medida.equipe, `${medida.nome}: a marca de equipe perdeu a cor`).not.toBe(CINZA);
  }
});

test('o mesmo vale dentro do app, onde os temas são mais fortes', async ({ page }) => {
  await loginAs(page);
  await page.goto('/matches');
  for (const medida of await medir(page)) {
    expect(medida.neutra, `${medida.nome}: a marca neutra foi pintada`).toBe(CINZA);
    expect(medida.equipe, `${medida.nome}: a marca de equipe perdeu a cor`).not.toBe(CINZA);
  }
});
