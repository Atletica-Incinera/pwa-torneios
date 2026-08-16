import type { CompletionRule, KnockoutMethod, KnockoutRule, RosterRule, ScoringAction, SecondaryAction, StandingsRule, WalkoverRule } from './regulation.js';
import { seedAthletes, seedDisciplines, seedMatches, seedStaff, seedTeams, seedTournaments } from './edition-seed.js';
import type { StaffRoleLabel } from './staff-roles.js';

export type CompetitionState = { id: string; name: string; slug: string; active: boolean };
export type EditionState = { id: string; name: string; year: number; start: string; end: string; status: 'Planejamento' | 'Em andamento' | 'Finalizada' | 'Arquivada'; active: boolean; competitionId?: string };
export type TeamState = { name?: string; initials?: string; responsible?: string; logo?: string; archived?: boolean; created?: boolean; tone?: 'blue' | 'pink' | 'orange' };
export type AthleteState = { name?: string; teamId?: string; modalities?: string[]; created?: boolean; /** Saiu da equipe: o registro fica para o histórico, mas não conta no elenco. */ removed?: boolean };
export type DisciplineRule = {
  periodLabel: string;
  periodCount: number;
  periodDurationMinutes: number;
  clockMode: 'progressive' | 'countdown' | 'none';
  scoringEvent: string;
  secondaryEvents: [string, string];
  /** Regulamento esportivo. Opcionais para manter compatível o estado já salvo. */
  scoring?: ScoringAction[];
  secondary?: SecondaryAction[];
  completion?: CompletionRule;
  roster?: RosterRule;
  standings?: StandingsRule;
  knockout?: KnockoutRule;
  walkover?: WalkoverRule;
};
export type DisciplineState = { config?: string; rules?: DisciplineRule; enabled?: boolean; created?: boolean; name?: string; mode?: 'Coletiva' | 'Individual'; tournaments?: number; tone?: 'blue' | 'pink' | 'orange'; startedAt?: string };
export type TournamentPhase = { id: string; name: string; format: 'Grupos' | 'Mata-mata' | 'Liga'; groups: string[]; qualifiers: number };
/** Origem das equipes do mata-mata: quantas por grupo, melhores terceiros e cruzamento. */
export type TournamentAdvancement = { perGroup: number; bestThirds: number; crossing: 'padrao' | 'sequencial'; thirdPlaceMatch: boolean };
export type TournamentState = { status: 'Rascunho' | 'Publicado' | 'Em andamento' | 'Encerrado' | 'Arquivado'; participants: string[]; seeds: Record<string, number>; phases: TournamentPhase[]; assignments: Record<string, string>; generated: boolean; editionId?: string; created?: boolean; name?: string; discipline?: string; format?: string; tone?: 'blue' | 'pink' | 'orange'; advancement?: TournamentAdvancement; /** Equipes que avançam sem jogar, por posição no chaveamento. */ byes?: Record<string, string> };
/** Estado do placar imediatamente antes do evento, usado para desfazer. */
export type MatchScoreSnapshot = { scoreA: number; scoreB: number; periodScoreA: number; periodScoreB: number; currentPeriod: number };
export type MatchEventState = { id: string; at: string; elapsedSeconds: number; period?: number; periodElapsedSeconds?: number; type: string; detail: string; side: 'home' | 'away' | 'neutral'; scoreA: number; scoreB: number; previousScoreA?: number; previousScoreB?: number; points?: number; previous?: MatchScoreSnapshot };
/** Desempate obrigatório de partida eliminatória terminada empatada. */
export type MatchTiebreakState = { method: KnockoutMethod; label: string; scoreA: number; scoreB: number; winner: string; reason: string; decidedBy: string; at: string };
/** Retificação de resultado após o encerramento. */
export type MatchCorrectionState = { id: string; at: string; actor: string; reason: string; before: string; after: string };
export type MatchState = { date?: string; time?: string; venue?: string; status?: 'Agendada' | 'Ao vivo' | 'Encerrada' | 'Adiada' | 'Cancelada' | 'W.O.'; reason?: string; scoreA?: number | null; scoreB?: number | null; created?: boolean; editionId?: string; discipline?: string; entryA?: string; entryB?: string; logoA?: string; logoB?: string; phase?: string; tournamentId?: string; rules?: DisciplineRule; currentPeriod?: number; clockSeconds?: number; runningSince?: string; paused?: boolean; events?: MatchEventState[]; operatorId?: string; operatorName?: string; operatorHeartbeat?: string; periodScoreA?: number; periodScoreB?: number; periodResults?: Array<{ period: number; scoreA: number; scoreB: number }>; startedAt?: string; startedBy?: string; startNote?: string; tiebreak?: MatchTiebreakState; corrections?: MatchCorrectionState[]; walkoverWinner?: string };
/** Posição do pódio que gera bonificação automática a partir do resultado oficial. */
export type OverallPosition = 'campeao' | 'vice' | 'terceiro' | 'participacao';
export type OverallMetricState = { id: string; name: string; defaultPoints: number; position?: OverallPosition };
export type OverallAwardState = { id: string; editionId: string; teamId: string; discipline: string; metricId: string; points: number; note?: string; createdAt: string; origin?: 'manual' | 'automatico'; revokedAt?: string; revokedBy?: string; revokeReason?: string };
/** Fechamento oficial do ranking geral da edição. */
export type OverallClosureState = { editionId: string; at: string; actor: string; note?: string };
export type OverallRankingState = { metrics: OverallMetricState[]; awards: OverallAwardState[]; closures?: OverallClosureState[] };
export type StaffState = {
  name: string;
  email: string;
  initials: string;
  role: StaffRoleLabel;
  scope: string;
  revoked?: boolean;
};
export type AuditState = { id: string; at: string; actor: string; action: string; entity: string; before?: string; after?: string; reason?: string };

export type FrontendState = {
  competitions: CompetitionState[];
  editions: EditionState[];
  teams: Record<string, TeamState>;
  athletes: Record<string, AthleteState>;
  disciplines: Record<string, DisciplineState>;
  tournaments: Record<string, TournamentState>;
  matches: Record<string, MatchState>;
  overallRanking: OverallRankingState;
  staff: Record<string, StaffState>;
  audit: AuditState[];
  preferences: { selectedDiscipline: string; notifications: boolean; soundEffects: boolean };
};

export const initialFrontendState: FrontendState = {
  competitions: [{ id: 'jogos-engenharia', name: 'InterEng', slug: 'intereng', active: true }],
  editions: [
    { id: 'intereng-2026', name: '2026', year: 2026, start: '2026-10-12', end: '2026-10-19', status: 'Em andamento', active: true, competitionId: 'jogos-engenharia' },
    { id: 'intereng-2025', name: '2025', year: 2025, start: '2025-10-13', end: '2025-10-20', status: 'Finalizada', active: false, competitionId: 'jogos-engenharia' },
    { id: 'intereng-2024', name: '2024', year: 2024, start: '2024-10-14', end: '2024-10-21', status: 'Arquivada', active: false, competitionId: 'jogos-engenharia' },
  ],
  teams: {},
  athletes: {},
  disciplines: {},
  tournaments: {},
  matches: {},
  overallRanking: {
    metrics: [
      { id: 'metric-champion', name: 'Campeão da modalidade', defaultPoints: 10, position: 'campeao' },
      { id: 'metric-runner-up', name: 'Vice-campeão', defaultPoints: 7, position: 'vice' },
      { id: 'metric-third', name: 'Terceiro lugar', defaultPoints: 5, position: 'terceiro' },
      { id: 'metric-participation', name: 'Participação', defaultPoints: 1, position: 'participacao' },
    ],
    awards: [],
    closures: [],
  },
  staff: {},
  audit: [],
  preferences: { selectedDiscipline: 'Futsal', notifications: true, soundEffects: true },
};

/**
 * O primeiro snapshot do adaptador local: o esqueleto com os dados da edição.
 * É o equivalente ao que o servidor devolverá em `GET /editions/:id/snapshot`.
 */
export const seededFrontendState: FrontendState = {
  ...initialFrontendState,
  teams: seedTeams,
  athletes: seedAthletes,
  disciplines: seedDisciplines,
  tournaments: seedTournaments,
  matches: seedMatches,
  staff: seedStaff,
};

export function getActiveCompetition(state: Pick<FrontendState, 'competitions'>) {
  return state.competitions.find((item) => item.active) ?? state.competitions[0];
}

export function getActiveEdition(state: Pick<FrontendState, 'competitions' | 'editions'>) {
  const competition = getActiveCompetition(state);
  const editions = state.editions.filter((item) => !competition || (item.competitionId ?? 'jogos-engenharia') === competition.id);
  return editions.find((item) => item.active) ?? editions[0] ?? state.editions[0];
}

/**
 * Lê um snapshot gravado, completando o que falta com a base recebida.
 *
 * A base vem por parâmetro e não tem valor padrão de propósito: no
 * servidor, cair na edição de exemplo por acidente encheria o banco de
 * equipe fictícia.
 */
export function parseFrontendState(value: string | null, base: FrontendState): FrontendState {
  if (!value) return base;
  try {
    const parsed = JSON.parse(value) as Partial<FrontendState>;
    const competitions = (parsed.competitions ?? base.competitions).map((competition) => competition.id === 'jogos-engenharia' && competition.name === 'Jogos de Engenharia' ? { ...competition, name: 'InterEng', slug: 'intereng' } : competition);
    const editions = (parsed.editions ?? base.editions).map((edition) => /^InterEng\s+\d{4}$/i.test(edition.name) ? { ...edition, name: String(edition.year) } : edition);
    const activeEditionId = getActiveEdition({ competitions, editions })?.id ?? 'intereng-2026';
    const tournaments = Object.fromEntries(Object.entries(parsed.tournaments ?? {}).map(([id, item]) => [id, { ...item, editionId: item.editionId ?? activeEditionId }]));
    const matches = Object.fromEntries(Object.entries(parsed.matches ?? {}).map(([id, item]) => [id, { ...item, editionId: item.editionId ?? activeEditionId }]));
    return {
      ...base,
      ...parsed,
      competitions,
      editions,
      teams: { ...base.teams, ...parsed.teams },
      athletes: { ...base.athletes, ...parsed.athletes },
      disciplines: { ...base.disciplines, ...parsed.disciplines },
      tournaments: { ...base.tournaments, ...tournaments },
      matches: { ...base.matches, ...matches },
      overallRanking: {
        metrics: parsed.overallRanking?.metrics ?? base.overallRanking.metrics,
        awards: parsed.overallRanking?.awards ?? base.overallRanking.awards,
        closures: parsed.overallRanking?.closures ?? [],
      },
      staff: { ...base.staff, ...parsed.staff },
      audit: parsed.audit ?? [],
      preferences: { ...base.preferences, ...parsed.preferences },
    };
  } catch { return base; }
}
