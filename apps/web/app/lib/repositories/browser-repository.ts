'use client';

/**
 * Fachada do repositório persistido no navegador. Componentes dependem desta
 * interface, enquanto localStorage e sua migração permanecem encapsulados.
 */
export { getActiveCompetition, getActiveEdition, initialFrontendState, readFrontendState, useFrontendState } from '../frontend-state';
export type {
  AthleteState,
  AuditState,
  CompetitionState,
  DisciplineRule,
  DisciplineState,
  EditionState,
  FrontendState,
  MatchEventState,
  MatchState,
  OverallAwardState,
  OverallMetricState,
  OverallRankingState,
  StaffState,
  TeamState,
  TournamentPhase,
  TournamentState,
} from '../frontend-state';
