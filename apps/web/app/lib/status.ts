import type { MatchState, TournamentState } from './frontend-state.ts';

export type MatchStatus = NonNullable<MatchState['status']>;
export type TournamentStatus = TournamentState['status'];

/**
 * Vocabulário de estado do app.
 *
 * Existe porque `'Encerrada'` (partida) e `'Encerrado'` (categoria) diferem por
 * uma letra e conviviam soltos em ~98 comparações — um typo compilava.
 */
export const matchStatus = {
  scheduled: 'Agendada',
  live: 'Ao vivo',
  finished: 'Encerrada',
  postponed: 'Adiada',
  cancelled: 'Cancelada',
  walkover: 'W.O.',
} as const satisfies Record<string, MatchStatus>;

export const tournamentStatus = {
  draft: 'Rascunho',
  published: 'Publicado',
  running: 'Em andamento',
  closed: 'Encerrado',
  archived: 'Arquivado',
} as const satisfies Record<string, TournamentStatus>;

/** Resultado oficial: entra na classificação e aparece na área pública. */
export const officialMatchStatuses: MatchStatus[] = [matchStatus.finished, matchStatus.walkover];
/** Estados finais: a partida não volta a ser operada. */
export const terminalMatchStatuses: MatchStatus[] = [matchStatus.finished, matchStatus.cancelled, matchStatus.walkover];
/** Ainda no calendário, esperando para acontecer. */
export const pendingMatchStatuses: MatchStatus[] = [matchStatus.scheduled, matchStatus.postponed];
/** Já saiu do papel: foi operada ou decidida. */
export const startedMatchStatuses: MatchStatus[] = [matchStatus.live, matchStatus.finished, matchStatus.walkover];

/** Categorias que já começaram — travam estrutura e elenco. */
export const startedTournamentStatuses: TournamentStatus[] = [tournamentStatus.running, tournamentStatus.closed, tournamentStatus.archived];
/** Categorias que o público não vê. */
export const privateTournamentStatuses: string[] = [tournamentStatus.draft, tournamentStatus.archived];
/** Categorias com pódio definido, base das bonificações automáticas. */
export const decidedTournamentStatuses: TournamentStatus[] = [tournamentStatus.closed, tournamentStatus.archived];

export function isLive(status?: string) {
  return status === matchStatus.live;
}

export function isOfficialResult(status?: string) {
  return officialMatchStatuses.includes(status as MatchStatus);
}

export function isTerminalMatch(status?: string) {
  return terminalMatchStatuses.includes(status as MatchStatus);
}

export function isPendingMatch(status?: string) {
  return pendingMatchStatuses.includes(status as MatchStatus);
}

export function hasStarted(status?: string) {
  return startedMatchStatuses.includes(status as MatchStatus);
}

export function isTournamentStarted(status?: string) {
  return startedTournamentStatuses.includes(status as TournamentStatus);
}

export function isTournamentDecided(status?: string) {
  return decidedTournamentStatuses.includes(status as TournamentStatus);
}

/** Rótulo curto do estado da partida, usado nos cards e no resumo. */
export function getMatchStatusLabel(status: string) {
  if (status === matchStatus.live) return 'Ao vivo';
  if (isTerminalMatch(status)) return 'Encerrado';
  return 'Próximo';
}
