import type { EditionState, MatchState, TournamentState } from './frontend-state.js';

export type EditionStatus = EditionState['status'];
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

/**
 * A edição é a exceção: guarda o enum da API, não o rótulo.
 *
 * A constante existe pelo mesmo motivo das de cima — `'ONGOING'` da edição e
 * `'ONGOING'` da categoria são o mesmo texto para estados diferentes, e o
 * compilador só distingue os dois se cada um tiver seu nome.
 */
export const editionStatus = {
  planning: 'PLANNING',
  ongoing: 'ONGOING',
  finished: 'FINISHED',
  archived: 'ARCHIVED',
} as const satisfies Record<string, EditionStatus>;

/**
 * Os estados da edição na ordem do ciclo de vida.
 *
 * O seletor da tela de edições lista a partir daqui: enquanto as opções eram
 * quatro `<option>` escritas à mão, acrescentar um estado exigia lembrar de
 * dois lugares, e a ordem podia sair diferente da do vocabulário.
 */
export const editionStatuses: EditionStatus[] = [editionStatus.planning, editionStatus.ongoing, editionStatus.finished, editionStatus.archived];

const editionStatusLabels: Record<EditionStatus, string> = {
  PLANNING: 'Planejamento',
  ONGOING: 'Em andamento',
  FINISHED: 'Finalizada',
  ARCHIVED: 'Arquivada',
};

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

/**
 * Rótulo do estado da edição, em português, para o card e o seletor.
 *
 * Devolve o próprio código quando não conhece o estado: se a API ganhar um
 * quinto valor antes deste pacote, a tela mostra `'SUSPENDED'` — feio, e
 * ainda assim melhor do que um espaço em branco no lugar do estado.
 */
export function getEditionStatusLabel(status: string) {
  return editionStatusLabels[status as EditionStatus] ?? status;
}

/** Rótulo curto do estado da partida, usado nos cards e no resumo. */
export function getMatchStatusLabel(status: string) {
  if (status === matchStatus.live) return 'Ao vivo';
  if (isTerminalMatch(status)) return 'Encerrado';
  return 'Próximo';
}
