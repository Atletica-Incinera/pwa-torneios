import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

const cardSelector = [
  '.staff-card',
  '.athlete-card',
  '.team-card',
  '.tournament-card',
  '.discipline-card',
  '.match-score-card',
  '.match-summary-card',
  '.timeline-item',
  '.standing-row',
  '.overall-ranking-row',
  '.team-performance-card',
  '.entity-form',
  '.ranking-admin-panel',
].join(', ');

async function expectCardsInsideParents(page: import('@playwright/test').Page, route: string) {
  await page.goto(route);
  await expect(page.locator('body')).toBeVisible();

  const overflow = await page.locator(cardSelector).evaluateAll((cards) => cards.flatMap((card) => {
    const bounds = card.getBoundingClientRect();
    return [...card.children]
      .filter((child) => getComputedStyle(child).position !== 'absolute')
      .map((child) => ({
        card: card.className,
        child: child.className,
        left: Math.round(child.getBoundingClientRect().left - bounds.left),
        right: Math.round(child.getBoundingClientRect().right - bounds.right),
      }))
      .filter((item) => item.left < -1 || item.right > 1);
  }));

  expect(overflow, `${route} possui conteúdo fora do card`).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${route} cria rolagem horizontal`).toBeTruthy();
}

test('cards mantêm seu conteúdo dentro do pai em largura mínima', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await loginAs(page);

  for (const route of [
    '/dashboard', '/teams', '/teams/alcateia', '/athletes', '/disciplines',
    '/tournaments', '/matches', '/matches/semifinal-1', '/matches/live?partida=semifinal-1',
    '/staff', '/standings', '/competitions',
  ]) await expectCardsInsideParents(page, route);

  for (const route of [
    '/public', '/public/matches', '/public/teams', '/public/teams/alcateia',
    '/public/tournaments', '/public/results', '/public/standings', '/public/standings/general', '/public/phases',
  ]) await expectCardsInsideParents(page, route);
});
