import type { FrontendState, MatchState } from './frontend-state.ts';
import { resolveDisciplineRule } from './discipline-rules.ts';
import { tournamentProgress } from './tournament-engine.ts';
import { describeCompletion, regulationFromRule } from './regulation.ts';

export type Tone = 'blue' | 'pink' | 'orange';

/** Uma categoria (disputa) da edição: Futsal Masculino, Vôlei Feminino… */
export type CategoryView = {
  id: string;
  name: string;
  discipline: string;
  status: string;
  /** Participantes inscritos, ou `null` enquanto a inscrição não foi configurada. */
  entries: number | null;
  phase: string;
  /** Andamento calculado a partir dos jogos, não um número decorativo. */
  progress: number;
  tone: Tone;
  created: boolean;
};

/** Uma modalidade da edição (o esporte), com as categorias que existem nela. */
export type DisciplineView = {
  name: string;
  mode: string;
  config: string;
  tone: Tone;
  enabled: boolean;
  categories: CategoryView[];
};

const tones: Tone[] = ['blue', 'pink', 'orange'];

/**
 * Categorias da edição ativa. Ponto único: telas administrativas e públicas
 * usavam cópias divergentes disso.
 */
export function listCategories(state: Pick<FrontendState, 'tournaments' | 'matches'>, editionId?: string): CategoryView[] {
  const progressOf = (id: string, hasSetup: boolean) => tournamentProgress(
    listMatches(state, editionId, { tournamentId: id }).map((match) => ({ id: match.id, entryA: match.entryA, entryB: match.entryB, scoreA: match.scoreA, scoreB: match.scoreB, status: match.status })),
    hasSetup,
  );
  return Object.entries(state.tournaments)
    .filter(([, item]) => !editionId || item.editionId === editionId)
    .map(([id, item], index) => ({
      id,
      name: item.name ?? 'Categoria',
      discipline: item.discipline ?? 'Modalidade',
      status: item.status,
      // Sem ninguém inscrito o card diz isso, em vez de inventar um total.
      entries: item.participants.length || null,
      phase: item.phases[0]?.name ?? 'Configuração',
      progress: progressOf(id, item.generated),
      tone: (item.tone ?? tones[index % tones.length]) as Tone,
      created: Boolean(item.created),
    }));
}

/**
 * Modalidades habilitadas na edição, cada uma com suas categorias. A regra
 * resumida vem do regulamento vigente, não de um texto solto.
 */
export function listDisciplines(state: Pick<FrontendState, 'tournaments' | 'disciplines' | 'matches'>, editionId?: string): DisciplineView[] {
  const categories = listCategories(state, editionId);
  const names = [...new Set([
    ...Object.entries(state.disciplines).map(([key, item]) => item.name ?? key),
    ...categories.map((item) => item.discipline),
  ])];
  return names.map((name, index) => {
    const stored = state.disciplines[name];
    const rule = resolveDisciplineRule(name, stored);
    return {
      name,
      mode: stored?.mode ?? 'Coletiva',
      config: stored?.config ?? describeCompletion(regulationFromRule(name, rule)),
      tone: (stored?.tone ?? tones[index % tones.length]) as Tone,
      enabled: stored?.enabled !== false,
      categories: categories.filter((item) => item.discipline === name),
    };
  });
}

/**
 * Uma partida já resolvida, com todos os campos que cards e listas precisam.
 */
export type MatchView = {
  id: string;
  editionId?: string;
  tournamentId?: string;
  discipline: string;
  entryA: string;
  logoA: string;
  entryB: string;
  logoB: string;
  scoreA: number | null;
  scoreB: number | null;
  date: string;
  time: string;
  venue: string;
  phase: string;
  status: NonNullable<MatchState['status']>;
  created: boolean;
};

export type MatchFilter = { discipline?: string; tournamentId?: string };

function matchView(id: string, match: MatchState): MatchView {
  return {
    id,
    editionId: match.editionId,
    tournamentId: match.tournamentId,
    discipline: match.discipline ?? 'Modalidade',
    entryA: match.entryA ?? 'Equipe A',
    logoA: match.logoA ?? '',
    entryB: match.entryB ?? 'Equipe B',
    logoB: match.logoB ?? '',
    scoreA: match.scoreA ?? null,
    scoreB: match.scoreB ?? null,
    date: match.date ?? 'A definir',
    time: match.time ?? '--:--',
    venue: match.venue ?? 'A definir',
    phase: match.phase ?? 'Fase atual',
    status: match.status ?? 'Agendada',
    created: Boolean(match.created),
  };
}

/** Uma partida da edição, já com os defaults aplicados. */
export function findMatch(state: Pick<FrontendState, 'matches'>, id: string): MatchView | undefined {
  const match = state.matches[id];
  return match ? matchView(id, match) : undefined;
}

/**
 * Partidas da edição. Os defaults ficam aqui e só aqui — cada tela que remontava
 * esse objeto por conta própria escolhia os seus, e era assim que duas telas
 * passavam a discordar.
 */
export function listMatches(state: Pick<FrontendState, 'matches'>, editionId?: string, filter: MatchFilter = {}): MatchView[] {
  return Object.entries(state.matches)
    .filter(([, item]) => !editionId || item.editionId === editionId)
    .map(([id, item]) => matchView(id, item))
    .filter((item) => (!filter.discipline || item.discipline === filter.discipline) && (!filter.tournamentId || item.tournamentId === filter.tournamentId));
}

export type AthleteView = { id: string; name: string; teamId: string; modalities: string[]; created: boolean };

/**
 * Elenco da equipe. Um atleta removido fica registrado com `removed`, para
 * preservar o histórico sem continuar aparecendo na equipe.
 */
export function athletesOfTeam(state: Pick<FrontendState, 'athletes'>, teamId: string): AthleteView[] {
  return Object.entries(state.athletes)
    .filter(([, athlete]) => athlete.teamId === teamId && !athlete.removed)
    .map(([id, athlete]) => ({ id, name: athlete.name ?? 'Atleta', teamId, modalities: athlete.modalities ?? [], created: Boolean(athlete.created) }));
}

/** Todos os atletas ativos da edição, com a equipe a que pertencem. */
export function listAthletes(state: Pick<FrontendState, 'athletes'>): AthleteView[] {
  return Object.entries(state.athletes)
    .filter(([, athlete]) => !athlete.removed)
    .map(([id, athlete]) => ({ id, name: athlete.name ?? 'Atleta', teamId: athlete.teamId ?? '', modalities: athlete.modalities ?? [], created: Boolean(athlete.created) }));
}

/** Atletas que o regulamento aceita escalar nesta modalidade. */
export function eligibleAthletes(state: Pick<FrontendState, 'athletes'>, teamId: string, discipline: string) {
  return athletesOfTeam(state, teamId).filter((athlete) => athlete.modalities.includes(discipline));
}

export type TeamView = { id: string; name: string; initials: string; responsible: string; logo: string; tone: Tone; athletes: number; archived: boolean; created: boolean };

/**
 * Equipes vivas da edição, sem as arquivadas. `athletes` sai do elenco real —
 * antes era um contador solto que começava errado e só sabia crescer.
 */
export function listTeams(state: Pick<FrontendState, 'teams' | 'athletes'>): TeamView[] {
  return teamViews(state).filter((team) => !team.archived);
}

/** Todas as equipes, inclusive as arquivadas — a lista tem filtro para elas. */
export function listAllTeams(state: Pick<FrontendState, 'teams' | 'athletes'>): TeamView[] {
  return teamViews(state);
}

function teamViews(state: Pick<FrontendState, 'teams' | 'athletes'>): TeamView[] {
  return Object.entries(state.teams).map(([id, team], index) => ({
    id,
    name: team.name ?? 'Equipe',
    initials: team.initials ?? (team.name ?? 'EQ').slice(0, 3).toLocaleUpperCase('pt-BR'),
    responsible: team.responsible ?? '',
    logo: team.logo ?? '',
    tone: (team.tone ?? tones[index % tones.length]) as Tone,
    athletes: athletesOfTeam(state, id).length,
    archived: Boolean(team.archived),
    created: Boolean(team.created),
  }));
}

/** Uma equipe pelo id, inclusive arquivada: a tela de detalhe precisa dela. */
export function findTeam(state: Pick<FrontendState, 'teams' | 'athletes'>, id: string): TeamView | undefined {
  return teamViews(state).find((team) => team.id === id);
}

export function findTeamByName(state: Pick<FrontendState, 'teams' | 'athletes'>, name: string) {
  return listTeams(state).find((team) => team.name === name);
}

export function findDiscipline(state: Pick<FrontendState, 'tournaments' | 'disciplines' | 'matches'>, slug: string, editionId?: string) {
  const target = decodeURIComponent(slug).toLocaleLowerCase('pt-BR');
  return listDisciplines(state, editionId).find((item) => item.name.toLocaleLowerCase('pt-BR') === target);
}

export function findCategory(state: Pick<FrontendState, 'tournaments' | 'matches'>, id: string, editionId?: string) {
  return listCategories(state, editionId).find((item) => item.id === id);
}

export function disciplineHref(name: string) {
  return `/disciplines/${encodeURIComponent(name.toLocaleLowerCase('pt-BR'))}`;
}
