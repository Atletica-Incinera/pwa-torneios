import type { TournamentAdvancement } from './frontend-state.js';
import type { Standing } from './tournament-engine.js';

/** Classificação final de um grupo, já ordenada. */
export type GroupStanding = { group: string; rows: readonly Standing[] };

/** Uma vaga no mata-mata, com a origem explícita (`1º Grupo A`). */
export type QualifierSlot = { team: string; group: string; position: number; label: string; points: number; balance: number; goalsFor: number };

export type BracketPair = { order: number; entryA: string; entryB: string | null };

export const defaultAdvancement: TournamentAdvancement = { perGroup: 2, bestThirds: 0, crossing: 'padrao', thirdPlaceMatch: false };

function slotFrom(group: string, position: number, row: Standing): QualifierSlot {
  return { team: row.name, group, position, label: `${position}º ${group}`, points: row.points, balance: row.balance, goalsFor: row.goalsFor };
}

function compareSlots(a: QualifierSlot, b: QualifierSlot) {
  return b.points - a.points || b.balance - a.balance || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team, 'pt-BR');
}

/**
 * Vagas do mata-mata segundo o critério de avanço: quantas por grupo e quantos
 * melhores terceiros. A ordem devolvida é a ordem de seed — todos os primeiros
 * colocados, depois todos os segundos, e por fim os melhores terceiros.
 */
export function collectQualifiers(groups: readonly GroupStanding[], advancement: TournamentAdvancement = defaultAdvancement): QualifierSlot[] {
  const perGroup = Math.max(1, advancement.perGroup);
  const direct: QualifierSlot[][] = [];
  for (let position = 1; position <= perGroup; position += 1) {
    const line = groups.map((group) => group.rows[position - 1] && slotFrom(group.group, position, group.rows[position - 1])).filter((slot): slot is QualifierSlot => Boolean(slot));
    direct.push(line);
  }
  const thirds = advancement.bestThirds > 0
    ? groups
      .map((group) => group.rows[perGroup] && slotFrom(group.group, perGroup + 1, group.rows[perGroup]))
      .filter((slot): slot is QualifierSlot => Boolean(slot))
      .sort(compareSlots)
      .slice(0, advancement.bestThirds)
    : [];
  return [...direct.flat(), ...thirds];
}

/** Menor potência de dois capaz de acomodar todos os classificados. */
export function bracketSize(teamCount: number) {
  let size = 1;
  while (size < teamCount) size *= 2;
  return Math.max(2, size);
}

/**
 * Cruzamento do chaveamento.
 * - `padrao`: seed 1 enfrenta o último, seed 2 o penúltimo (evita que os
 *   primeiros colocados se cruzem cedo) e distribui os byes aos melhores seeds.
 * - `sequencial`: confrontos entre vizinhos na ordem de classificação.
 */
export function seedPairs(slots: readonly QualifierSlot[], crossing: TournamentAdvancement['crossing'] = 'padrao'): BracketPair[] {
  const teams = slots.map((slot) => slot.team).filter(Boolean);
  if (teams.length < 2) return [];
  if (crossing === 'sequencial') {
    const pairs: BracketPair[] = [];
    for (let index = 0; index < teams.length; index += 2) pairs.push({ order: pairs.length + 1, entryA: teams[index], entryB: teams[index + 1] ?? null });
    return pairs;
  }
  const size = bracketSize(teams.length);
  const seeded: Array<string | null> = [...teams, ...Array.from({ length: size - teams.length }, () => null)];
  const pairs: BracketPair[] = [];
  for (let index = 0; index < size / 2; index += 1) {
    const entryA = seeded[index];
    const entryB = seeded[size - 1 - index];
    if (!entryA) continue;
    pairs.push({ order: pairs.length + 1, entryA, entryB });
  }
  return pairs;
}

/** Equipes que avançam sem jogar por causa de um bye. */
export function byes(pairs: readonly BracketPair[]) {
  return pairs.filter((pair) => !pair.entryB).map((pair) => pair.entryA);
}

/** Nome da rodada eliminatória a partir da quantidade de equipes nela. */
export function roundName(teamCount: number) {
  if (teamCount <= 2) return 'Final';
  if (teamCount <= 4) return 'Semifinal';
  if (teamCount <= 8) return 'Quartas de final';
  if (teamCount <= 16) return 'Oitavas de final';
  return 'Fase eliminatória';
}

/** Descreve o critério de avanço configurado, para exibir na tela de fases. */
export function describeAdvancement(advancement: TournamentAdvancement, groupCount: number) {
  const perGroup = `${advancement.perGroup} ${advancement.perGroup === 1 ? 'equipe avança' : 'equipes avançam'} por grupo`;
  const thirds = advancement.bestThirds > 0 ? ` + ${advancement.bestThirds} ${advancement.bestThirds === 1 ? 'melhor terceiro' : 'melhores terceiros'}` : '';
  const total = advancement.perGroup * Math.max(1, groupCount) + advancement.bestThirds;
  const crossing = advancement.crossing === 'padrao' ? 'cruzamento olímpico' : 'cruzamento sequencial';
  return `${perGroup}${thirds} · ${total} classificados · ${crossing}${advancement.thirdPlaceMatch ? ' · com disputa de 3º lugar' : ''}`;
}
