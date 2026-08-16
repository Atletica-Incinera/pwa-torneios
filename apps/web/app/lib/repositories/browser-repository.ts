'use client';

/**
 * Fachada do repositório persistido no navegador. Componentes dependem desta
 * interface, enquanto localStorage e sua migração permanecem encapsulados.
 */
export { getActiveCompetition, getActiveEdition, initialFrontendState } from '@atletica-incinera/intereng-contract/state';
export { readFrontendState } from '../browser-state.ts';
export { useFrontendState } from './frontend-state-provider';
export type { DispatchResult, StateStatus } from './frontend-state-provider';
export type { Action } from '@atletica-incinera/intereng-contract/actions';
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
  StaffState,
  TeamState,
  TournamentAdvancement,
  TournamentPhase,
  TournamentState,
} from '@atletica-incinera/intereng-contract/state';
