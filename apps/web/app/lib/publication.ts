import type { FrontendState, TournamentState } from './frontend-state.ts';
import { privateTournamentStatuses, tournamentStatus } from './status.ts';

export { isOfficialResult, officialMatchStatuses } from './status.ts';

/** Estados de disputa que o público pode ver. */
export const publicTournamentStatuses: TournamentState['status'][] = [tournamentStatus.published, tournamentStatus.running, tournamentStatus.closed];

/**
 * A lista de exclusão vive em `status.ts`: o catálogo inicial usa rótulos
 * legados (como `Agendado`) que significam "publicado" e continuam visíveis.
 */
export { privateTournamentStatuses } from './status.ts';

export function isPublicTournamentStatus(status?: string) {
  return !privateTournamentStatuses.includes(status ?? '');
}

/**
 * A disputa aparece na área pública? Partidas sem disputa vinculada seguem o
 * comportamento antigo e continuam visíveis.
 */
export function isPublicTournament(state: Pick<FrontendState, 'tournaments'>, tournamentId?: string, fallbackStatus?: string) {
  if (!tournamentId) return true;
  const stored = state.tournaments[tournamentId];
  if (!stored) return fallbackStatus === undefined ? true : isPublicTournamentStatus(fallbackStatus);
  return isPublicTournamentStatus(stored.status);
}

/** A partida pode ser exibida publicamente? */
export function isPublicMatch(state: Pick<FrontendState, 'tournaments'>, match: { tournamentId?: string; status?: string }) {
  return isPublicTournament(state, match.tournamentId);
}

