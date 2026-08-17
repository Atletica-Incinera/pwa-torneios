import { initialFrontendState } from '@atletica-incinera/intereng-contract/state';
import { demoUsers, seedAthletes, seedDisciplines, seedMatches, seedStaff, seedTeams, seedTournaments } from '@atletica-incinera/intereng-contract/seed';

/**
 * A API de mentira: as rotas REST do inventário, com os corpos de verdade.
 *
 * Enquanto o banco da API não existe, este arquivo é a única referência
 * executável que temos dela — e por isso ele imita o que dói, não só o que é
 * conveniente: o envelope `{ data }` em toda resposta de sucesso, o
 * `{ error: { code, message } }` em toda falha, o `forbidNonWhitelisted` que
 * transforma campo extra em 400, o `200` (e não `201`) do login, o `204` sem
 * corpo dos DELETE, e o id gerado pelo servidor em tudo que nasce.
 *
 * Ele não roda o reducer do contrato. Rodar seria mais fácil e seria mentira:
 * a API é um controller por recurso, e é essa granularidade que o adaptador
 * precisa enfrentar aqui antes de enfrentar no dia da integração.
 *
 * O roteador vive separado do servidor HTTP de propósito: `server.ts` o embrulha
 * em `node:http` para os e2e, e os testes de componente o embrulham num `fetch`
 * — uma implementação só, exercitada pelos dois portões.
 */

export type MockRequest = { method: string; path: string; query: URLSearchParams; body: Record<string, unknown>; token: string | null };
export type MockResponse = { status: number; body?: unknown };

type Staff = { id: string; name: string; email: string; password?: string; isSuperAdmin: boolean };
type StaffRole = { id: string; editionId: string; staffId: string; disciplineId: string | null; role: 'EDITION_ADMIN' | 'DISCIPLINE_MANAGER' };
type Competition = { id: string; name: string; slug: string };
type Edition = { id: string; competitionId: string; year: number; name: string; startDate: string; endDate: string; status: 'PLANNING' | 'ONGOING' | 'FINISHED' | 'ARCHIVED' };
type Discipline = { id: string; name: string; slug: string; isIndividual: boolean; description: string | null };
type EditionDiscipline = { id: string; editionId: string; disciplineId: string; config: Record<string, unknown> | null };
type Team = { id: string; name: string; slug: string };
type Athlete = { id: string; name: string; document: string; birthDate: string | null; email: string | null };
type Roster = { id: string; editionId: string; disciplineId: string; athleteId: string; teamId: string | null; jerseyNumber: number | null; status: 'ACTIVE' | 'INJURED' | 'SUSPENDED' | 'WITHDRAWN' };
type Tournament = { id: string; editionId: string; disciplineId: string; name: string; format: string; status: 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'FINISHED' | 'CANCELLED' };
type Entry = { id: string; tournamentId: string; teamId: string | null; athleteId: string | null; seed: number | null; createdAt: string };
type Phase = { id: string; tournamentId: string; order: number; name: string; type: 'GROUP' | 'LEAGUE' | 'KNOCKOUT'; config: Record<string, unknown> | null; createdAt: string };
type Group = { id: string; phaseId: string; name: string; createdAt: string };
type GroupEntry = { id: string; groupId: string; entryId: string };
type Match = { id: string; phaseId: string; groupId: string | null; round: number | null; bracketSlot: number | null; entryAId: string | null; entryBId: string | null; winnerEntryId: string | null; scoreA: number; scoreB: number; status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'WALKOVER' | 'CANCELLED' | 'POSTPONED'; scheduledAt: string | null; venue: string | null; lastEventSequence: number };
type MatchEvent = { id: string; matchId: string; entryId: string | null; athleteId: string | null; type: string; sequence: number; metadata: Record<string, unknown> | null; occurredAt: string };

type Store = {
  competitions: Competition[];
  editions: Edition[];
  disciplines: Discipline[];
  editionDisciplines: EditionDiscipline[];
  teams: Team[];
  athletes: Athlete[];
  rosters: Roster[];
  staff: Staff[];
  staffRoles: StaffRole[];
  tournaments: Tournament[];
  entries: Entry[];
  phases: Phase[];
  groups: Group[];
  groupEntries: GroupEntry[];
  matches: Match[];
  events: MatchEvent[];
  /**
   * A classificação **persistida** por fase, como a tabela `phase_standings`.
   *
   * Não é calculada na leitura de propósito. Na API ela é escrita pelo
   * recálculo que o encerramento de partida dispara, e é essa distância entre
   * escrever e ler que produz a corrida que o front precisa enfrentar; um mock
   * que calculasse na hora responderia sempre certo e esconderia o problema.
   */
  standings: Record<string, StandingRow[]>;
};

/** Uma linha de `phase_standings`. O nome não é gravado: vem da inscrição. */
type StandingRow = { entryId: string; played: number; won: number; drawn: number; lost: number; scoreFor: number; scoreAgainst: number; points: number; rank: number | null };

/**
 * Falha com o corpo que o filtro global da API produz.
 *
 * Os campos são atribuídos no corpo, e não declarados no parâmetro: o `node`
 * que roda este arquivo nos e2e só remove tipos, e propriedade de parâmetro
 * exigiria transformar código.
 */
class HttpError extends Error {
  status: number;
  code: string;
  details?: Array<{ field: string; issue: string }>;

  constructor(status: number, code: string, message: string, details?: Array<{ field: string; issue: string }>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const editionId = 'intereng-2026';

function slugFrom(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Id do servidor.
 *
 * Aleatório de propósito, como o `uuid` do Prisma: o id que o cliente escolheu
 * não sobrevive ao cadastro, e é aqui que isso precisa ficar visível — um mock
 * que devolvesse o id enviado deixaria passar toda navegação que depende dele.
 */
function newId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random.replace(/-/g, '').slice(0, 16)}`;
}

/** Instante local a partir do dia e da hora que a semente descreve. */
function atLocal(day: string, time: string) {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, date, hour, minute).toISOString();
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// O estado da edição não aparece aqui: a semente do contrato já guarda o enum.
const tournamentStatus = { 'Rascunho': 'DRAFT', 'Publicado': 'SCHEDULED', 'Em andamento': 'ONGOING', 'Encerrado': 'FINISHED', 'Arquivado': 'CANCELLED' } as const;
const matchStatus = { 'Agendada': 'SCHEDULED', 'Ao vivo': 'LIVE', 'Encerrada': 'FINISHED', 'Adiada': 'POSTPONED', 'Cancelada': 'CANCELLED', 'W.O.': 'WALKOVER' } as const;

/**
 * A edição de exemplo, traduzida para o modelo da API.
 *
 * A semente continua sendo a do contrato — é o que mantém o modo local e o modo
 * `http` mostrando a mesma edição —, mas aqui ela é desmontada nas tabelas que
 * a API tem de verdade: catálogo global de equipe e atleta, inscrição por
 * modalidade, torneio com fases, e partida pendurada numa fase.
 */
function seed(): Store {
  const competitions: Competition[] = [{ id: 'jogos-engenharia', name: 'InterEng', slug: 'intereng' }];
  const editions: Edition[] = initialFrontendState.editions.map((edition) => ({
    id: edition.id,
    competitionId: edition.competitionId ?? 'jogos-engenharia',
    year: edition.year,
    name: edition.name,
    startDate: `${edition.start}T12:00:00.000Z`,
    endDate: `${edition.end}T12:00:00.000Z`,
    status: edition.status,
  }));

  const disciplines: Discipline[] = Object.entries(seedDisciplines).map(([name, item]) => ({ id: slugFrom(name), name, slug: slugFrom(name), isIndividual: item.mode === 'Individual', description: null }));
  const editionDisciplines: EditionDiscipline[] = disciplines.map((discipline) => ({ id: `ed-${discipline.id}`, editionId, disciplineId: discipline.id, config: null }));
  const teams: Team[] = Object.entries(seedTeams).map(([id, team]) => ({ id, name: team.name ?? id, slug: id }));
  const athletes: Athlete[] = Object.entries(seedAthletes).map(([id, athlete]) => ({ id, name: athlete.name ?? id, document: `doc-${id}`, birthDate: null, email: null }));

  const rosters: Roster[] = Object.entries(seedAthletes).flatMap(([athleteId, athlete]) => (athlete.modalities ?? []).map((modality) => ({
    id: `roster-${athleteId}-${slugFrom(modality)}`,
    editionId,
    disciplineId: slugFrom(modality),
    athleteId,
    teamId: athlete.teamId ?? null,
    jerseyNumber: null,
    status: 'ACTIVE' as const,
  })));

  const staff: Staff[] = Object.values(seedStaff).map((member) => ({
    id: `staff-${member.email}`,
    name: member.name,
    email: member.email,
    password: demoUsers.find((user) => user.email === member.email)?.password,
    isSuperAdmin: false,
  }));
  for (const user of demoUsers) {
    if (staff.some((member) => member.email === user.email)) continue;
    staff.push({ id: `staff-${user.email}`, name: user.name, email: user.email, password: user.password, isSuperAdmin: user.role === 'SUPER_ADMIN' });
  }
  const staffRoles: StaffRole[] = Object.values(seedStaff).map((member) => ({
    id: `role-${member.email}`,
    editionId,
    staffId: `staff-${member.email}`,
    disciplineId: member.role === 'Gestor de modalidade' ? slugFrom(member.scope) : null,
    role: member.role === 'Admin da edição' ? 'EDITION_ADMIN' : 'DISCIPLINE_MANAGER',
  }));

  const tournaments: Tournament[] = Object.entries(seedTournaments).map(([id, item]) => ({
    id,
    editionId: item.editionId ?? editionId,
    disciplineId: slugFrom(item.discipline ?? ''),
    name: item.name ?? id,
    format: 'GROUP_KNOCKOUT',
    status: tournamentStatus[item.status],
  }));

  const phases: Phase[] = tournaments.flatMap((tournament) => [
    { id: `${tournament.id}-grupos`, tournamentId: tournament.id, order: 1, name: 'Fase de grupos', type: 'GROUP' as const, config: { advanceCount: 2, tiebreakers: ['points', 'goalDiff'] }, createdAt: new Date().toISOString() },
    { id: `${tournament.id}-mata-mata`, tournamentId: tournament.id, order: 2, name: 'Mata-mata', type: 'KNOCKOUT' as const, config: {}, createdAt: new Date().toISOString() },
  ]);
  const groups: Group[] = tournaments.flatMap((tournament) => ['Grupo A', 'Grupo B'].map((name) => ({ id: `${tournament.id}-${slugFrom(name)}`, phaseId: `${tournament.id}-grupos`, name, createdAt: new Date().toISOString() })));

  // As inscrições nascem das equipes que a semente coloca em quadra: sem elas
  // a partida não teria a quem apontar, e `entryA`/`entryB` viriam nulos.
  const entries: Entry[] = [];
  const groupEntries: GroupEntry[] = [];
  const matches: Match[] = [];
  const teamByName = new Map(teams.map((team) => [team.name, team]));

  for (const [id, match] of Object.entries(seedMatches)) {
    const tournamentId = match.tournamentId ?? '';
    const emGrupo = (match.phase ?? '').startsWith('Grupo');
    const phaseId = emGrupo ? `${tournamentId}-grupos` : `${tournamentId}-mata-mata`;
    const inscrever = (name?: string) => {
      const team = name ? teamByName.get(name) : undefined;
      if (!team) return null;
      const existente = entries.find((entry) => entry.tournamentId === tournamentId && entry.teamId === team.id);
      if (existente) return existente.id;
      const entry: Entry = { id: `entry-${tournamentId}-${team.id}`, tournamentId, teamId: team.id, athleteId: null, seed: null, createdAt: new Date().toISOString() };
      entries.push(entry);
      if (emGrupo) groupEntries.push({ id: `ge-${entry.id}`, groupId: `${tournamentId}-grupo-a`, entryId: entry.id });
      return entry.id;
    };
    const entryAId = inscrever(match.entryA);
    const entryBId = inscrever(match.entryB);
    matches.push({
      id,
      phaseId,
      groupId: emGrupo ? `${tournamentId}-grupo-a` : null,
      round: emGrupo ? 1 : 2,
      bracketSlot: emGrupo ? null : matches.length + 1,
      entryAId,
      entryBId,
      winnerEntryId: null,
      scoreA: match.scoreA ?? 0,
      scoreB: match.scoreB ?? 0,
      status: matchStatus[match.status ?? 'Agendada'],
      scheduledAt: atLocal(today(), match.time ?? '00:00'),
      venue: match.venue ?? null,
      lastEventSequence: 0,
    });
  }

  const store: Store = { competitions, editions, disciplines, editionDisciplines, teams, athletes, rosters, staff, staffRoles, tournaments, entries, phases, groups, groupEntries, matches, events: [], standings: {} };
  // Um banco com edição em andamento tem classificação gravada: o recálculo
  // rodou quando cada partida foi encerrada. Semear sem ela deixaria toda fase
  // com a tabela vazia, e o front cairia no cálculo dele em todo cenário — que
  // é justamente o que não queremos exercitar aqui.
  for (const phase of store.phases) store.standings[phase.id] = recomputeStandings(store, phase.id);
  return store;
}

/** Os estados de partida que entram na conta, como no servidor. */
const countedStatuses: Array<Match['status']> = ['FINISHED', 'WALKOVER'];

const balanceOf = (row: StandingRow) => row.scoreFor - row.scoreAgainst;

type Criterion = (left: string, right: string, stats: Map<string, StandingRow>, matches: Match[], subset: string[]) => number;

/**
 * As estratégias de desempate da API, pelos nomes com que `config.tiebreakers`
 * as chama (`src/standings/strategies/index.ts`). `scoreFor` é apelido de
 * `goalsFor` lá, e é apelido aqui. Todas comparam do maior para o menor.
 */
const criteria: Record<string, Criterion> = {
  points: (left, right, stats) => (stats.get(right)?.points ?? 0) - (stats.get(left)?.points ?? 0),
  goalDiff: (left, right, stats) => balanceOf(stats.get(right) ?? emptyRow(right)) - balanceOf(stats.get(left) ?? emptyRow(left)),
  goalsFor: (left, right, stats) => (stats.get(right)?.scoreFor ?? 0) - (stats.get(left)?.scoreFor ?? 0),
  scoreFor: (left, right, stats) => (stats.get(right)?.scoreFor ?? 0) - (stats.get(left)?.scoreFor ?? 0),
  headToHead: (left, right, _stats, matches, subset) => {
    const pontos = new Map(subset.map((id) => [id, 0]));
    for (const match of matches) {
      const { entryAId, entryBId, winnerEntryId } = match;
      if (!entryAId || !entryBId || !pontos.has(entryAId) || !pontos.has(entryBId)) continue;
      if (winnerEntryId === entryAId) pontos.set(entryAId, (pontos.get(entryAId) ?? 0) + 3);
      else if (winnerEntryId === entryBId) pontos.set(entryBId, (pontos.get(entryBId) ?? 0) + 3);
      else { pontos.set(entryAId, (pontos.get(entryAId) ?? 0) + 1); pontos.set(entryBId, (pontos.get(entryBId) ?? 0) + 1); }
    }
    return (pontos.get(right) ?? 0) - (pontos.get(left) ?? 0);
  },
};

function emptyRow(entryId: string): StandingRow {
  return { entryId, played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, points: 0, rank: null };
}

/**
 * O recálculo da fase, como `StandingsService.recomputeStandings` o faz.
 *
 * Fiel em três pontos que o front sente: é **por grupo** quando a fase tem
 * grupos — daí o `rank` reiniciar em cada um e se repetir entre eles na lista
 * plana que a rota devolve —, a fase sem grupos conta todas as inscrições do
 * torneio contra as partidas soltas dela, e um grupo sem inscrição nenhuma não
 * gera linha alguma.
 */
function recomputeStandings(store: Store, phaseId: string): StandingRow[] {
  const phase = store.phases.find((item) => item.id === phaseId);
  if (!phase) return [];
  const tiebreakers = (phase.config as { tiebreakers?: string[] } | null)?.tiebreakers ?? ['points', 'goalDiff'];
  const groups = store.groups.filter((group) => group.phaseId === phaseId);
  const jobs = groups.length
    ? groups.map((group) => ({
      entryIds: store.groupEntries.filter((item) => item.groupId === group.id).map((item) => item.entryId),
      matches: store.matches.filter((match) => match.groupId === group.id && countedStatuses.includes(match.status)),
    }))
    : [{
      entryIds: store.entries.filter((entry) => entry.tournamentId === phase.tournamentId).map((entry) => entry.id),
      matches: store.matches.filter((match) => match.phaseId === phaseId && match.groupId === null && countedStatuses.includes(match.status)),
    }];
  return jobs.filter((job) => job.entryIds.length).flatMap((job) => computeSubset(job.entryIds, job.matches, tiebreakers));
}

/** A tabela de um grupo (ou da fase inteira), ordenada e com posição. */
function computeSubset(entryIds: string[], matches: Match[], tiebreakers: string[]): StandingRow[] {
  const stats = new Map(entryIds.map((entryId) => [entryId, emptyRow(entryId)]));
  for (const match of matches) {
    const a = match.entryAId ? stats.get(match.entryAId) : undefined;
    const b = match.entryBId ? stats.get(match.entryBId) : undefined;
    if (!a || !b) continue;
    a.played += 1; b.played += 1;
    a.scoreFor += match.scoreA; a.scoreAgainst += match.scoreB;
    b.scoreFor += match.scoreB; b.scoreAgainst += match.scoreA;
    // Vitória é de quem ficou gravado como vencedor, não de quem fez mais
    // pontos. É o que faz o W.O. — que não grava vencedor nenhum — virar
    // empate de um ponto para cada lado, e o placar corrigido depois do
    // encerramento não mudar quem venceu.
    if (match.winnerEntryId === a.entryId) { a.won += 1; a.points += 3; b.lost += 1; }
    else if (match.winnerEntryId === b.entryId) { b.won += 1; b.points += 3; a.lost += 1; }
    else { a.drawn += 1; b.drawn += 1; a.points += 1; b.points += 1; }
  }

  const compare = (left: string, right: string, subset: string[]) => {
    for (const id of tiebreakers) {
      // Critério que a API não conhece não desempata nada, e não é erro: lá o
      // registro de estratégias devolve `undefined` e a comparação vira zero.
      const decision = criteria[id] ? criteria[id](left, right, stats, matches, subset) : 0;
      if (decision !== 0) return decision;
    }
    return 0;
  };
  // O último critério é o id, para a ordem não depender da ordem de inserção.
  const ordered = [...entryIds].sort((left, right) => compare(left, right, entryIds) || left.localeCompare(right));
  return ordered.map((entryId, position) => {
    const row = stats.get(entryId) ?? emptyRow(entryId);
    const previous = ordered[position - 1];
    // Empate em todos os critérios repete a posição: é o que o servidor grava,
    // e é o que faz uma tabela ter duas linhas em primeiro.
    row.rank = position === 0 ? 1 : compare(entryId, previous, [entryId, previous]) === 0 ? stats.get(previous)?.rank ?? position + 1 : position + 1;
    return row;
  });
}

/** Uma rota, e o que ela responde. */
type Handler = (request: MockRequest, params: Record<string, string>) => unknown;
type Route = { method: string; segments: string[]; status: number; handle: Handler };

export type MockApi = {
  handle(request: MockRequest): MockResponse;
  reset(): void;
  /** Quem está ouvindo o stream de uma partida. `server.ts` cuida do fio. */
  listeners: Set<{ matchId: string; send: (frame: string) => void }>;
};

export function createMockApi(): MockApi {
  let store = seed();
  /** Acessos emitidos. Some no `/test/expire-access`, como token que vence. */
  let sessions = new Map<string, string>();
  /** Renovações emitidas. Sobrevive ao vencimento do acesso. */
  let refreshes = new Map<string, string>();
  /** Falha armada por cenário: `{ method, path }` liga, corpo vazio desliga. */
  let armed: { method: string; path: string; status: number; message: string } | null = null;
  let sequence = 0;
  /** Leituras da classificação que ainda respondem a tabela velha. */
  let standingsLag = 0;
  /** Recálculos prontos e represados enquanto o atraso não termina. */
  const deferred = new Map<string, StandingRow[]>();
  const listeners = new Set<{ matchId: string; send: (frame: string) => void }>();

  // -------------------------------------------------------------- utilidades

  function staffOf(request: MockRequest): Staff | null {
    const id = request.token ? sessions.get(request.token) : null;
    return store.staff.find((member) => member.id === id) ?? null;
  }

  function requireStaff(request: MockRequest) {
    const staff = staffOf(request);
    if (!staff) throw new HttpError(401, 'UNAUTHORIZED', 'Token de acesso inválido ou expirado.');
    return staff;
  }

  /** O papel do staff naquela edição, com a herança que o guard aplica. */
  function requireRole(request: MockRequest, edition: string, discipline?: string | null) {
    const staff = requireStaff(request);
    if (staff.isSuperAdmin) return staff;
    const roles = store.staffRoles.filter((role) => role.staffId === staff.id && role.editionId === edition);
    if (roles.some((role) => role.role === 'EDITION_ADMIN')) return staff;
    if (discipline !== undefined && roles.some((role) => role.role === 'DISCIPLINE_MANAGER' && role.disciplineId === discipline)) return staff;
    throw new HttpError(403, 'FORBIDDEN', 'Forbidden resource');
  }

  function requireEditionAdmin(request: MockRequest, edition: string) {
    return requireRole(request, edition, undefined);
  }

  /**
   * O corpo, como o `ValidationPipe` global o trata: campo desconhecido é
   * `400`, não silêncio. É o detalhe que mais derruba integração — o front
   * manda um campo a mais e a requisição inteira volta como erro de validação.
   */
  function body<T extends Record<string, unknown>>(request: MockRequest, allowed: string[], required: string[] = []) {
    const extras = Object.keys(request.body).filter((key) => !allowed.includes(key));
    if (extras.length) throw new HttpError(400, 'VALIDATION_ERROR', 'Erro de validação nos campos enviados.', extras.map((field) => ({ field, issue: `property ${field} should not exist` })));
    const faltando = required.filter((key) => request.body[key] === undefined || request.body[key] === null || request.body[key] === '');
    if (faltando.length) throw new HttpError(400, 'VALIDATION_ERROR', 'Erro de validação nos campos enviados.', faltando.map((field) => ({ field, issue: `${field} não pode ser vazio` })));
    return request.body as T;
  }

  function found<T>(item: T | undefined, what: string, id: string): T {
    if (!item) throw new HttpError(404, 'NOT_FOUND', `${what} com ID "${id}" não encontrado.`);
    return item;
  }

  function unique(condition: boolean, field: string) {
    if (condition) throw new HttpError(409, 'CONFLICT', 'Conflito de dados. Um registro com esses dados já existe.', [{ field, issue: 'must be unique' }]);
  }

  function paginate<T>(items: T[], query: URLSearchParams) {
    const page = Math.max(1, Number(query.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize') ?? 20)));
    const total = items.length;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  // ------------------------------------------------------------- projeções

  const disciplineName = (id: string) => store.disciplines.find((item) => item.id === id)?.name ?? '';
  const teamName = (id: string | null) => store.teams.find((item) => item.id === id)?.name ?? null;
  const athleteName = (id: string | null) => store.athletes.find((item) => item.id === id)?.name ?? null;
  const entryName = (id: string | null) => {
    const entry = store.entries.find((item) => item.id === id);
    if (!entry) return null;
    return teamName(entry.teamId) ?? athleteName(entry.athleteId);
  };

  function editionDisciplineView(item: EditionDiscipline) {
    const discipline = store.disciplines.find((row) => row.id === item.disciplineId);
    return { id: item.id, disciplineId: item.disciplineId, disciplineName: discipline?.name ?? '', isIndividual: discipline?.isIndividual ?? false, config: item.config };
  }

  function rosterView(roster: Roster) {
    const athlete = store.athletes.find((item) => item.id === roster.athleteId);
    return {
      id: roster.id,
      editionId: roster.editionId,
      editionName: store.editions.find((item) => item.id === roster.editionId)?.name ?? '',
      disciplineId: roster.disciplineId,
      disciplineName: disciplineName(roster.disciplineId),
      teamId: roster.teamId,
      teamName: teamName(roster.teamId),
      jerseyNumber: roster.jerseyNumber,
      status: roster.status,
      athlete: { id: roster.athleteId, name: athlete?.name ?? '' },
    };
  }

  function entryView(entry: Entry) {
    return { id: entry.id, tournamentId: entry.tournamentId, teamId: entry.teamId, teamName: teamName(entry.teamId), athleteId: entry.athleteId, athleteName: athleteName(entry.athleteId), seed: entry.seed, createdAt: entry.createdAt };
  }

  function matchView(match: Match) {
    return {
      id: match.id,
      phaseId: match.phaseId,
      groupId: match.groupId,
      round: match.round,
      bracketSlot: match.bracketSlot,
      entryA: match.entryAId ? { id: match.entryAId, name: entryName(match.entryAId) ?? '' } : null,
      entryB: match.entryBId ? { id: match.entryBId, name: entryName(match.entryBId) ?? '' } : null,
      winnerEntryId: match.winnerEntryId,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      status: match.status,
      scheduledAt: match.scheduledAt,
      venue: match.venue,
      lastEventSequence: match.lastEventSequence,
    };
  }

  function staffRoleView(role: StaffRole) {
    const member = store.staff.find((item) => item.id === role.staffId);
    return {
      id: role.id,
      editionId: role.editionId,
      editionName: store.editions.find((item) => item.id === role.editionId)?.name ?? '',
      staffId: role.staffId,
      staffName: member?.name ?? '',
      staffEmail: member?.email ?? '',
      disciplineId: role.disciplineId,
      disciplineName: role.disciplineId ? disciplineName(role.disciplineId) : null,
      role: role.role,
    };
  }

  /**
   * A classificação gravada da fase, com o nome resolvido na leitura.
   *
   * O nome não está na tabela: o servidor o tira da inscrição na hora de
   * responder (`standings.mapper.ts`), então uma equipe renomeada aparece com o
   * nome novo numa tabela calculada antes da renomeação.
   */
  function standingsOf(phaseId: string) {
    return (store.standings[phaseId] ?? []).map((row) => ({ ...row, entryName: entryName(row.entryId) ?? '' }));
  }

  /**
   * O recálculo, com o atraso que o cenário tiver armado.
   *
   * Na API isto acontece fora da requisição: o `PATCH /matches/:id/status`
   * publica `MATCH_FINISHED` com `eventEmitter.emit`, sem `await`
   * (`src/matches/matches.service.ts:432`), e quem recalcula é um manipulador
   * assíncrono cuja promessa ninguém segura. Sem o gancho, aqui a tabela nova
   * fica pronta antes de a resposta sair e a corrida do front nunca acontece.
   */
  function recomputar(phaseId: string) {
    const fresca = recomputeStandings(store, phaseId);
    if (standingsLag > 0) deferred.set(phaseId, fresca);
    else store.standings[phaseId] = fresca;
  }

  /** Uma leitura passou: o recálculo represado se aproxima de valer. */
  function liberar(phaseId: string) {
    if (!deferred.has(phaseId)) return;
    standingsLag -= 1;
    if (standingsLag > 0) return;
    store.standings[phaseId] = deferred.get(phaseId) ?? [];
    deferred.delete(phaseId);
  }

  function bracketOf(tournamentId: string) {
    const tournament = found(store.tournaments.find((item) => item.id === tournamentId), 'Torneio', tournamentId);
    const phases = store.phases.filter((phase) => phase.tournamentId === tournamentId).sort((left, right) => left.order - right.order);
    return {
      format: tournament.format,
      phases: phases.map((phase) => {
        if (phase.type === 'KNOCKOUT') {
          return {
            phaseId: phase.id,
            name: phase.name,
            type: phase.type,
            matches: store.matches.filter((match) => match.phaseId === phase.id).map((match) => ({ round: match.round, bracketSlot: match.bracketSlot, entryA: entryName(match.entryAId), entryB: entryName(match.entryBId), scoreA: match.scoreA, scoreB: match.scoreB, winner: entryName(match.winnerEntryId) })),
          };
        }
        const classificacao = standingsOf(phase.id);
        return {
          phaseId: phase.id,
          name: phase.name,
          type: phase.type,
          groups: store.groups.filter((group) => group.phaseId === phase.id).map((group) => {
            const doGrupo = store.groupEntries.filter((item) => item.groupId === group.id).map((item) => item.entryId);
            return { name: group.name, standings: classificacao.filter((row) => doGrupo.includes(row.entryId)) };
          }),
        };
      }),
    };
  }

  // ------------------------------------------------------------------ sessão

  function issue(staff: Staff) {
    const accessToken = newId('access');
    const refreshToken = newId('refresh');
    sessions.set(accessToken, staff.id);
    refreshes.set(refreshToken, staff.id);
    return { accessToken, refreshToken, expiresIn: 900, staff: { id: staff.id, name: staff.name, email: staff.email, isSuperAdmin: staff.isSuperAdmin } };
  }

  // ------------------------------------------------------------------- rotas

  const routes: Route[] = [];
  const route = (method: string, path: string, handle: Handler, status = 200) => routes.push({ method, segments: path.split('/').filter(Boolean), status, handle });

  route('GET', '/health', () => ({ status: 'ok' }));

  route('POST', '/auth/login', (request) => {
    const { email, password } = body<{ email: string; password: string }>(request, ['email', 'password'], ['email', 'password']);
    const staff = store.staff.find((member) => member.email === email && member.password && member.password === password);
    if (!staff) throw new HttpError(401, 'UNAUTHORIZED', 'Credenciais inválidas.');
    return issue(staff);
  });

  route('POST', '/auth/refresh', (request) => {
    const { refreshToken } = body<{ refreshToken?: string }>(request, ['refreshToken']);
    if (!refreshToken) throw new HttpError(400, 'VALIDATION_ERROR', 'Token de atualização não fornecido.');
    const staffId = refreshes.get(refreshToken);
    if (!staffId) throw new HttpError(401, 'UNAUTHORIZED', 'Token de atualização inválido ou expirado.');
    // Rotaciona: a credencial usada morre, como na API.
    refreshes.delete(refreshToken);
    return issue(found(store.staff.find((member) => member.id === staffId), 'Staff', staffId));
  });

  route('POST', '/auth/logout', (request) => {
    requireStaff(request);
    if (request.token) sessions.delete(request.token);
    return { message: 'Logout realizado com sucesso.' };
  });

  route('GET', '/auth/me', (request) => {
    const staff = requireStaff(request);
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      isSuperAdmin: staff.isSuperAdmin,
      editionRoles: store.staffRoles.filter((role) => role.staffId === staff.id).map((role) => ({
        editionId: role.editionId,
        editionName: store.editions.find((item) => item.id === role.editionId)?.name ?? '',
        disciplineId: role.disciplineId,
        disciplineName: role.disciplineId ? disciplineName(role.disciplineId) : null,
        role: role.role,
      })),
    };
  });

  route('GET', '/competitions', (request) => paginate([...store.competitions].sort((left, right) => left.name.localeCompare(right.name)), request.query));

  route('POST', '/competitions', (request) => {
    const staff = requireStaff(request);
    if (!staff.isSuperAdmin) throw new HttpError(403, 'FORBIDDEN', 'Apenas o super administrador pode criar competições.');
    const { name, slug } = body<{ name: string; slug: string }>(request, ['name', 'slug'], ['name', 'slug']);
    unique(store.competitions.some((item) => item.slug === slug), 'slug');
    const competition: Competition = { id: newId('comp'), name, slug };
    store.competitions.push(competition);
    return competition;
  }, 201);

  route('GET', '/competitions/:id', (_request, params) => found(store.competitions.find((item) => item.id === params.id), 'Competição', params.id));

  route('GET', '/competitions/:id/editions', (_request, params) => ({ data: store.editions.filter((item) => item.competitionId === params.id).sort((left, right) => right.year - left.year) }));

  route('POST', '/competitions/:id/editions', (request, params) => {
    const staff = requireStaff(request);
    if (!staff.isSuperAdmin) throw new HttpError(403, 'FORBIDDEN', 'Apenas o super administrador pode criar edições.');
    const dados = body<{ year: number; name: string; startDate: string; endDate: string }>(request, ['year', 'name', 'startDate', 'endDate'], ['year', 'name', 'startDate', 'endDate']);
    found(store.competitions.find((item) => item.id === params.id), 'Competição', params.id);
    unique(store.editions.some((item) => item.competitionId === params.id && item.year === dados.year), 'year');
    const edition: Edition = { id: newId('edition'), competitionId: params.id, year: dados.year, name: dados.name, startDate: dados.startDate, endDate: dados.endDate, status: 'PLANNING' };
    store.editions.push(edition);
    return edition;
  }, 201);

  route('GET', '/editions/:editionId', (_request, params) => found(store.editions.find((item) => item.id === params.editionId), 'Edição', params.editionId));

  route('PATCH', '/editions/:editionId', (request, params) => {
    requireEditionAdmin(request, params.editionId);
    const edition = found(store.editions.find((item) => item.id === params.editionId), 'Edição', params.editionId);
    const dados = body<{ name?: string; startDate?: string; endDate?: string }>(request, ['name', 'startDate', 'endDate']);
    Object.assign(edition, dados);
    return edition;
  });

  route('PATCH', '/editions/:editionId/status', (request, params) => {
    requireEditionAdmin(request, params.editionId);
    const edition = found(store.editions.find((item) => item.id === params.editionId), 'Edição', params.editionId);
    const { status } = body<{ status: Edition['status'] }>(request, ['status'], ['status']);
    if (!['PLANNING', 'ONGOING', 'FINISHED', 'ARCHIVED'].includes(status)) throw new HttpError(400, 'VALIDATION_ERROR', 'Erro de validação nos campos enviados.', [{ field: 'status', issue: 'status inválido' }]);
    edition.status = status;
    return edition;
  });

  route('GET', '/disciplines', (request) => paginate(store.disciplines, request.query));

  route('POST', '/disciplines', (request) => {
    const staff = requireStaff(request);
    const podeCriar = staff.isSuperAdmin || store.staffRoles.some((role) => role.staffId === staff.id && role.role === 'EDITION_ADMIN');
    if (!podeCriar) throw new HttpError(403, 'FORBIDDEN', 'Sem permissão para criar modalidades.');
    const dados = body<{ name: string; slug: string; isIndividual?: boolean; description?: string }>(request, ['name', 'slug', 'isIndividual', 'description'], ['name', 'slug']);
    unique(store.disciplines.some((item) => item.slug === dados.slug), 'slug');
    const discipline: Discipline = { id: newId('disc'), name: dados.name, slug: dados.slug, isIndividual: dados.isIndividual ?? false, description: dados.description ?? null };
    store.disciplines.push(discipline);
    return discipline;
  }, 201);

  route('GET', '/editions/:editionId/disciplines', (_request, params) => ({ data: store.editionDisciplines.filter((item) => item.editionId === params.editionId).map(editionDisciplineView) }));

  route('POST', '/editions/:editionId/disciplines', (request, params) => {
    requireEditionAdmin(request, params.editionId);
    const dados = body<{ disciplineId: string; config?: Record<string, unknown> }>(request, ['disciplineId', 'config'], ['disciplineId']);
    found(store.disciplines.find((item) => item.id === dados.disciplineId), 'Modalidade', dados.disciplineId);
    unique(store.editionDisciplines.some((item) => item.editionId === params.editionId && item.disciplineId === dados.disciplineId), 'disciplineId');
    const item: EditionDiscipline = { id: newId('ed'), editionId: params.editionId, disciplineId: dados.disciplineId, config: dados.config ?? null };
    store.editionDisciplines.push(item);
    return editionDisciplineView(item);
  }, 201);

  route('PATCH', '/editions/:editionId/disciplines/:id', (request, params) => {
    const item = found(store.editionDisciplines.find((row) => row.id === params.id), 'Modalidade da edição', params.id);
    requireRole(request, params.editionId, item.disciplineId);
    const { config } = body<{ config?: Record<string, unknown> }>(request, ['config']);
    item.config = config ?? item.config;
    return editionDisciplineView(item);
  });

  route('DELETE', '/editions/:editionId/disciplines/:disciplineId', (request, params) => {
    requireEditionAdmin(request, params.editionId);
    store.editionDisciplines = store.editionDisciplines.filter((item) => !(item.editionId === params.editionId && item.disciplineId === params.disciplineId));
    return undefined;
  }, 204);

  route('GET', '/teams', (request) => { requireStaff(request); return paginate(comSearch(store.teams, request), request.query); });

  route('POST', '/teams', (request) => {
    const staff = requireStaff(request);
    if (!staff.isSuperAdmin && !store.staffRoles.some((role) => role.staffId === staff.id && role.role === 'EDITION_ADMIN')) throw new HttpError(403, 'FORBIDDEN', 'Sem permissão para gerenciar o catálogo.');
    const dados = body<{ name: string; slug: string }>(request, ['name', 'slug'], ['name', 'slug']);
    unique(store.teams.some((item) => item.slug === dados.slug), 'slug');
    const team: Team = { id: newId('team'), name: dados.name, slug: dados.slug };
    store.teams.push(team);
    return team;
  }, 201);

  route('GET', '/teams/:id', (request, params) => { requireStaff(request); return found(store.teams.find((item) => item.id === params.id), 'Equipe', params.id); });

  route('GET', '/athletes', (request) => { requireStaff(request); return paginate(comSearch(store.athletes, request), request.query); });

  route('POST', '/athletes', (request) => {
    const staff = requireStaff(request);
    if (!staff.isSuperAdmin && !store.staffRoles.some((role) => role.staffId === staff.id && role.role === 'EDITION_ADMIN')) throw new HttpError(403, 'FORBIDDEN', 'Sem permissão para gerenciar o catálogo.');
    const dados = body<{ name: string; document: string; birthDate?: string; email?: string }>(request, ['name', 'document', 'birthDate', 'email'], ['name', 'document']);
    unique(store.athletes.some((item) => item.document === dados.document), 'document');
    const athlete: Athlete = { id: newId('athlete'), name: dados.name, document: dados.document, birthDate: dados.birthDate ?? null, email: dados.email ?? null };
    store.athletes.push(athlete);
    return athlete;
  }, 201);

  route('GET', '/athletes/:id', (request, params) => { requireStaff(request); return found(store.athletes.find((item) => item.id === params.id), 'Atleta', params.id); });

  route('GET', '/editions/:editionId/rosters', (request, params) => {
    const disciplina = request.query.get('disciplineId');
    const team = request.query.get('teamId');
    return { data: store.rosters.filter((roster) => roster.editionId === params.editionId && (!disciplina || roster.disciplineId === disciplina) && (!team || roster.teamId === team)).map(rosterView) };
  });

  route('POST', '/editions/:editionId/rosters', (request, params) => {
    const dados = body<{ disciplineId: string; athleteId: string; teamId: string; jerseyNumber?: number }>(request, ['disciplineId', 'athleteId', 'teamId', 'jerseyNumber'], ['disciplineId', 'athleteId', 'teamId']);
    requireRole(request, params.editionId, dados.disciplineId);
    found(store.athletes.find((item) => item.id === dados.athleteId), 'Atleta', dados.athleteId);
    found(store.teams.find((item) => item.id === dados.teamId), 'Equipe', dados.teamId);
    unique(store.rosters.some((roster) => roster.editionId === params.editionId && roster.disciplineId === dados.disciplineId && roster.athleteId === dados.athleteId), 'athleteId');
    const roster: Roster = { id: newId('roster'), editionId: params.editionId, disciplineId: dados.disciplineId, athleteId: dados.athleteId, teamId: dados.teamId, jerseyNumber: dados.jerseyNumber ?? null, status: 'ACTIVE' };
    store.rosters.push(roster);
    return rosterView(roster);
  }, 201);

  route('PATCH', '/editions/:editionId/rosters/:id', (request, params) => {
    const roster = found(store.rosters.find((item) => item.id === params.id), 'Inscrição', params.id);
    requireRole(request, params.editionId, roster.disciplineId);
    const dados = body<{ status?: Roster['status']; teamId?: string }>(request, ['status', 'teamId']);
    Object.assign(roster, dados);
    return rosterView(roster);
  });

  route('DELETE', '/editions/:editionId/rosters/:id', (request, params) => {
    requireEditionAdmin(request, params.editionId);
    store.rosters = store.rosters.filter((item) => item.id !== params.id);
    return undefined;
  }, 204);

  route('GET', '/editions/:editionId/staff-roles', (request, params) => {
    requireEditionAdmin(request, params.editionId);
    return { data: store.staffRoles.filter((role) => role.editionId === params.editionId).map(staffRoleView) };
  });

  route('POST', '/editions/:editionId/staff-roles', (request, params) => {
    requireEditionAdmin(request, params.editionId);
    const dados = body<{ staffId: string; disciplineId?: string | null; role: StaffRole['role'] }>(request, ['staffId', 'disciplineId', 'role'], ['staffId', 'role']);
    found(store.staff.find((item) => item.id === dados.staffId), 'Staff', dados.staffId);
    const role: StaffRole = { id: newId('role'), editionId: params.editionId, staffId: dados.staffId, disciplineId: dados.disciplineId ?? null, role: dados.role };
    store.staffRoles.push(role);
    return staffRoleView(role);
  }, 201);

  route('DELETE', '/editions/:editionId/staff-roles/:id', (request, params) => {
    requireEditionAdmin(request, params.editionId);
    store.staffRoles = store.staffRoles.filter((item) => item.id !== params.id);
    return undefined;
  }, 204);

  route('GET', '/editions/:editionId/tournaments', (request, params) => {
    const status = request.query.get('status');
    const disciplina = request.query.get('disciplineId');
    return { data: store.tournaments.filter((item) => item.editionId === params.editionId && (!status || item.status === status) && (!disciplina || item.disciplineId === disciplina)).map((item) => ({ id: item.id, editionId: item.editionId, disciplineId: item.disciplineId, name: item.name, format: item.format, status: item.status })) };
  });

  route('POST', '/editions/:editionId/tournaments', (request, params) => {
    const dados = body<{ disciplineId: string; name: string; format: string }>(request, ['disciplineId', 'name', 'format'], ['disciplineId', 'name', 'format']);
    requireRole(request, params.editionId, dados.disciplineId);
    unique(store.tournaments.some((item) => item.editionId === params.editionId && item.disciplineId === dados.disciplineId && item.name === dados.name), 'name');
    const tournament: Tournament = { id: newId('tournament'), editionId: params.editionId, disciplineId: dados.disciplineId, name: dados.name, format: dados.format, status: 'DRAFT' };
    store.tournaments.push(tournament);
    return tournament;
  }, 201);

  route('GET', '/tournaments/:id', (_request, params) => found(store.tournaments.find((item) => item.id === params.id), 'Torneio', params.id));

  route('PATCH', '/tournaments/:id', (request, params) => {
    const tournament = found(store.tournaments.find((item) => item.id === params.id), 'Torneio', params.id);
    requireRole(request, tournament.editionId, tournament.disciplineId);
    Object.assign(tournament, body<{ name?: string; format?: string }>(request, ['name', 'format']));
    return tournament;
  });

  const transicoes: Record<Tournament['status'], Tournament['status'][]> = {
    DRAFT: ['SCHEDULED', 'CANCELLED'],
    SCHEDULED: ['DRAFT', 'ONGOING', 'CANCELLED'],
    ONGOING: ['FINISHED', 'CANCELLED'],
    FINISHED: [],
    CANCELLED: [],
  };

  route('PATCH', '/tournaments/:id/status', (request, params) => {
    const tournament = found(store.tournaments.find((item) => item.id === params.id), 'Torneio', params.id);
    requireRole(request, tournament.editionId, tournament.disciplineId);
    const { status } = body<{ status: Tournament['status'] }>(request, ['status'], ['status']);
    if (!transicoes[tournament.status].includes(status)) throw new HttpError(400, 'VALIDATION_ERROR', `Transição de ${tournament.status} para ${status} não é permitida.`);
    tournament.status = status;
    return tournament;
  });

  route('GET', '/tournaments/:tournamentId/entries', (_request, params) => ({ data: store.entries.filter((item) => item.tournamentId === params.tournamentId).map(entryView) }));

  route('POST', '/tournaments/:tournamentId/entries', (request, params) => {
    const tournament = found(store.tournaments.find((item) => item.id === params.tournamentId), 'Torneio', params.tournamentId);
    requireRole(request, tournament.editionId, tournament.disciplineId);
    const dados = body<{ teamId?: string | null; athleteId?: string | null; seed?: number }>(request, ['teamId', 'athleteId', 'seed']);
    if (Boolean(dados.teamId) === Boolean(dados.athleteId)) throw new HttpError(400, 'VALIDATION_ERROR', 'A inscrição precisa ter exatamente uma equipe ou um atleta.');
    unique(store.entries.some((item) => item.tournamentId === params.tournamentId && ((dados.teamId && item.teamId === dados.teamId) || (dados.athleteId && item.athleteId === dados.athleteId))), dados.teamId ? 'teamId' : 'athleteId');
    const entry: Entry = { id: newId('entry'), tournamentId: params.tournamentId, teamId: dados.teamId ?? null, athleteId: dados.athleteId ?? null, seed: dados.seed ?? null, createdAt: new Date().toISOString() };
    store.entries.push(entry);
    return entryView(entry);
  }, 201);

  route('DELETE', '/tournaments/:tournamentId/entries/:id', (request, params) => {
    const tournament = found(store.tournaments.find((item) => item.id === params.tournamentId), 'Torneio', params.tournamentId);
    requireRole(request, tournament.editionId, tournament.disciplineId);
    store.entries = store.entries.filter((item) => item.id !== params.id);
    return undefined;
  }, 204);

  route('GET', '/tournaments/:tournamentId/phases', (_request, params) => ({ data: store.phases.filter((item) => item.tournamentId === params.tournamentId).sort((left, right) => left.order - right.order) }));

  route('POST', '/tournaments/:tournamentId/phases', (request, params) => {
    const tournament = found(store.tournaments.find((item) => item.id === params.tournamentId), 'Torneio', params.tournamentId);
    requireRole(request, tournament.editionId, tournament.disciplineId);
    const dados = body<{ order: number; name: string; type: Phase['type']; config?: Record<string, unknown> }>(request, ['order', 'name', 'type', 'config'], ['order', 'name', 'type']);
    if (!dados.config) throw new HttpError(400, 'VALIDATION_ERROR', 'Configuração da fase é obrigatória.');
    unique(store.phases.some((item) => item.tournamentId === params.tournamentId && item.order === dados.order), 'order');
    const phase: Phase = { id: newId('phase'), tournamentId: params.tournamentId, order: dados.order, name: dados.name, type: dados.type, config: dados.config, createdAt: new Date().toISOString() };
    store.phases.push(phase);
    return phase;
  }, 201);

  route('POST', '/phases/:phaseId/groups', (request, params) => {
    const phase = found(store.phases.find((item) => item.id === params.phaseId), 'Fase', params.phaseId);
    const tournament = found(store.tournaments.find((item) => item.id === phase.tournamentId), 'Torneio', phase.tournamentId);
    requireRole(request, tournament.editionId, tournament.disciplineId);
    const { name } = body<{ name: string }>(request, ['name'], ['name']);
    const group: Group = { id: newId('group'), phaseId: params.phaseId, name, createdAt: new Date().toISOString() };
    store.groups.push(group);
    return group;
  }, 201);

  route('POST', '/groups/:groupId/entries', (request, params) => {
    found(store.groups.find((item) => item.id === params.groupId), 'Grupo', params.groupId);
    const { entryId } = body<{ entryId: string }>(request, ['entryId'], ['entryId']);
    const item: GroupEntry = { id: newId('ge'), groupId: params.groupId, entryId };
    store.groupEntries.push(item);
    return item;
  }, 201);

  route('DELETE', '/groups/:groupId/entries/:entryId', (_request, params) => {
    store.groupEntries = store.groupEntries.filter((item) => item.id !== params.entryId);
    return undefined;
  }, 204);

  route('GET', '/phases/:phaseId/matches', (request, params) => {
    const status = request.query.get('status');
    const round = request.query.get('round');
    return {
      data: store.matches
        .filter((match) => match.phaseId === params.phaseId && (!status || match.status === status) && (!round || match.round === Number(round)))
        .sort((left, right) => (left.round ?? 0) - (right.round ?? 0) || (left.bracketSlot ?? 0) - (right.bracketSlot ?? 0))
        .map(matchView),
    };
  });

  route('POST', '/phases/:phaseId/matches', (request, params) => {
    const phase = found(store.phases.find((item) => item.id === params.phaseId), 'Fase', params.phaseId);
    const tournament = found(store.tournaments.find((item) => item.id === phase.tournamentId), 'Torneio', phase.tournamentId);
    requireRole(request, tournament.editionId, tournament.disciplineId);
    const dados = body<{ groupId?: string | null; round?: number | null; bracketSlot?: number | null; entryAId?: string | null; entryBId?: string | null; scheduledAt?: string | null; venue?: string | null }>(request, ['groupId', 'round', 'bracketSlot', 'entryAId', 'entryBId', 'scheduledAt', 'venue']);
    const match: Match = {
      id: newId('match'),
      phaseId: params.phaseId,
      groupId: dados.groupId ?? null,
      round: dados.round ?? null,
      bracketSlot: dados.bracketSlot ?? null,
      entryAId: dados.entryAId ?? null,
      entryBId: dados.entryBId ?? null,
      winnerEntryId: null,
      scoreA: 0,
      scoreB: 0,
      status: 'SCHEDULED',
      scheduledAt: dados.scheduledAt ?? null,
      venue: dados.venue ?? null,
      lastEventSequence: 0,
    };
    store.matches.push(match);
    return matchView(match);
  }, 201);

  route('GET', '/matches/:id', (_request, params) => matchView(found(store.matches.find((item) => item.id === params.id), 'Partida', params.id)));

  route('PATCH', '/matches/:id', (request, params) => {
    const match = found(store.matches.find((item) => item.id === params.id), 'Partida', params.id);
    requireMatchRole(request, match);
    // O DTO é `PartialType(CreateMatchDto)`: placar e vencedor não estão nele,
    // e mandá-los aqui é 400 — é a recusa que o adaptador precisa enfrentar.
    const dados = body<Partial<Match>>(request, ['groupId', 'round', 'bracketSlot', 'entryAId', 'entryBId', 'scheduledAt', 'venue']);
    Object.assign(match, dados);
    return matchView(match);
  });

  route('PATCH', '/matches/:id/status', (request, params) => {
    const match = found(store.matches.find((item) => item.id === params.id), 'Partida', params.id);
    requireMatchRole(request, match);
    const { status } = body<{ status: Match['status'] }>(request, ['status'], ['status']);
    if (!Object.values(matchStatus).includes(status)) throw new HttpError(400, 'VALIDATION_ERROR', 'Erro de validação nos campos enviados.', [{ field: 'status', issue: 'status inválido' }]);
    const antes = match.status;
    match.status = status;
    // O vencedor é decidido uma vez, na virada para FINISHED, e nunca revisto.
    if (status === 'FINISHED') match.winnerEntryId = match.scoreA === match.scoreB ? null : (match.scoreA > match.scoreB ? match.entryAId : match.entryBId);
    // Só a virada dispara o recálculo, e só ela: encerrar de novo uma partida
    // já encerrada não emite evento na API, e sair de FINISHED também não —
    // a classificação continua contando uma partida que a tela não mostra mais.
    if (status === 'FINISHED' && antes !== 'FINISHED') recomputar(match.phaseId);
    return matchView(match);
  });

  route('GET', '/matches/:matchId/events', (_request, params) => ({ data: store.events.filter((item) => item.matchId === params.matchId).sort((left, right) => left.sequence - right.sequence) }));

  route('POST', '/matches/:matchId/events', (request, params) => {
    const match = found(store.matches.find((item) => item.id === params.matchId), 'Partida', params.matchId);
    requireMatchRole(request, match);
    const dados = body<{ entryId?: string; athleteId?: string; type: string; metadata?: Record<string, unknown> }>(request, ['entryId', 'athleteId', 'type', 'metadata'], ['type']);
    if (dados.entryId && dados.entryId !== match.entryAId && dados.entryId !== match.entryBId) throw new HttpError(400, 'VALIDATION_ERROR', 'A inscrição informada não faz parte desta partida.');
    sequence += 1;
    match.lastEventSequence += 1;
    const event: MatchEvent = { id: newId('event'), matchId: match.id, entryId: dados.entryId ?? null, athleteId: dados.athleteId ?? null, type: dados.type, sequence: match.lastEventSequence, metadata: dados.metadata ?? null, occurredAt: new Date().toISOString() };
    store.events.push(event);
    recount(match);
    publish(match, event);
    return event;
  }, 201);

  route('DELETE', '/matches/:matchId/events/:id', (request, params) => {
    const match = found(store.matches.find((item) => item.id === params.matchId), 'Partida', params.matchId);
    requireMatchRole(request, match);
    store.events = store.events.filter((item) => item.id !== params.id);
    const restantes = store.events.filter((item) => item.matchId === match.id);
    match.lastEventSequence = restantes.reduce((maior, item) => Math.max(maior, item.sequence), 0);
    recount(match);
    // Nada é publicado: quem está no stream não fica sabendo da remoção. É o
    // comportamento da API, e o front precisa conviver com ele.
    return undefined;
  }, 204);

  route('GET', '/phases/:phaseId/standings', (_request, params) => {
    // A resposta é montada antes de liberar: a leitura que consome o atraso
    // ainda recebe a tabela velha, como quem chega no meio do recálculo.
    const resposta = { data: standingsOf(params.phaseId) };
    liberar(params.phaseId);
    return resposta;
  });

  route('GET', '/tournaments/:id/bracket', (_request, params) => bracketOf(params.id));

  route('GET', '/editions/:editionId/live', (_request, params) => ({
    data: store.matches.filter((match) => match.status === 'LIVE' && edicaoDaPartida(match) === params.editionId).map((match) => ({
      matchId: match.id,
      tournamentName: torneioDaPartida(match)?.name ?? '',
      disciplineName: disciplineName(torneioDaPartida(match)?.disciplineId ?? ''),
      entryA: entryName(match.entryAId),
      entryB: entryName(match.entryBId),
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      venue: match.venue,
    })),
  }));

  route('GET', '/editions/:editionId/schedule', (request, params) => {
    const date = request.query.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'VALIDATION_ERROR', 'O parâmetro "date" no formato YYYY-MM-DD é obrigatório.');
    // A janela é fixada em UTC, como na API: para o fuso do Brasil a agenda do
    // dia sai deslocada, e é assim que o front vai encontrá-la.
    const inicio = Date.parse(`${date}T00:00:00.000Z`);
    const fim = Date.parse(`${date}T23:59:59.999Z`);
    return {
      data: store.matches.filter((match) => edicaoDaPartida(match) === params.editionId && match.scheduledAt && Date.parse(match.scheduledAt) >= inicio && Date.parse(match.scheduledAt) <= fim).map((match) => ({
        matchId: match.id,
        tournamentName: torneioDaPartida(match)?.name ?? '',
        disciplineName: disciplineName(torneioDaPartida(match)?.disciplineId ?? ''),
        entryA: entryName(match.entryAId),
        entryB: entryName(match.entryBId),
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        venue: match.venue,
        status: match.status,
        scheduledAt: match.scheduledAt,
      })),
    };
  });

  // ----------------------------------------------------- ganchos de cenário

  /** Devolve a edição ao estado semeado. É também o probe de saúde do mock. */
  route('GET', '/test/reset', () => { resetar(); return undefined; }, 204);
  route('POST', '/test/reset', () => { resetar(); return undefined; }, 204);

  /**
   * Vence o acesso sem derrubar a renovação: é o que o app precisa atravessar
   * sozinho, sem devolver ao login.
   */
  route('POST', '/test/expire-access', () => { sessions.clear(); return undefined; }, 204);

  /**
   * Arma uma falha numa rota. Corpo vazio desarma.
   *
   * Deixou de ser por nome de ação porque nome de ação não existe mais no fio:
   * o que o operador encontra na API que ainda não tem a operação é a rota
   * respondendo — 501, 404, o que for —, e é isso que o cenário arma.
   */
  /**
   * Segura o efeito do recálculo por N leituras da classificação.
   *
   * É a corrida que o cenário precisa reproduzir: na API o recálculo roda fora
   * da requisição que o disparou, então o `PATCH .../status` responde antes de
   * a tabela ser reescrita e quem reler no ato relê a tabela velha. Sem este
   * gancho o mock responde certo na primeira leitura e o cenário passa sem
   * provar nada. Corpo vazio desarma.
   */
  route('POST', '/test/standings-lag', (request) => {
    standingsLag = Number((request.body as { reads?: number }).reads ?? 0);
    deferred.clear();
    return undefined;
  }, 204);

  route('POST', '/test/unimplemented-action', (request) => {
    const dados = request.body as { method?: string; path?: string; status?: number; message?: string };
    armed = dados.path ? { method: (dados.method ?? 'POST').toUpperCase(), path: dados.path, status: dados.status ?? 501, message: dados.message ?? 'Operação ainda não implementada nesta API.' } : null;
    return undefined;
  }, 204);

  function resetar() {
    store = seed();
    sessions = new Map();
    refreshes = new Map();
    armed = null;
    sequence = 0;
    standingsLag = 0;
    deferred.clear();
  }

  // ------------------------------------------------------------- auxiliares

  function comSearch<T extends { name: string }>(items: T[], request: MockRequest) {
    const search = request.query.get('search');
    return search ? items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())) : items;
  }

  function torneioDaPartida(match: Match) {
    const phase = store.phases.find((item) => item.id === match.phaseId);
    return store.tournaments.find((item) => item.id === phase?.tournamentId);
  }

  function edicaoDaPartida(match: Match) {
    return torneioDaPartida(match)?.editionId;
  }

  function requireMatchRole(request: MockRequest, match: Match) {
    const tournament = torneioDaPartida(match);
    if (!tournament) throw new HttpError(404, 'NOT_FOUND', `Partida com ID "${match.id}" não encontrada.`);
    return requireRole(request, tournament.editionId, tournament.disciplineId);
  }

  /**
   * O placar é recalculado do zero a cada evento, como no servidor: aqui a
   * estratégia é única e conta GOAL e POINT. A API indexa a estratégia pelo
   * slug da modalidade, e slug fora do mapa dela soma zero em silêncio.
   */
  function recount(match: Match) {
    const eventos = store.events.filter((item) => item.matchId === match.id);
    match.scoreA = 0;
    match.scoreB = 0;
    for (const event of eventos) {
      const pontos = event.type === 'GOAL' ? 1 : event.type === 'POINT' ? Number((event.metadata as { points?: number } | null)?.points ?? 1) : 0;
      if (event.entryId === match.entryAId) match.scoreA += pontos;
      if (event.entryId === match.entryBId) match.scoreB += pontos;
    }
  }

  function publish(match: Match, event: MatchEvent) {
    const data = JSON.stringify({ eventId: event.id, type: event.type, sequence: event.sequence, entryId: event.entryId ?? '', athleteId: event.athleteId ?? '', metadata: event.metadata ?? '', scoreA: match.scoreA, scoreB: match.scoreB });
    for (const listener of listeners) {
      if (listener.matchId !== match.id) continue;
      listener.send(`id: ${sequence}-0\nevent: match-event\ndata: ${data}\n\n`);
    }
  }

  function match(route: Route, request: MockRequest) {
    const parts = request.path.split('/').filter(Boolean);
    if (route.method !== request.method || route.segments.length !== parts.length) return null;
    const params: Record<string, string> = {};
    for (let position = 0; position < parts.length; position += 1) {
      const segment = route.segments[position];
      if (segment.startsWith(':')) params[segment.slice(1)] = decodeURIComponent(parts[position]);
      else if (segment !== parts[position]) return null;
    }
    return params;
  }

  return {
    listeners,
    reset: resetar,
    handle(request) {
      if (armed && armed.method === request.method && request.path.startsWith(armed.path)) {
        return { status: armed.status, body: { error: { code: 'NOT_IMPLEMENTED', message: armed.message } } };
      }
      for (const route of routes) {
        const params = match(route, request);
        if (!params) continue;
        try {
          const payload = route.handle(request, params);
          if (route.status === 204) return { status: 204 };
          // O interceptor: `{ items, meta }` vira `{ data, meta }`, quem já tem
          // `data` passa direto, e o resto é embrulhado.
          if (payload && typeof payload === 'object' && 'items' in payload && 'meta' in payload) {
            return { status: route.status, body: { data: (payload as { items: unknown }).items, meta: (payload as { meta: unknown }).meta } };
          }
          if (payload && typeof payload === 'object' && 'data' in payload) return { status: route.status, body: payload };
          return { status: route.status, body: { data: payload ?? null } };
        } catch (caught) {
          if (caught instanceof HttpError) return { status: caught.status, body: { error: { code: caught.code, message: caught.message, ...(caught.details ? { details: caught.details } : {}) } } };
          throw caught;
        }
      }
      return { status: 404, body: { error: { code: 'NOT_FOUND', message: `Cannot ${request.method} ${request.path}` } } };
    },
  };
}

/**
 * O roteador embrulhado num `fetch`, para quem testa sem subir servidor.
 *
 * É o mesmo código que os e2e exercitam pelo `node:http` — um mock só, com uma
 * verdade só sobre o que a API responde.
 */
export function createMockFetch(api = createMockApi()) {
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input), 'http://mock.local');
    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization') ?? '';
    const response = api.handle({
      method: (init?.method ?? 'GET').toUpperCase(),
      path: url.pathname.replace(/^\/api(\/v1)?/, ''),
      query: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {},
      token: authorization.startsWith('Bearer ') ? authorization.slice(7) : null,
    });
    if (response.status === 204) return new Response(null, { status: 204 });
    return Response.json(response.body, { status: response.status });
  };
  return { api, fetchImpl };
}
