/**
 * Chave do mata-mata a partir das partidas da categoria.
 *
 * O jogo eliminatório é reconhecido pela estrutura — id `-advanced-` gravado
 * pela API, ou fase de formato Mata-mata — e não pelo nome da fase. Filtrar por
 * "semi|quart|final" deixou a aba Chaveamento vazia em todas as categorias de
 * 2026, porque a fase se chamava "Mata-mata".
 */
export type BracketMatch = {
  id: string;
  entryA: string;
  entryB: string;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  phase?: string;
  date?: string;
  time?: string;
};

export type BracketRound = { key: string; name: string; matches: BracketMatch[] };

function roundOf(id: string): number | 'third' | null {
  if (/-advanced-third$/.test(id)) return 'third';
  const match = id.match(/-advanced-r(\d+)-\d+$/);
  return match ? Number(match[1]) : null;
}

function slotOf(id: string) {
  const match = id.match(/-advanced-r\d+-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/** Nome da rodada pelo número de jogos que ela tem. */
export function roundName(matchCount: number) {
  if (matchCount <= 1) return 'Final';
  if (matchCount === 2) return 'Semifinal';
  if (matchCount <= 4) return 'Quartas de final';
  if (matchCount <= 8) return 'Oitavas de final';
  return `Rodada de ${matchCount * 2}`;
}

export function isKnockoutMatch(match: Pick<BracketMatch, 'id' | 'phase'>, knockoutPhaseNames: readonly string[]) {
  return match.id.includes('-advanced-') || knockoutPhaseNames.includes(match.phase ?? '') || /semi|quart|oitava|final/i.test(match.phase ?? '');
}

export function bracketRounds(matches: readonly BracketMatch[], knockoutPhaseNames: readonly string[]): BracketRound[] {
  const knockout = matches.filter((match) => isKnockoutMatch(match, knockoutPhaseNames));
  const numbered = new Map<number, BracketMatch[]>();
  const third: BracketMatch[] = [];
  const loose: BracketMatch[] = [];
  for (const match of knockout) {
    const round = roundOf(match.id);
    if (round === 'third') third.push(match);
    else if (round) numbered.set(round, [...(numbered.get(round) ?? []), match]);
    else loose.push(match);
  }
  const rounds: BracketRound[] = [...numbered.entries()]
    .sort(([left], [right]) => left - right)
    .map(([round, items]) => ({ key: `r${round}`, name: roundName(items.length), matches: [...items].sort((a, b) => slotOf(a.id) - slotOf(b.id)) }));
  // Jogo eliminatório agendado à mão (sem id da chave) entra como rodada própria
  // com o nome da fase, para não sumir.
  if (loose.length) rounds.push({ key: 'avulsos', name: loose[0].phase || 'Mata-mata', matches: loose });
  // A disputa de 3º lugar aparece antes da final, como no ginásio.
  if (third.length) {
    const finalIndex = rounds.findIndex((round) => round.name === 'Final');
    rounds.splice(finalIndex >= 0 ? finalIndex : rounds.length, 0, { key: 'third', name: 'Disputa de 3º lugar', matches: third });
  }
  return rounds;
}

/**
 * Nome da fase de uma partida para quem lê: no mata-mata, a rodada ("Semifinal",
 * "Final"), não o nome genérico da fase ("Mata-mata").
 */
export function matchStageLabel(id: string, phase: string | undefined, allMatchIds: readonly string[]) {
  const round = roundOf(id);
  if (round === 'third') return 'Disputa de 3º lugar';
  if (round) {
    const prefix = id.slice(0, id.lastIndexOf('-') + 1);
    return roundName(allMatchIds.filter((other) => other.startsWith(prefix) && roundOf(other) === round).length);
  }
  return phase ?? '';
}
