import type { FrontendState, MatchState } from './frontend-state.ts';
import { calculateStandings } from './tournament-engine.ts';
import { moveDateKey, resolveMatchDate } from './date-utils.ts';
import { teams as teamCatalog } from './mock-data.ts';

function winner(match: MatchState) {
  if (match.status !== 'Encerrada' || match.scoreA == null || match.scoreB == null || match.scoreA === match.scoreB) return null;
  return match.scoreA > match.scoreB ? match.entryA ?? null : match.entryB ?? null;
}

export function progressTournament(state: FrontendState, tournamentId?: string): FrontendState {
  if (!tournamentId) return state;
  const tournament = state.tournaments[tournamentId];
  if (!tournament) return state;
  const tournamentMatches = Object.entries(state.matches).filter(([, match]) => match.tournamentId === tournamentId);
  const logoFor = (team: string) => teamCatalog.find((item) => item.name === team)?.logo ?? Object.values(state.teams).find((item) => item.name === team)?.logo ?? '';
  const groupPhase = tournament.phases.find((phase) => phase.format === 'Grupos');
  const knockoutPhase = tournament.phases.find((phase) => phase.format === 'Mata-mata');
  if (!knockoutPhase) return state;
  const generatedSemis = tournamentMatches.filter(([id]) => id.startsWith(`${tournamentId}-advanced-semi-`));
  const generatedFinal = tournamentMatches.find(([id]) => id === `${tournamentId}-advanced-final`);

  if (groupPhase && !generatedSemis.length && !generatedFinal) {
    const groupMatches = tournamentMatches.filter(([, match]) => groupPhase.groups.includes(match.phase ?? ''));
    const allGroupsComplete = groupMatches.length > 0 && groupMatches.every(([, match]) => match.status === 'Encerrada');
    if (!allGroupsComplete) return state;
    const qualified = groupPhase.groups.map((group) => {
      const participants = tournament.participants.filter((team) => tournament.assignments[team] === group);
      const matches = groupMatches.filter(([, match]) => match.phase === group).map(([id, match]) => ({ id, entryA: match.entryA ?? '', entryB: match.entryB ?? '', scoreA: match.scoreA ?? null, scoreB: match.scoreB ?? null, status: match.status ?? 'Agendada', phase: match.phase, group }));
      return calculateStandings(participants, matches).slice(0, groupPhase.qualifiers).map((row) => row.name);
    });
    const teams = qualified.flat();
    if (teams.length < 2) return state;
    const pairs: Array<[string, string]> = teams.length >= 4 && qualified.length >= 2 ? [[qualified[0][0], qualified[1][1]], [qualified[1][0], qualified[0][1]]] : [[teams[0], teams[1]]];
    if (pairs.some((pair) => pair.some((team) => !team))) return state;
    const lastDate = groupMatches.map(([, match]) => resolveMatchDate(match.date ?? 'Hoje')).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
    const isFinal = pairs.length === 1;
    const created = Object.fromEntries(pairs.map(([entryA, entryB], index) => [`${tournamentId}-advanced-${isFinal ? 'final' : `semi-${index + 1}`}`, { created: true, tournamentId, discipline: tournament.discipline, entryA, entryB, logoA: logoFor(entryA), logoB: logoFor(entryB), date: moveDateKey(lastDate, 1), time: `${18 + index * 2}:00`, venue: 'A definir', phase: isFinal ? 'Final' : 'Semifinal', status: 'Agendada', scoreA: null, scoreB: null, clockSeconds: 0, paused: true, events: [] } satisfies MatchState]));
    return { ...state, matches: { ...state.matches, ...created }, tournaments: { ...state.tournaments, [tournamentId]: { ...tournament, status: 'Em andamento' } } };
  }

  if (generatedSemis.length && !generatedFinal && generatedSemis.every(([, match]) => match.status === 'Encerrada')) {
    const finalists = generatedSemis.map(([, match]) => winner(match));
    if (finalists.some((team) => !team)) return state;
    const lastDate = generatedSemis.map(([, match]) => resolveMatchDate(match.date ?? 'Hoje')).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
    return { ...state, matches: { ...state.matches, [`${tournamentId}-advanced-final`]: { created: true, tournamentId, discipline: tournament.discipline, entryA: finalists[0]!, entryB: finalists[1]!, logoA: logoFor(finalists[0]!), logoB: logoFor(finalists[1]!), date: moveDateKey(lastDate, 1), time: '20:00', venue: 'A definir', phase: 'Final', status: 'Agendada', scoreA: null, scoreB: null, clockSeconds: 0, paused: true, events: [] } } };
  }

  if (generatedFinal?.[1].status === 'Encerrada' && winner(generatedFinal[1])) return { ...state, tournaments: { ...state.tournaments, [tournamentId]: { ...tournament, status: 'Encerrado' } } };
  return state;
}
