import type { FrontendState, MatchState, TournamentAdvancement, TournamentState } from './frontend-state.ts';
import { calculateStandings, type TournamentMatch } from './tournament-engine.ts';
import { moveDateKey, resolveMatchDate } from './date-utils.ts';
import { resolveDisciplineRule } from './discipline-rules.ts';
import { resolveRegulation } from './regulation.ts';
import { officialWinner } from './match-lifecycle.ts';
import { isLive, officialMatchStatuses, tournamentStatus } from './status.ts';
import { collectQualifiers, defaultAdvancement, roundName, seedPairs, type GroupStanding } from './bracket-rules.ts';

const finishedStatuses: string[] = officialMatchStatuses;

function escapeId(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rodada eliminatória a que a partida pertence. Reconhece o formato atual
 * (`-advanced-r2-1`) e o anterior (`-advanced-semi-1` / `-advanced-final`),
 * para que disputas já em andamento continuem progredindo.
 */
function knockoutRound(matchId: string, tournamentId: string): number | null {
  const modern = new RegExp(`^${escapeId(tournamentId)}-advanced-r(\\d+)-\\d+$`).exec(matchId);
  if (modern) return Number(modern[1]);
  if (matchId === `${tournamentId}-advanced-final`) return 2;
  if (matchId.startsWith(`${tournamentId}-advanced-semi-`)) return 1;
  return null;
}

function bracketOrder(matchId: string) {
  const modern = /-advanced-r\d+-(\d+)$/.exec(matchId);
  if (modern) return Number(modern[1]);
  const legacySemi = /-advanced-semi-(\d+)$/.exec(matchId);
  return legacySemi ? Number(legacySemi[1]) : 1;
}

export type TournamentPodium = { champion?: string; runnerUp?: string; third?: string };

/**
 * Pódio oficial da disputa: campeão e vice saem da última rodada eliminatória,
 * e o terceiro lugar sai da disputa correspondente quando o regulamento a prevê.
 */
export function tournamentPodium(state: Pick<FrontendState, 'matches'>, tournamentId: string): TournamentPodium {
  const entries = Object.entries(state.matches).filter(([, match]) => match.tournamentId === tournamentId);
  const rounds = entries.map(([id]) => knockoutRound(id, tournamentId)).filter((round): round is number => round !== null);
  if (!rounds.length) return {};
  const lastRound = Math.max(...rounds);
  const finalEntry = entries.find(([id]) => knockoutRound(id, tournamentId) === lastRound);
  const podium: TournamentPodium = {};
  if (finalEntry && finishedStatuses.includes(finalEntry[1].status ?? '')) {
    const champion = officialWinner(finalEntry[1]);
    if (champion) {
      podium.champion = champion;
      podium.runnerUp = champion === finalEntry[1].entryA ? finalEntry[1].entryB : finalEntry[1].entryA;
    }
  }
  const thirdPlace = state.matches[`${tournamentId}-advanced-third`];
  if (thirdPlace && finishedStatuses.includes(thirdPlace.status ?? '')) {
    podium.third = officialWinner(thirdPlace) ?? undefined;
  }
  return podium;
}

export type CorrectionImpact = {
  /** Partidas geradas a partir deste resultado que ainda podem ser refeitas. */
  downstream: string[];
  /** Partidas já operadas: precisam ser anuladas antes de retificar a origem. */
  blocked: string[];
};

/**
 * Mostra o que uma retificação de resultado atinge: quais confrontos seguintes
 * seriam regerados e quais já foram operados e travam a correção.
 */
export function analyzeCorrectionImpact(state: Pick<FrontendState, 'matches'>, matchId: string): CorrectionImpact {
  const source = state.matches[matchId];
  const tournamentId = source?.tournamentId;
  if (!tournamentId) return { downstream: [], blocked: [] };
  const sourceRound = knockoutRound(matchId, tournamentId) ?? 0;
  const downstream: string[] = [];
  const blocked: string[] = [];
  for (const [id, match] of Object.entries(state.matches)) {
    if (id === matchId || match.tournamentId !== tournamentId) continue;
    const round = knockoutRound(id, tournamentId);
    const isThirdPlace = id === `${tournamentId}-advanced-third`;
    if (round === null && !isThirdPlace) continue;
    if (round !== null && round <= sourceRound) continue;
    if (finishedStatuses.includes(match.status ?? '') || isLive(match.status)) blocked.push(id);
    else downstream.push(id);
  }
  return { downstream, blocked };
}

/** Remove os confrontos ainda não operados que dependiam do resultado corrigido. */
export function clearDownstream(state: FrontendState, matchId: string): FrontendState {
  const { downstream } = analyzeCorrectionImpact(state, matchId);
  if (!downstream.length) return state;
  const matches = Object.fromEntries(Object.entries(state.matches).filter(([id]) => !downstream.includes(id)));
  return { ...state, matches };
}

function resolveAdvancement(tournament: TournamentState): TournamentAdvancement {
  const groupPhase = tournament.phases.find((phase) => phase.format === 'Grupos');
  return tournament.advancement ?? { ...defaultAdvancement, perGroup: groupPhase?.qualifiers ?? defaultAdvancement.perGroup };
}

function toTournamentMatch(id: string, match: MatchState, group?: string): TournamentMatch {
  return { id, entryA: match.entryA ?? '', entryB: match.entryB ?? '', scoreA: match.scoreA ?? null, scoreB: match.scoreB ?? null, status: match.status ?? 'Agendada', phase: match.phase, group: group ?? match.phase };
}

/**
 * Avança o torneio: gera a primeira rodada eliminatória quando os grupos
 * terminam, cria cada rodada seguinte com os vencedores da anterior (incluindo
 * quem passou por bye), a disputa de terceiro lugar quando o regulamento pede,
 * e encerra a disputa ao existir campeão. Uma partida eliminatória empatada e
 * sem desempate registrado interrompe a progressão em vez de inventar um vencedor.
 */
export function progressTournament(state: FrontendState, tournamentId?: string): FrontendState {
  if (!tournamentId) return state;
  const tournament = state.tournaments[tournamentId];
  if (!tournament) return state;
  const knockoutPhase = tournament.phases.find((phase) => phase.format === 'Mata-mata');
  if (!knockoutPhase) return state;

  const discipline = tournament.discipline ?? '';
  const rules = resolveDisciplineRule(discipline, state.disciplines[discipline]);
  const regulation = resolveRegulation(discipline, state.disciplines[discipline]);
  const advancement = resolveAdvancement(tournament);
  const logoFor = (team: string) => Object.values(state.teams).find((item) => item.name === team)?.logo ?? '';
  const tournamentMatches = Object.entries(state.matches).filter(([, match]) => match.tournamentId === tournamentId);

  const rounds = new Map<number, Array<[string, MatchState]>>();
  for (const entry of tournamentMatches) {
    const round = knockoutRound(entry[0], tournamentId);
    if (round === null) continue;
    rounds.set(round, [...(rounds.get(round) ?? []), entry]);
  }
  for (const [round, entries] of rounds) rounds.set(round, entries.sort((a, b) => bracketOrder(a[0]) - bracketOrder(b[0])));
  const thirdPlaceId = `${tournamentId}-advanced-third`;
  const lastRound = Math.max(0, ...rounds.keys());

  function createMatch(id: string, entryA: string, entryB: string, phase: string, date: string, index: number): [string, MatchState] {
    return [id, {
      created: true, editionId: tournament.editionId, tournamentId, discipline,
      entryA, entryB, logoA: logoFor(entryA), logoB: logoFor(entryB),
      date, time: `${String(Math.min(22, 18 + index * 2)).padStart(2, '0')}:00`, venue: 'A definir',
      phase, status: 'Agendada', scoreA: null, scoreB: null, rules,
      currentPeriod: 1, clockSeconds: 0, paused: true, events: [], periodScoreA: 0, periodScoreB: 0, periodResults: [],
    }];
  }

  if (lastRound === 0) {
    const groupPhase = tournament.phases.find((phase) => phase.format === 'Grupos');
    let slots;
    let baseDate = state.editions.find((edition) => edition.id === tournament.editionId)?.start ?? new Date().toISOString().slice(0, 10);
    if (groupPhase) {
      const groupMatches = tournamentMatches.filter(([, match]) => groupPhase.groups.includes(match.phase ?? ''));
      if (!groupMatches.length || !groupMatches.every(([, match]) => finishedStatuses.includes(match.status ?? ''))) return state;
      const standings: GroupStanding[] = groupPhase.groups.map((group) => ({
        group,
        rows: calculateStandings(
          tournament.participants.filter((team) => tournament.assignments[team] === group),
          groupMatches.filter(([, match]) => match.phase === group).map(([id, match]) => toTournamentMatch(id, match, group)),
          regulation.standings,
        ),
      }));
      slots = collectQualifiers(standings, advancement);
      baseDate = groupMatches.map(([, match]) => resolveMatchDate(match.date ?? 'Hoje')).sort().at(-1) ?? baseDate;
    } else {
      const ordered = [...tournament.participants].sort((a, b) => (tournament.seeds[a] ?? 999) - (tournament.seeds[b] ?? 999));
      slots = ordered.map((team, index) => ({ team, group: knockoutPhase.name, position: index + 1, label: `Seed ${index + 1}`, points: 0, balance: 0, goalsFor: 0 }));
    }

    const pairs = seedPairs(slots, advancement.crossing);
    const playable = pairs.filter((pair) => pair.entryB);
    if (!playable.length) return state;
    const phase = roundName(pairs.length * 2);
    const date = moveDateKey(baseDate, 1);
    const created = Object.fromEntries(playable.map((pair, index) => createMatch(`${tournamentId}-advanced-r1-${pair.order}`, pair.entryA, pair.entryB!, phase, date, index)));
    const nextByes = Object.fromEntries(pairs.filter((pair) => !pair.entryB).map((pair) => [String(pair.order), pair.entryA]));
    return {
      ...state,
      matches: { ...state.matches, ...created },
      tournaments: { ...state.tournaments, [tournamentId]: { ...tournament, status: tournament.status === tournamentStatus.draft || tournament.status === tournamentStatus.published ? tournamentStatus.running : tournament.status, byes: nextByes } },
    };
  }

  const currentEntries = rounds.get(lastRound) ?? [];
  if (!currentEntries.every(([, match]) => finishedStatuses.includes(match.status ?? ''))) return state;

  const byeEntrants = lastRound === 1 ? tournament.byes ?? {} : {};
  const slotOrders = [...new Set([...currentEntries.map(([id]) => bracketOrder(id)), ...Object.keys(byeEntrants).map(Number)])].sort((a, b) => a - b);
  const winners: string[] = [];
  for (const order of slotOrders) {
    const entry = currentEntries.find(([id]) => bracketOrder(id) === order);
    if (entry) {
      const winner = officialWinner(entry[1]);
      // Empate sem desempate registrado: a progressão para até o resultado ser resolvido.
      if (!winner) return state;
      winners.push(winner);
      continue;
    }
    const bye = byeEntrants[String(order)];
    if (bye) winners.push(bye);
  }

  if (winners.length <= 1) {
    const thirdPlace = state.matches[thirdPlaceId];
    // A disputa de 3º lugar precisa terminar antes de a modalidade ser encerrada.
    if (thirdPlace && !finishedStatuses.includes(thirdPlace.status ?? '')) return state;
    if (tournament.status === 'Encerrado') return state;
    return { ...state, tournaments: { ...state.tournaments, [tournamentId]: { ...tournament, status: 'Encerrado' } } };
  }

  const nextRound = lastRound + 1;
  if (rounds.has(nextRound)) return state;
  const baseDate = currentEntries.map(([, match]) => resolveMatchDate(match.date ?? 'Hoje')).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
  const date = moveDateKey(baseDate, 1);
  const phase = roundName(winners.length);
  const created: Record<string, MatchState> = {};
  for (let index = 0; index * 2 < winners.length; index += 1) {
    const entryA = winners[index * 2];
    const entryB = winners[index * 2 + 1];
    if (!entryB) continue;
    const [id, match] = createMatch(`${tournamentId}-advanced-r${nextRound}-${index + 1}`, entryA, entryB, phase, date, index);
    created[id] = match;
  }
  if (!Object.keys(created).length) return state;

  // Disputa de terceiro lugar: sai dos perdedores da semifinal, junto com a final.
  if (advancement.thirdPlaceMatch && phase === 'Final' && currentEntries.length === 2 && !state.matches[thirdPlaceId]) {
    const losers = currentEntries.map(([, match]) => {
      const winner = officialWinner(match);
      return winner === match.entryA ? match.entryB : match.entryA;
    }).filter((team): team is string => Boolean(team));
    if (losers.length === 2) {
      const [id, match] = createMatch(thirdPlaceId, losers[0], losers[1], 'Disputa de 3º lugar', date, 0);
      created[id] = match;
    }
  }

  return { ...state, matches: { ...state.matches, ...created }, tournaments: { ...state.tournaments, [tournamentId]: { ...tournament, status: 'Em andamento' } } };
}
