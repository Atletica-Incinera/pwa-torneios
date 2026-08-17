'use client';

/**
 * Fachada do repositório persistido no navegador. Componentes dependem desta
 * interface, enquanto localStorage e sua migração permanecem encapsulados.
 */
export { getActiveCompetition, getActiveEdition, initialFrontendState, readFrontendState } from '../frontend-state';
export { useFrontendState } from './use-frontend-state';
export type { DispatchResult, StateStatus } from './use-frontend-state';
export type { Action } from './actions';
export type {
  AthleteState,
  AuditState,
  CompetitionState,
  DisciplineRule,
  DisciplineState,
  EditionState,
  FrontendState,
  MatchCorrectionState,
  MatchEventState,
  MatchScoreSnapshot,
  MatchState,
  MatchTiebreakState,
  OverallAwardState,
  OverallClosureState,
  OverallMetricState,
  OverallPosition,
  OverallRankingState,
  PhaseStandingState,
  StaffState,
  TeamState,
  TournamentAdvancement,
  TournamentPhase,
  TournamentState,
} from '../frontend-state';
