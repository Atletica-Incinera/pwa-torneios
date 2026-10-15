import type { MatchTiebreakState } from './frontend-state.ts';

/**
 * O desempate numa frase: "Compressora venceu nos pênaltis por 3 × 2".
 *
 * Antes eram duas frases que diziam a mesma coisa ("Pênaltis: Compressora
 * (3 × 2) · Compressora venceu nos pênaltis"), com o placar na ordem dos
 * lados, e não na de quem venceu.
 */
export function tiebreakSentence(tiebreak: Pick<MatchTiebreakState, 'method' | 'label' | 'scoreA' | 'scoreB' | 'winner'>, entryA: string) {
  const [own, other] = tiebreak.winner === entryA ? [tiebreak.scoreA, tiebreak.scoreB] : [tiebreak.scoreB, tiebreak.scoreA];
  const score = own || other ? ` por ${own} × ${other}` : '';
  if (tiebreak.method === 'penaltis') return `${tiebreak.winner} venceu nos pênaltis${score}`;
  return `${tiebreak.winner} venceu no desempate (${tiebreak.label.toLocaleLowerCase('pt-BR')})${score}`;
}
