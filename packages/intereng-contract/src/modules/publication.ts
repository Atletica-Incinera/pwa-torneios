import type { FrontendState } from './frontend-state.js';
import { privateTournamentStatuses } from './status.js';

export { isOfficialResult, officialMatchStatuses } from './status.js';

/**
 * A lista de exclusão vive em `status.ts`: o catálogo inicial usa rótulos
 * legados (como `Agendado`) que significam "publicado" e continuam visíveis.
 */
export { privateTournamentStatuses } from './status.js';

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

