import type { FrontendState, OverallAwardState, OverallMetricState, OverallPosition } from './frontend-state.js';
import { findTeamByName } from './eligibility.js';
import { tournamentPodium } from './tournament-progression.js';
import { isTournamentDecided } from './status.js';

export const positionLabels: Record<OverallPosition, string> = {
  campeao: 'Campeão da modalidade',
  vice: 'Vice-campeão',
  terceiro: 'Terceiro lugar',
  participacao: 'Participação',
};

/** Bonificações que ainda valem: as estornadas ficam registradas, mas não pontuam. */
export function activeAwards(state: Pick<FrontendState, 'overallRanking'>, editionId?: string) {
  return state.overallRanking.awards.filter((award) => !award.revokedAt && (!editionId || award.editionId === editionId));
}

export function editionAwards(state: Pick<FrontendState, 'overallRanking'>, editionId?: string) {
  return state.overallRanking.awards.filter((award) => !editionId || award.editionId === editionId);
}

/** O ranking geral fica oficial e bloqueado após o fechamento da edição. */
export function rankingClosure(state: Pick<FrontendState, 'overallRanking'>, editionId?: string) {
  if (!editionId) return undefined;
  return (state.overallRanking.closures ?? []).find((closure) => closure.editionId === editionId);
}

export function isRankingClosed(state: Pick<FrontendState, 'overallRanking'>, editionId?: string) {
  return Boolean(rankingClosure(state, editionId));
}

/**
 * Já existe bonificação viva desta métrica para a equipe na modalidade?
 * É o que impede a mesma pontuação de ser lançada duas vezes por engano.
 */
export function hasAward(awards: readonly OverallAwardState[], teamId: string, discipline: string, metricId: string) {
  return awards.some((award) => !award.revokedAt && award.teamId === teamId && award.discipline === discipline && award.metricId === metricId);
}

export type AutomaticAward = { teamId: string; teamName: string; discipline: string; metric: OverallMetricState; points: number; tournamentName: string };

/**
 * Bonificações que saem direto do resultado oficial: pódio das disputas
 * encerradas. O que não tem posição declarada continua sendo lançamento manual
 * do admin — é essa a fronteira entre automático e manual.
 */
export function suggestAutomaticAwards(state: FrontendState, editionId?: string): AutomaticAward[] {
  const awards = state.overallRanking.awards;
  const automaticMetrics = state.overallRanking.metrics.filter((metric) => metric.position);
  if (!automaticMetrics.length) return [];
  const suggestions: AutomaticAward[] = [];

  for (const [tournamentId, tournament] of Object.entries(state.tournaments)) {
    if (editionId && tournament.editionId !== editionId) continue;
    if (!isTournamentDecided(tournament.status)) continue;
    const discipline = tournament.discipline ?? '';
    const podium = tournamentPodium(state, tournamentId);
    const byPosition: Partial<Record<OverallPosition, string[]>> = {
      campeao: podium.champion ? [podium.champion] : [],
      vice: podium.runnerUp ? [podium.runnerUp] : [],
      terceiro: podium.third ? [podium.third] : [],
      participacao: tournament.participants,
    };
    for (const metric of automaticMetrics) {
      for (const teamName of byPosition[metric.position!] ?? []) {
        const team = findTeamByName(state, teamName);
        if (!team) continue;
        if (hasAward(awards, team.id, discipline, metric.id)) continue;
        suggestions.push({ teamId: team.id, teamName, discipline, metric, points: metric.defaultPoints, tournamentName: tournament.name ?? discipline });
      }
    }
  }
  return suggestions;
}

/** Classificação geral da edição, considerando apenas bonificações vivas. */
export function computeOverallRanking(state: Pick<FrontendState, 'overallRanking'>, teams: readonly { id: string; name: string }[], editionId?: string) {
  const awards = activeAwards(state, editionId);
  const rows = teams.map((team) => {
    const own = awards.filter((award) => award.teamId === team.id);
    return { id: team.id, name: team.name, points: own.reduce((total, award) => total + award.points, 0), bonuses: own.length, disciplines: new Set(own.map((award) => award.discipline)).size };
  }).sort((a, b) => b.points - a.points || b.disciplines - a.disciplines || a.name.localeCompare(b.name, 'pt-BR'));

  let lastPoints: number | null = null;
  let lastDisciplines: number | null = null;
  let lastRank = 0;
  return rows.map((row, index) => {
    const tied = row.points === lastPoints && row.disciplines === lastDisciplines;
    const rank = tied ? lastRank : index + 1;
    lastPoints = row.points;
    lastDisciplines = row.disciplines;
    lastRank = rank;
    return { ...row, rank };
  });
}
