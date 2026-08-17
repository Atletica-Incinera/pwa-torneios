import { tiebreakerLabels, type StandingsRule, type TiebreakerId } from './regulation.js';
import { isLive, officialMatchStatuses } from './status.js';

export type TournamentMatch = {
  id: string;
  entryA: string;
  entryB: string;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  phase?: string;
  group?: string;
  /** Pontos de fair play (cartões, faltas) usados como critério de desempate. */
  disciplinaryA?: number;
  disciplinaryB?: number;
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
  disciplinary: number;
  /** Critério que definiu a posição quando houve empate em pontos. */
  tiebreak?: string;
};

/** Regulamento padrão da tabela, usado quando a modalidade não define o seu. */
export const defaultStandingsRule: StandingsRule = { win: 3, draw: 1, loss: 0, tiebreakers: ['confronto-direto', 'vitorias', 'saldo', 'marcados', 'fair-play', 'sorteio'] };

/** Estados cujo placar entra no cálculo oficial da classificação. */
const countedStatuses: string[] = officialMatchStatuses;

function emptyRow(name: string): Standing {
  return { rank: 0, name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, balance: 0, points: 0, disciplinary: 0 };
}

function accumulate(rows: Map<string, Standing>, matches: readonly TournamentMatch[], rule: StandingsRule) {
  for (const match of matches) {
    if (!countedStatuses.includes(match.status) || match.scoreA == null || match.scoreB == null) continue;
    const home = rows.get(match.entryA);
    const away = rows.get(match.entryB);
    if (!home || !away) continue;
    home.played += 1; away.played += 1;
    home.goalsFor += match.scoreA; home.goalsAgainst += match.scoreB;
    away.goalsFor += match.scoreB; away.goalsAgainst += match.scoreA;
    home.disciplinary += match.disciplinaryA ?? 0;
    away.disciplinary += match.disciplinaryB ?? 0;
    if (match.scoreA === match.scoreB) { home.drawn += 1; away.drawn += 1; home.points += rule.draw; away.points += rule.draw; }
    else if (match.scoreA > match.scoreB) { home.won += 1; away.lost += 1; home.points += rule.win; away.points += rule.loss; }
    else { away.won += 1; home.lost += 1; away.points += rule.win; home.points += rule.loss; }
  }
}

/** Mini-tabela de pontos apenas entre as equipes empatadas. */
function headToHead(names: readonly string[], matches: readonly TournamentMatch[], rule: StandingsRule) {
  const rows = new Map(names.map((name) => [name, emptyRow(name)]));
  accumulate(rows, matches.filter((match) => names.includes(match.entryA) && names.includes(match.entryB)), rule);
  return rows;
}

function criterionValue(id: TiebreakerId, row: Standing, mini: Map<string, Standing>): number {
  switch (id) {
    case 'confronto-direto': { const inner = mini.get(row.name); return inner ? inner.points * 1000 + (inner.goalsFor - inner.goalsAgainst) : 0; }
    case 'vitorias': return row.won;
    case 'saldo': return row.balance;
    case 'marcados': return row.goalsFor;
    case 'sofridos': return -row.goalsAgainst;
    case 'fair-play': return -row.disciplinary;
    case 'sorteio': return 0;
    default: return 0;
  }
}

/**
 * Ordena um bloco empatado aplicando os critérios na ordem do regulamento.
 * Cada equipe guarda em `tiebreak` o critério que a separou — é o que torna o
 * desempate auditável, inclusive quando o empate envolve mais de duas equipes.
 */
function rankBlock(block: Standing[], matches: readonly TournamentMatch[], rule: StandingsRule, criteria: readonly TiebreakerId[]): Standing[] {
  if (block.length <= 1) return block;
  const [current, ...rest] = criteria;
  if (!current) return [...block].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (current === 'sorteio') {
    return [...block].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((row) => ({ ...row, tiebreak: row.tiebreak ?? tiebreakerLabels.sorteio }));
  }
  const mini = current === 'confronto-direto' ? headToHead(block.map((row) => row.name), matches, rule) : new Map<string, Standing>();
  const scored = block.map((row) => ({ row, value: criterionValue(current, row, mini) }));
  const distinct = new Set(scored.map((item) => item.value));
  if (distinct.size <= 1) return rankBlock(block, matches, rule, rest);
  const buckets = new Map<number, Standing[]>();
  for (const { row, value } of scored) buckets.set(value, [...(buckets.get(value) ?? []), row]);
  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, rows]) => (rows.length === 1
      ? [{ ...rows[0], tiebreak: rows[0].tiebreak ?? tiebreakerLabels[current] }]
      : rankBlock(rows, matches, rule, rest)));
}

/**
 * Tabela de classificação com o regulamento da modalidade: pontuação por
 * vitória/empate/derrota configurável e desempate na ordem definida.
 */
export function calculateStandings(participants: readonly string[], matches: readonly TournamentMatch[], rule: StandingsRule = defaultStandingsRule) {
  const rows = new Map(participants.map((name) => [name, emptyRow(name)]));
  accumulate(rows, matches, rule);
  const withBalance = [...rows.values()].map((row) => ({ ...row, balance: row.goalsFor - row.goalsAgainst }));
  const byPoints = new Map<number, Standing[]>();
  for (const row of withBalance) byPoints.set(row.points, [...(byPoints.get(row.points) ?? []), row]);
  return [...byPoints.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, block]) => rankBlock(block, matches, rule, rule.tiebreakers))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * As tabelas oficiais de uma categoria, pela chave com que a tela as procura:
 * nome do grupo quando a fase tem grupos, nome da fase quando não tem.
 *
 * Só o modo `http` as preenche — lá quem calcula e ordena a classificação é o
 * servidor, e a ordem dele é a oficial. No modo local elas não existem e a
 * tabela continua saindo de `calculateStandings`, que é o que faz o app
 * funcionar sem servidor.
 */
export type OfficialStandings = Record<string, Standing[]>;

/**
 * A tabela que a tela exibe: a oficial quando existe, a calculada quando não.
 *
 * Quando o servidor mandou a classificação daquela chave, ela vale **inteira** —
 * ordem e números juntos. Consumir só a ordem produziria uma tabela que se
 * contradiz: a posição viria de uma cadeia de desempate e os números de outra, e
 * quem lê não encontraria nos números a razão da posição. E os números não são
 * os mesmos: o servidor conta vitória por quem ficou gravado como vencedor da
 * partida, não pelo placar, então um W.O. sem vencedor gravado vira empate de
 * um ponto para cada lado enquanto o cálculo daqui dá vitória a alguém.
 *
 * Tabela oficial **vazia** não é tabela: quer dizer que o recálculo nunca rodou
 * naquela fase, e mostrar nada faria um torneio que ainda não começou parecer um
 * torneio sem inscritos. Aí calcula.
 */
export function resolveStandings(official: readonly Standing[] | undefined, participants: readonly string[], matches: readonly TournamentMatch[], rule: StandingsRule = defaultStandingsRule): Standing[] {
  return official?.length ? official.map((row) => ({ ...row })) : calculateStandings(participants, matches, rule);
}

/**
 * A linha oficial de um participante na categoria.
 *
 * Procura na ordem em que as tabelas foram montadas, que é a ordem das fases:
 * quem joga a fase de grupos e o mata-mata aparece nas duas, e a posição que
 * descreve a campanha é a da primeira.
 */
export function findOfficialStanding(official: OfficialStandings | undefined, name: string): Standing | undefined {
  for (const table of Object.values(official ?? {})) {
    const row = table.find((item) => item.name === name);
    if (row) return { ...row };
  }
  return undefined;
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

export function qualifiedTeams(groups: readonly { name: string; participants: string[] }[], matches: readonly TournamentMatch[], qualifiers: number, rule: StandingsRule = defaultStandingsRule) {
  return groups.flatMap((group) => calculateStandings(group.participants, matches.filter((match) => match.group === group.name || match.phase === group.name), rule).slice(0, qualifiers).map((row) => row.name));
}

export function tournamentProgress(matches: readonly TournamentMatch[], hasSetup: boolean) {
  if (!matches.length) return hasSetup ? 10 : 0;
  const ended = matches.filter((match) => countedStatuses.includes(match.status)).length;
  const live = matches.some((match) => isLive(match.status));
  return Math.min(100, Math.round((ended / matches.length) * 90) + (live ? 5 : 0) + 10);
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
