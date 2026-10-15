import type { FrontendState } from './frontend-state.ts';
import { tournamentPodium } from './tournament-progression.ts';

export type Podium = { champion: string; vice?: string; third?: string; source: 'final' | 'tabela' };

/**
 * Pódio de uma categoria — o mesmo para a tela da categoria, a home pública e
 * a pontuação automática do ranking geral.
 *
 * Com mata-mata: campeã e vice saem da final, o 3º da disputa de 3º lugar.
 * Sem mata-mata (liga ou grupo único): as três primeiras da tabela oficial,
 * só depois de a categoria encerrar. Antes, o ranking geral só conhecia o
 * mata-mata, e a campeã de uma liga não recebia os pontos de campeã.
 */
export function categoryPodium(state: Pick<FrontendState, 'tournaments' | 'matches'>, tournamentId: string): Podium | null {
  const setup = state.tournaments[tournamentId];
  if (!setup) return null;
  const hasKnockout = Object.keys(state.matches).some((id) => id.startsWith(`${tournamentId}-advanced-`));
  if (hasKnockout) {
    const podium = tournamentPodium(state, tournamentId);
    return podium.champion ? { champion: podium.champion, vice: podium.runnerUp, third: podium.third, source: 'final' } : null;
  }
  if (setup.status !== 'Encerrado') return null;
  // Pela tabela, só quando ela é a decisão: uma liga ou um grupo único, sem
  // mata-mata previsto. Com vários grupos cada um tem o seu "1º", e juntar as
  // tabelas coroaria quem veio primeiro na lista. Com mata-mata previsto e não
  // lançado no app, a campeã simplesmente não é conhecida.
  if (setup.phases.some((phase) => phase.format === 'Mata-mata')) return null;
  const last = setup.phases[setup.phases.length - 1];
  if (!last || (last.format === 'Grupos' && last.groups.length > 1)) return null;
  const classification = last.standings?.length ? last : undefined;
  const ranked = [...(classification?.standings ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  if (!ranked.length) return null;
  return { champion: ranked[0].entryName, vice: ranked[1]?.entryName, third: ranked[2]?.entryName, source: 'tabela' };
}
