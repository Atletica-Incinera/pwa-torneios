import type { FrontendState, TournamentState } from './frontend-state.js';
import { isEliminationPhase } from './match-lifecycle.js';
import { hasStarted, isTournamentStarted } from './status.js';
import { athletesOfTeam, eligibleAthletes, findTeamByName, listTeams } from './edition-catalog.js';
import type { Regulation } from './regulation.js';

export type { AthleteView as AthleteRef } from './edition-catalog.js';

/** O diretório de equipes é o mesmo usado pelas telas: `edition-catalog`. */
export { listTeams as teamDirectory, findTeamByName, athletesOfTeam, eligibleAthletes };
export type { TeamView as TeamRef } from './edition-catalog.js';

export type RosterCheck = { ok: boolean; count: number; severity: 'ok' | 'aviso' | 'erro'; message: string };

/** Aplica mínimo, máximo e obrigatoriedade de elenco declarados na modalidade. */
export function checkRoster(regulation: Regulation, count: number): RosterCheck {
  const { required, min, max } = regulation.roster;
  if (!required) return { ok: true, count, severity: 'ok', message: count ? `${count} atletas associados.` : 'Esta modalidade não exige elenco.' };
  if (count === 0) return { ok: false, count, severity: 'erro', message: `${regulation.discipline} exige elenco: associe ao menos ${min} atletas à equipe.` };
  if (count < min) return { ok: false, count, severity: 'erro', message: `Elenco incompleto: ${count} de ${min} atletas mínimos.` };
  if (count > max) return { ok: false, count, severity: 'erro', message: `Elenco acima do limite: ${count} atletas para o máximo de ${max}.` };
  return { ok: true, count, severity: 'ok', message: `${count} atletas aptos (mínimo ${min}, máximo ${max}).` };
}

/** A seleção de participantes da categoria é a fonte obrigatória da agenda. */
export function isTeamRegistered(tournament: Pick<TournamentState, 'participants'> | undefined, teamName: string) {
  return Boolean(tournament?.participants.includes(teamName));
}

/** A modalidade já começou quando existe partida operada ou disputa em andamento. */
export function disciplineStarted(state: Pick<FrontendState, 'matches' | 'tournaments'>, discipline: string, editionId?: string) {
  const startedMatch = Object.values(state.matches).some((match) => match.discipline === discipline && (!editionId || match.editionId === editionId) && hasStarted(match.status));
  const startedTournament = Object.values(state.tournaments).some((tournament) => tournament.discipline === discipline && (!editionId || tournament.editionId === editionId) && isTournamentStarted(tournament.status));
  return startedMatch || startedTournament;
}

/** Já existe partida eliminatória criada nesta modalidade? */
export function knockoutStarted(state: Pick<FrontendState, 'matches'>, discipline: string, editionId?: string) {
  return Object.values(state.matches).some((match) => match.discipline === discipline && (!editionId || match.editionId === editionId) && isEliminationPhase(match.phase));
}

export type RosterLockCheck = { allowed: boolean; message: string };

/** Até quando o elenco e os participantes podem ser alterados. */
export function checkRosterLock(state: Pick<FrontendState, 'matches' | 'tournaments'>, regulation: Regulation, editionId?: string): RosterLockCheck {
  const { lock } = regulation.roster;
  if (lock === 'never') return { allowed: true, message: 'O regulamento permite alterar o elenco a qualquer momento.' };
  if (lock === 'discipline-start' && disciplineStarted(state, regulation.discipline, editionId)) {
    return { allowed: false, message: `${regulation.discipline} já começou: o elenco está bloqueado pelo regulamento.` };
  }
  if (lock === 'knockout' && knockoutStarted(state, regulation.discipline, editionId)) {
    return { allowed: false, message: `${regulation.discipline} já está no mata-mata: o elenco não pode mais ser alterado.` };
  }
  return { allowed: true, message: lock === 'knockout' ? 'O elenco pode ser alterado até o início do mata-mata.' : 'O elenco pode ser alterado até o início da modalidade.' };
}

export type MatchEligibility = { ok: boolean; blocking: string[]; warnings: string[] };

/**
 * Crítica antes de agendar ou operar um jogo.
 *
 * Só bloqueia o que deixa a competição inconsistente: equipe fora da categoria
 * ou fora do cadastro. Elenco incompleto é aviso — no InterEng o elenco costuma
 * ser preenchido depois da agenda, e travar o jogo por causa disso parava a
 * operação inteira sem evitar erro nenhum.
 */
export function checkMatchEligibility(
  state: Pick<FrontendState, 'teams' | 'athletes'>,
  regulation: Regulation,
  tournament: Pick<TournamentState, 'participants'> | undefined,
  entryA: string,
  entryB: string,
): MatchEligibility {
  const blocking: string[] = [];
  const warnings: string[] = [];
  for (const name of [entryA, entryB]) {
    if (!name) continue;
    if (!isTeamRegistered(tournament, name)) {
      blocking.push(`${name} não está inscrita nesta categoria. Inclua a equipe nos participantes antes de agendar.`);
      continue;
    }
    const team = findTeamByName(state, name);
    if (!team) {
      blocking.push(`${name} não foi encontrada no cadastro de equipes da edição.`);
      continue;
    }
    const roster = checkRoster(regulation, eligibleAthletes(state, team.id, regulation.discipline).length);
    if (!roster.ok) warnings.push(`${name}: ${roster.message}`);
  }
  return { ok: blocking.length === 0, blocking, warnings };
}
