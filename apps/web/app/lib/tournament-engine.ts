export type TournamentMatch = {
  id: string;
  entryA: string;
  entryB: string;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  phase?: string;
  group?: string;
};

export type Standing = {
  rank: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  balance: number;
  points: number;
};

export function calculateStandings(participants: readonly string[], matches: readonly TournamentMatch[]) {
  const rows = new Map(participants.map((name) => [name, { rank: 0, name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, balance: 0, points: 0 }]));
  for (const match of matches) {
    if (match.status !== 'Encerrada' || match.scoreA == null || match.scoreB == null) continue;
    const home = rows.get(match.entryA);
    const away = rows.get(match.entryB);
    if (!home || !away) continue;
    home.played += 1; away.played += 1;
    home.goalsFor += match.scoreA; home.goalsAgainst += match.scoreB;
    away.goalsFor += match.scoreB; away.goalsAgainst += match.scoreA;
    if (match.scoreA === match.scoreB) { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
    else if (match.scoreA > match.scoreB) { home.won += 1; away.lost += 1; home.points += 3; }
    else { away.won += 1; home.lost += 1; away.points += 3; }
  }
  return [...rows.values()].map((row) => ({ ...row, balance: row.goalsFor - row.goalsAgainst })).sort((a, b) => b.points - a.points || b.won - a.won || b.balance - a.balance || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name, 'pt-BR')).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function distributeGroups(participants: readonly string[], groups: readonly string[], seeds: Record<string, number>) {
  if (!groups.length) return Object.fromEntries(participants.map((team) => [team, 'Geral']));
  const ordered = [...participants].sort((a, b) => (seeds[a] ?? 999) - (seeds[b] ?? 999));
  return Object.fromEntries(ordered.map((team, index) => {
    const cycle = Math.floor(index / groups.length);
    const position = index % groups.length;
    const groupIndex = cycle % 2 === 0 ? position : groups.length - 1 - position;
    return [team, groups[groupIndex]];
  }));
}

export function generateRoundRobin(participants: readonly string[]) {
  const pairs: Array<[string, string]> = [];
  for (let home = 0; home < participants.length; home += 1) {
    for (let away = home + 1; away < participants.length; away += 1) pairs.push([participants[home], participants[away]]);
  }
  return pairs;
}

export function qualifiedTeams(groups: readonly { name: string; participants: string[] }[], matches: readonly TournamentMatch[], qualifiers: number) {
  return groups.flatMap((group) => calculateStandings(group.participants, matches.filter((match) => match.group === group.name || match.phase === group.name)).slice(0, qualifiers).map((row) => row.name));
}

export function tournamentProgress(matches: readonly TournamentMatch[], hasSetup: boolean) {
  if (!matches.length) return hasSetup ? 10 : 0;
  const ended = matches.filter((match) => match.status === 'Encerrada').length;
  const live = matches.some((match) => match.status === 'Ao vivo');
  return Math.min(100, Math.round((ended / matches.length) * 90) + (live ? 5 : 0) + 10);
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
