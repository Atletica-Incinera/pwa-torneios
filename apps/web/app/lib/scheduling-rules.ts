import { formatDateKey, fromDateKey, resolveMatchDate } from './date-utils.ts';
import { estimatedMatchMinutes, resolveRegulation, type Regulation } from './regulation.ts';
import type { FrontendState } from './frontend-state.ts';
import { listMatches } from './edition-catalog.ts';

/** Partida já existente na agenda, venha do catálogo inicial ou do estado local. */
export type ScheduledMatch = {
  id: string;
  date: string;
  time: string;
  venue: string;
  discipline: string;
  entryA: string;
  entryB: string;
  status: string;
  durationMinutes: number;
};

export type ScheduleCandidate = Omit<ScheduledMatch, 'id' | 'status'> & { id?: string };

/** Janela da edição: nenhuma partida pode ficar fora dela. */
export type EditionWindow = { start: string; end: string };

export type SchedulingPolicy = {
  /** Tempo de troca entre dois jogos na mesma quadra. */
  changeoverMinutes: number;
  /** Descanso mínimo entre dois jogos da mesma equipe. */
  teamRestMinutes: number;
};

export const defaultSchedulingPolicy: SchedulingPolicy = { changeoverMinutes: 15, teamRestMinutes: 60 };

export type ScheduleConflictCode = 'fora-da-edicao' | 'horario-invalido' | 'confronto-duplicado' | 'local-ocupado' | 'equipe-ocupada' | 'equipe-sem-descanso';

export type ScheduleConflict = { code: ScheduleConflictCode; message: string; matchId?: string };

/** Estados que liberam o horário e a quadra: o jogo não será disputado ali. */
const releasedStatuses = ['Cancelada', 'Adiada', 'W.O.'];

function minutesOfDay(time: string) {
  const [hours, minutes] = (time ?? '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** Instante absoluto em minutos, para comparar partidas em dias diferentes. */
export function absoluteMinutes(date: string, time: string) {
  const dayIndex = Math.round(fromDateKey(resolveMatchDate(date)).getTime() / 86_400_000);
  const offset = minutesOfDay(time);
  return offset === null ? null : dayIndex * 1440 + offset;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

function sameVenue(a: string, b: string) {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

function label(match: ScheduledMatch) {
  return `${match.entryA} × ${match.entryB} (${match.time})`;
}

/** Duração padrão de uma partida da modalidade, já com prorrogação prevista. */
export function scheduledDuration(regulation: Regulation) {
  return Math.max(20, estimatedMatchMinutes(regulation));
}

/**
 * Todas as críticas de agenda de uma partida nova ou reagendada: janela da
 * edição, confronto repetido, quadra ocupada, equipe em dois jogos ao mesmo
 * tempo e descanso mínimo entre jogos da mesma equipe.
 */
export function findScheduleConflicts(
  candidate: ScheduleCandidate,
  existing: readonly ScheduledMatch[],
  options: { window?: EditionWindow; policy?: SchedulingPolicy } = {},
): ScheduleConflict[] {
  const policy = options.policy ?? defaultSchedulingPolicy;
  const conflicts: ScheduleConflict[] = [];
  const start = absoluteMinutes(candidate.date, candidate.time);
  if (start === null) return [{ code: 'horario-invalido', message: 'Informe uma data e um horário válidos.' }];
  const end = start + Math.max(1, candidate.durationMinutes);

  const window = options.window;
  if (window?.start && window?.end) {
    const dateKey = resolveMatchDate(candidate.date);
    if (dateKey < window.start || dateKey > window.end) {
      conflicts.push({ code: 'fora-da-edicao', message: `A partida está fora do período da edição (${formatDateKey(window.start)} a ${formatDateKey(window.end)}).` });
    }
  }

  const candidateTeams = [candidate.entryA, candidate.entryB].filter(Boolean);
  for (const match of existing) {
    if (candidate.id && match.id === candidate.id) continue;
    if (releasedStatuses.includes(match.status)) continue;
    const otherStart = absoluteMinutes(match.date, match.time);
    if (otherStart === null) continue;
    const otherEnd = otherStart + Math.max(1, match.durationMinutes);
    const sharedTeams = candidateTeams.filter((team) => team === match.entryA || team === match.entryB);
    const samePair = sharedTeams.length === 2;

    if (samePair && otherStart === start) {
      conflicts.push({ code: 'confronto-duplicado', message: `Este confronto já está agendado em ${formatDateKey(match.date)} às ${match.time}.`, matchId: match.id });
      continue;
    }
    if (candidate.venue && match.venue && sameVenue(candidate.venue, match.venue) && overlaps(start, end + policy.changeoverMinutes, otherStart, otherEnd + policy.changeoverMinutes)) {
      conflicts.push({ code: 'local-ocupado', message: `${candidate.venue} está ocupado por ${label(match)} — considere ${match.durationMinutes} min de jogo e ${policy.changeoverMinutes} min de troca.`, matchId: match.id });
    }
    if (sharedTeams.length) {
      if (overlaps(start, end, otherStart, otherEnd)) {
        conflicts.push({ code: 'equipe-ocupada', message: `${sharedTeams.join(' e ')} já está em ${label(match)} nesse horário.`, matchId: match.id });
      } else {
        const gap = start >= otherEnd ? start - otherEnd : otherStart - end;
        if (gap < policy.teamRestMinutes) {
          conflicts.push({ code: 'equipe-sem-descanso', message: `${sharedTeams.join(' e ')} teria apenas ${gap} min entre ${label(match)} e este jogo (mínimo ${policy.teamRestMinutes} min).`, matchId: match.id });
        }
      }
    }
  }

  return conflicts.filter((conflict, index) => conflicts.findIndex((item) => item.code === conflict.code && item.matchId === conflict.matchId) === index);
}

/**
 * Agenda completa da edição: os jogos do catálogo inicial e os criados no app,
 * cada um com a duração prevista pelo regulamento da sua modalidade. É a base
 * de comparação obrigatória antes de marcar qualquer partida nova.
 */
export function collectScheduledMatches(state: Pick<FrontendState, 'matches' | 'disciplines'>, editionId?: string): ScheduledMatch[] {
  return listMatches(state, editionId).map((match) => ({
    id: match.id,
    date: match.date,
    time: match.time,
    venue: match.venue,
    discipline: match.discipline,
    entryA: match.entryA,
    entryB: match.entryB,
    status: match.status,
    durationMinutes: scheduledDuration(resolveRegulation(match.discipline, state.disciplines[match.discipline], state.matches[match.id]?.rules)),
  }));
}

/** Conflitos que impedem o agendamento; os demais podem ser aceitos com justificativa. */
export const blockingConflictCodes: ScheduleConflictCode[] = ['horario-invalido', 'confronto-duplicado', 'local-ocupado', 'equipe-ocupada', 'fora-da-edicao'];

export function isBlocking(conflict: ScheduleConflict) {
  return blockingConflictCodes.includes(conflict.code);
}
