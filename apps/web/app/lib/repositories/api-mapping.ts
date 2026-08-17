import { initialFrontendState, type AthleteState, type CompetitionState, type EditionState, type FrontendState, type MatchState, type StaffState, type TeamState, type TournamentPhase, type TournamentState } from '@atletica-incinera/intereng-contract/state';
import { matchStatus, resolveMatchDate, toDateKey, tournamentStatus, type EditionStatus, type OfficialStandings, type StaffRoleLabel, type Standing } from '@atletica-incinera/intereng-contract/rules';

/**
 * A tradução entre a API REST e o estado da edição.
 *
 * Fica separada do transporte de propósito: aqui não há `fetch`, token nem
 * ordem de chamada — só o que cada campo do servidor vira na tela e o que cada
 * campo da tela vira no servidor. É a metade do adaptador onde o defeito
 * costuma morar, e a única que dá para provar sem subir servidor.
 *
 * A API é granular: nenhuma rota devolve a edição inteira. O que era um
 * snapshot passa a ser uma remontagem em memória, e o que o snapshot garantia
 * de graça — coerência entre as coleções — passa a depender dela.
 */

// ---------------------------------------------------------------------------
// Os corpos da API, como o inventário os descreve.
// ---------------------------------------------------------------------------

/**
 * O único vocabulário que não tem duas metades: o contrato já guarda o enum da
 * API. O alias fica para as assinaturas continuarem dizendo de que lado do fio
 * o valor veio, e para o dia em que a API divergir doer no compilador aqui.
 */
export type ApiEditionStatus = EditionStatus;
export type ApiTournamentStatus = 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'FINISHED' | 'CANCELLED';
export type ApiMatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'WALKOVER' | 'CANCELLED' | 'POSTPONED';
export type ApiTournamentFormat = 'SINGLE_ELIMINATION' | 'GROUP_KNOCKOUT' | 'LEAGUE_KNOCKOUT' | 'LEAGUE_ONLY' | 'LEAGUE_LIMITED_KNOCKOUT';
export type ApiPhaseType = 'GROUP' | 'LEAGUE' | 'KNOCKOUT';
export type ApiRosterStatus = 'ACTIVE' | 'INJURED' | 'SUSPENDED' | 'WITHDRAWN';
export type ApiStaffRoleName = 'EDITION_ADMIN' | 'DISCIPLINE_MANAGER';

export type ApiCompetition = { id: string; name: string; slug: string };
export type ApiEdition = { id: string; competitionId: string; year: number; name: string; startDate: string; endDate: string; status: ApiEditionStatus };
export type ApiDiscipline = { id: string; name: string; slug: string; isIndividual: boolean; description?: string | null };
export type ApiEditionDiscipline = { id: string; disciplineId: string; disciplineName: string; isIndividual: boolean; config?: Record<string, unknown> | null };
export type ApiTeam = { id: string; name: string; slug: string };
export type ApiAthlete = { id: string; name: string; document?: string; birthDate?: string | null; email?: string | null };
export type ApiRoster = { id: string; editionId: string; disciplineId: string; disciplineName: string; teamId: string | null; teamName: string | null; jerseyNumber: number | null; status: ApiRosterStatus; athlete: { id: string; name: string } };
export type ApiTournament = { id: string; editionId: string; disciplineId: string; name: string; format: ApiTournamentFormat; status: ApiTournamentStatus };
export type ApiEntry = { id: string; tournamentId: string; teamId: string | null; teamName: string | null; athleteId: string | null; athleteName: string | null; seed: number | null };
export type ApiPhase = { id: string; tournamentId: string; order: number; name: string; type: ApiPhaseType; config?: { advanceCount?: number; tiebreakers?: string[] } | null };
export type ApiMatch = { id: string; phaseId: string; groupId: string | null; round: number | null; bracketSlot: number | null; entryA: { id: string; name: string } | null; entryB: { id: string; name: string } | null; winnerEntryId: string | null; scoreA: number; scoreB: number; status: ApiMatchStatus; scheduledAt: string | null; venue: string | null; lastEventSequence: number };
export type ApiStaffRole = { id: string; editionId: string; staffId: string; staffName: string; staffEmail: string; disciplineId: string | null; disciplineName: string | null; role: ApiStaffRoleName };
export type ApiEditionRole = { editionId: string; editionName: string; disciplineId: string | null; disciplineName: string | null; role: ApiStaffRoleName };
export type ApiMe = { id: string; name: string; email: string; isSuperAdmin: boolean; editionRoles: ApiEditionRole[] };
/**
 * Uma linha de `GET /phases/:phaseId/standings`, na ordem em que o servidor a
 * devolveu. O `rank` reinicia a cada grupo e pode repetir entre eles, e vem
 * nulo enquanto o recálculo não gravou a fase.
 */
export type ApiStanding = { entryId: string; entryName: string; played: number; won: number; drawn: number; lost: number; scoreFor: number; scoreAgainst: number; points: number; rank: number | null };
/** Grupos e a associação grupo-classificação só existem nesta rota. */
export type ApiBracket = { format: ApiTournamentFormat; phases: Array<{ phaseId: string; name: string; type: ApiPhaseType; groups?: Array<{ name: string; standings: Array<{ entryId: string; entryName: string }> }> }> };

/** Tudo o que a API devolve sobre um torneio, já reunido. */
export type TournamentBundle = { tournament: ApiTournament; entries: ApiEntry[]; phases: ApiPhase[]; bracket: ApiBracket | null; matches: ApiMatch[]; standings: Record<string, ApiStanding[]> };

/** O material bruto de uma edição, na ordem em que o adaptador o coleta. */
export type EditionPayload = {
  competitions: ApiCompetition[];
  editions: ApiEdition[];
  activeEditionId: string;
  editionDisciplines: ApiEditionDiscipline[];
  teams: ApiTeam[];
  athletes: ApiAthlete[];
  rosters: ApiRoster[];
  tournaments: TournamentBundle[];
  staffRoles: ApiStaffRole[];
};

/**
 * O que a remontagem descobriu e o estado não guarda.
 *
 * O estado do front é indexado por nome de modalidade e guarda participante e
 * adversário por **nome**; a API só aceita id — de `EditionDiscipline`, de
 * `TournamentEntry`, de `Phase`. Sem este índice, toda escrita precisaria
 * reler a edição inteira só para descobrir para onde ir.
 */
export type ApiIndex = {
  editionId: string;
  competitionId: string;
  /** Nome da modalidade para os ids que as rotas de escrita exigem. */
  disciplines: Record<string, { disciplineId: string; editionDisciplineId: string; isIndividual: boolean }>;
  /** Nome do time/atleta inscrito para o id da inscrição, por torneio. */
  entryByName: Record<string, Record<string, string>>;
  /** Participante (time ou atleta) para o id da inscrição, por torneio. */
  /** Fases de cada torneio, para achar onde uma partida nova nasce. */
  phases: Record<string, ApiPhase[]>;
  /** Partida para a fase dela, que as rotas de criação exigem no caminho. */
  matchPhase: Record<string, string>;
  /** Atleta para as inscrições dele na edição, para editar elenco sem reler. */
  rostersByAthlete: Record<string, ApiRoster[]>;
  /** Equipe para o slug, que a API exige e o estado do front não guarda. */
  teamSlugs: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Vocabulários. Cada tabela é bijetora onde dá, e o comentário diz onde não é.
// ---------------------------------------------------------------------------

/**
 * `CANCELLED` cai em `Arquivado` porque o front não tem "cancelada" para
 * categoria. A volta grava `CANCELLED`, então arquivar no app cancela no
 * servidor — e as duas situações deixam de ser distinguíveis na releitura.
 */
const tournamentStatusLabels: Record<ApiTournamentStatus, TournamentState['status']> = {
  DRAFT: tournamentStatus.draft,
  SCHEDULED: tournamentStatus.published,
  ONGOING: tournamentStatus.running,
  FINISHED: tournamentStatus.closed,
  CANCELLED: tournamentStatus.archived,
};

const tournamentStatusCodes: Record<TournamentState['status'], ApiTournamentStatus> = {
  'Rascunho': 'DRAFT',
  'Publicado': 'SCHEDULED',
  'Em andamento': 'ONGOING',
  'Encerrado': 'FINISHED',
  'Arquivado': 'CANCELLED',
};

const matchStatusLabels: Record<ApiMatchStatus, NonNullable<MatchState['status']>> = {
  SCHEDULED: matchStatus.scheduled,
  LIVE: matchStatus.live,
  FINISHED: matchStatus.finished,
  WALKOVER: matchStatus.walkover,
  CANCELLED: matchStatus.cancelled,
  POSTPONED: matchStatus.postponed,
};

const matchStatusCodes: Record<NonNullable<MatchState['status']>, ApiMatchStatus> = {
  'Agendada': 'SCHEDULED',
  'Ao vivo': 'LIVE',
  'Encerrada': 'FINISHED',
  'W.O.': 'WALKOVER',
  'Cancelada': 'CANCELLED',
  'Adiada': 'POSTPONED',
};

const phaseFormats: Record<ApiPhaseType, TournamentPhase['format']> = { GROUP: 'Grupos', LEAGUE: 'Liga', KNOCKOUT: 'Mata-mata' };
const phaseTypes: Record<TournamentPhase['format'], ApiPhaseType> = { 'Grupos': 'GROUP', 'Liga': 'LEAGUE', 'Mata-mata': 'KNOCKOUT' };

const formatLabels: Record<ApiTournamentFormat, string> = {
  SINGLE_ELIMINATION: 'Mata-mata',
  GROUP_KNOCKOUT: 'Grupos + mata-mata',
  LEAGUE_KNOCKOUT: 'Liga + mata-mata',
  LEAGUE_ONLY: 'Liga',
  LEAGUE_LIMITED_KNOCKOUT: 'Liga + mata-mata reduzido',
};

const staffRoleLabelsByCode: Record<ApiStaffRoleName, StaffRoleLabel> = {
  EDITION_ADMIN: 'Admin da edição',
  DISCIPLINE_MANAGER: 'Gestor de modalidade',
};

const tones = ['blue', 'pink', 'orange'] as const;

export function toTournamentStatus(status: TournamentState['status']) { return tournamentStatusCodes[status]; }
export function toMatchStatus(status: NonNullable<MatchState['status']>) { return matchStatusCodes[status]; }
export function toPhaseType(format: TournamentPhase['format']) { return phaseTypes[format]; }
export function fromMatchStatus(status: ApiMatchStatus) { return matchStatusLabels[status]; }

/**
 * O tom do card não existe na API. Derivar da posição mantém a cor estável
 * entre duas leituras, em vez de a tela piscar de cor a cada remontagem.
 */
function toneAt(index: number) { return tones[index % tones.length]; }

/** A sigla não existe na API. Vem do nome, como a tela sempre a exibiu. */
export function initialsFrom(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 3).map((word) => word[0]).join('').toUpperCase();
  return (words[0] ?? '').slice(0, 3).toUpperCase();
}

/** O `slug` que a API exige nos cadastros e o estado do front não guarda. */
export function slugFrom(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sem-nome';
}

// ---------------------------------------------------------------------------
// Data e hora: a conversão que atravessa toda escrita de partida.
// ---------------------------------------------------------------------------

/**
 * `date` + `time` do front para o `scheduledAt` do servidor, **no fuso do
 * aparelho**.
 *
 * A escolha é deliberada. A API grava `Timestamptz`, um instante absoluto; o
 * front guarda o que o operador digitou, e "20:00" é vinte horas no ginásio,
 * não em UTC. Interpretar `2026-10-12T20:00` como UTC gravaria 17:00 locais no
 * Brasil, e ler de volta com os getters de UTC faria o inverso: um jogo às
 * 20:00 apareceria às 23:00 na tela — defeito que só aparece no dia do jogo.
 *
 * Como operador, ginásio e navegador estão no mesmo fuso, o construtor local e
 * os getters locais são o par correto, e é por isso que a leitura usa
 * `getHours` e nunca `getUTCHours`. O preço fica registrado: quem abrir o app
 * em outro fuso vê o horário convertido para o dele, e a rota pública
 * `GET /editions/:id/schedule` recorta o dia em UTC — a agenda dela sai
 * deslocada em relação a esta conversão.
 */
export function toScheduledAt(date?: string, time?: string): string | null {
  if (!date || !time) return null;
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const [year, month, day] = resolveMatchDate(date).split('-').map(Number);
  const at = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export function fromScheduledAt(scheduledAt: string | null | undefined): { date?: string; time?: string } {
  if (!scheduledAt) return {};
  const at = new Date(scheduledAt);
  if (Number.isNaN(at.getTime())) return {};
  return { date: toDateKey(at), time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` };
}

// ---------------------------------------------------------------------------
// A remontagem.
// ---------------------------------------------------------------------------

/**
 * O estado da edição, remontado das rotas granulares.
 *
 * Recusa em voz alta quando a edição pedida não veio. Era o papel do antigo
 * `normalizeSnapshot` e continua necessário aqui: um estado remontado sem
 * edição sai plausível — a competição, as coleções vazias, nenhum erro — e a
 * tela diria "pronto" sem ter carregado nada.
 */
export function remountEdition(payload: EditionPayload): { state: FrontendState; index: ApiIndex } {
  const edition = payload.editions.find((item) => item.id === payload.activeEditionId);
  if (!edition) throw new Error('O servidor não devolveu a edição pedida.');

  const competitions: CompetitionState[] = payload.competitions.map((item) => ({ id: item.id, name: item.name, slug: item.slug, active: item.id === edition.competitionId }));
  const editions: EditionState[] = payload.editions.map((item) => ({
    id: item.id,
    name: item.name,
    year: item.year,
    start: item.startDate.slice(0, 10),
    end: item.endDate.slice(0, 10),
    status: item.status,
    active: item.id === edition.id,
    competitionId: item.competitionId,
  }));

  const { teams, teamSlugs } = remountTeams(payload);
  const { tournaments, matches, index } = remountTournaments(payload, edition.id);

  return {
    state: {
      ...initialFrontendState,
      competitions,
      editions,
      teams,
      athletes: remountAthletes(payload),
      disciplines: remountDisciplines(payload),
      tournaments,
      matches,
      // A API não tem ranking geral nem auditoria: nenhuma tabela, nenhuma
      // rota. As métricas seguem sendo as do contrato e os lançamentos ficam
      // vazios — inventá-los aqui seria exibir premiação que ninguém gravou.
      overallRanking: { ...initialFrontendState.overallRanking, awards: [], closures: [] },
      staff: remountStaff(payload),
      audit: [],
    },
    index: {
      editionId: edition.id,
      competitionId: edition.competitionId,
      disciplines: Object.fromEntries(payload.editionDisciplines.map((item) => [item.disciplineName, { disciplineId: item.disciplineId, editionDisciplineId: item.id, isIndividual: item.isIndividual }])),
      rostersByAthlete: groupRosters(payload.rosters),
      teamSlugs,
      ...index,
    },
  };
}

/**
 * As equipes vêm do catálogo global, que exige sessão.
 *
 * O espectador não tem acesso a `GET /teams`, mas vê nome de equipe no elenco
 * e nas inscrições. Completar por ali mantém a tela pública com a equipe
 * nomeada; o registro fica sem slug, e escrever sobre ele é recusado depois.
 */
function remountTeams(payload: EditionPayload) {
  const teams: Record<string, TeamState> = {};
  const teamSlugs: Record<string, string> = {};
  payload.teams.forEach((team, position) => {
    teams[team.id] = { name: team.name, initials: initialsFrom(team.name), tone: toneAt(position) };
    teamSlugs[team.id] = team.slug;
  });
  const nomeados = [
    ...payload.rosters.filter((roster) => roster.teamId && roster.teamName).map((roster) => ({ id: roster.teamId as string, name: roster.teamName as string })),
    ...payload.tournaments.flatMap((bundle) => bundle.entries).filter((entry) => entry.teamId && entry.teamName).map((entry) => ({ id: entry.teamId as string, name: entry.teamName as string })),
  ];
  for (const team of nomeados) {
    if (teams[team.id]) continue;
    teams[team.id] = { name: team.name, initials: initialsFrom(team.name), tone: toneAt(Object.keys(teams).length) };
  }
  return { teams, teamSlugs };
}

/**
 * O atleta do front é um registro só, com uma equipe e uma lista de
 * modalidades. Na API ele é uma linha de catálogo mais uma inscrição por
 * modalidade, e nada impede que duas inscrições apontem para equipes
 * diferentes: fica valendo a primeira inscrição ativa com equipe.
 */
function remountAthletes(payload: EditionPayload) {
  const athletes: Record<string, AthleteState> = {};
  for (const athlete of payload.athletes) athletes[athlete.id] = { name: athlete.name, modalities: [] };
  for (const [athleteId, rosters] of Object.entries(groupRosters(payload.rosters))) {
    const ativas = rosters.filter((roster) => roster.status !== 'WITHDRAWN');
    athletes[athleteId] = {
      ...athletes[athleteId],
      name: athletes[athleteId]?.name ?? rosters[0].athlete.name,
      teamId: (ativas[0] ?? rosters[0]).teamId ?? undefined,
      modalities: ativas.map((roster) => roster.disciplineName),
      // Saiu de todas as modalidades: o registro fica para o histórico, como
      // no adaptador local, mas não conta mais no elenco.
      removed: ativas.length === 0 || undefined,
    };
  }
  return athletes;
}

function groupRosters(rosters: ApiRoster[]) {
  const byAthlete: Record<string, ApiRoster[]> = {};
  for (const roster of rosters) byAthlete[roster.athlete.id] = [...(byAthlete[roster.athlete.id] ?? []), roster];
  return byAthlete;
}

/**
 * A modalidade do front é indexada por **nome** e carrega o regulamento
 * (`rules`). A API indexa por id e guarda um `config` cujo formato é validado
 * por slug — nada nele descreve período, cronômetro ou evento. O regulamento
 * fica sem origem: quem o ler cai no padrão do contrato.
 */
function remountDisciplines(payload: EditionPayload) {
  const disciplines: FrontendState['disciplines'] = {};
  payload.editionDisciplines.forEach((item, position) => {
    disciplines[item.disciplineName] = {
      name: item.disciplineName,
      mode: item.isIndividual ? 'Individual' : 'Coletiva',
      enabled: true,
      tone: toneAt(position),
      tournaments: payload.tournaments.filter((bundle) => bundle.tournament.disciplineId === item.disciplineId).length,
      // `config` do front é a linha legível de regulamento que
        // `formatDisciplineRegulation` produz; o `config` da API é o JSON das
        // regras. Mesmo nome, propósitos diferentes — despejar um no outro põe
        // JSON cru na tela. Sem origem, o app cai em `formatDisciplineRule`,
        // que é o comportamento certo.
        config: undefined,
    };
  });
  return disciplines;
}

function remountStaff(payload: EditionPayload) {
  const staff: Record<string, StaffState> = {};
  for (const role of payload.staffRoles) {
    staff[role.staffEmail] = {
      name: role.staffName,
      email: role.staffEmail,
      initials: initialsFrom(role.staffName),
      role: staffRoleLabelsByCode[role.role],
      // O escopo do front é texto livre; na API ele é a modalidade do papel.
      scope: role.disciplineName ?? 'Edição inteira',
    };
  }
  return staff;
}

function remountTournaments(payload: EditionPayload, editionId: string) {
  const tournaments: Record<string, TournamentState> = {};
  const matches: Record<string, MatchState> = {};
  const entryByName: ApiIndex['entryByName'] = {};
  const phases: ApiIndex['phases'] = {};
  const matchPhase: ApiIndex['matchPhase'] = {};
  const disciplineNames = Object.fromEntries(payload.editionDisciplines.map((item) => [item.disciplineId, item.disciplineName]));
  /**
   * O app inteiro identifica participante por **nome**, não por id: as partidas
   * guardam `entryA`/`entryB` como nome, o formulário de agendamento oferece
   * `participants` como opção e despacha o que escolheram, e as telas de
   * categoria, elegibilidade e desempenho comparam com o nome da equipe.
   *
   * Gravar id aqui não dá erro em lugar nenhum — cria a partida com os dois
   * lados em "A definir" e o servidor responde 201.
   */
  const nameOf = (entry: ApiEntry) => entry.teamName ?? entry.athleteName ?? entry.id;

  payload.tournaments.forEach((bundle, position) => {
    const { tournament, entries, bracket } = bundle;
    entryByName[tournament.id] = Object.fromEntries(entries.map((entry) => [nameOf(entry), entry.id]));
    phases[tournament.id] = bundle.phases;

    const groupsOf = (phaseId: string) => bracket?.phases.find((item) => item.phaseId === phaseId)?.groups ?? [];
    const assignments: Record<string, string> = {};
    const unknownAssignments: string[] = [];
    for (const phase of bundle.phases) {
      const groups = groupsOf(phase.id);
      // O chaveamento monta cada grupo filtrando `phase_standings` pelos
      // inscritos dele (`public.mapper.ts`, `toGroupPhaseDto`), e essa tabela
      // só é escrita quando uma partida da fase encerra — é o único gatilho de
      // recálculo. Antes disso o grupo volta sem ninguém, e a alocação que o
      // organizador acabou de montar some da tela.
      //
      // O que separa "não informado" de "vazio" é a fase, não o grupo: o
      // recálculo apaga e reescreve a fase inteira, e todo grupo com inscrito
      // ganha linha na mesma passada. Então nenhuma linha na fase quer dizer
      // que o recálculo nunca rodou ali; alguma linha quer dizer que ele
      // rodou, e aí um grupo sem linha está mesmo vazio. A pergunta é feita ao
      // próprio chaveamento, e não a `/phases/:id/standings`, porque ele tem
      // cache de 60 s: cruzar as duas rotas leria um grupo recém-preenchido
      // como grupo vazio durante um minuto.
      const relatada = groups.some((group) => group.standings.length > 0);
      for (const group of groups) {
        if (!relatada) unknownAssignments.push(group.name);
        for (const standing of group.standings) {
          const inscrito = entries.find((entry) => entry.id === standing.entryId);
          if (inscrito) assignments[nameOf(inscrito)] = group.name;
        }
      }
    }

    tournaments[tournament.id] = {
      editionId,
      name: tournament.name,
      discipline: disciplineNames[tournament.disciplineId],
      format: formatLabels[tournament.format],
      status: tournamentStatusLabels[tournament.status],
      tone: toneAt(position),
      participants: entries.map(nameOf),
      seeds: Object.fromEntries(entries.filter((entry) => entry.seed !== null).map((entry) => [nameOf(entry), entry.seed as number])),
      assignments,
      unknownAssignments: unknownAssignments.length ? unknownAssignments : undefined,
      phases: bundle.phases.map((phase): TournamentPhase => ({
        id: phase.id,
        name: phase.name,
        format: phaseFormats[phase.type],
        groups: groupsOf(phase.id).map((group) => group.name),
        qualifiers: phase.config?.advanceCount ?? 1,
      })),
      // A API não guarda "chave gerada": a existência de partidas é o sinal
      // mais próximo, e é o que impede a tela de oferecer gerar de novo.
      generated: bundle.matches.length > 0,
      standings: remountStandings(bundle, groupsOf),
    };

    for (const match of bundle.matches) {
      const phase = bundle.phases.find((item) => item.id === match.phaseId);
      matchPhase[match.id] = match.phaseId;
      matches[match.id] = {
        editionId,
        tournamentId: tournament.id,
        discipline: disciplineNames[tournament.disciplineId],
        phase: phase?.name ?? tournament.name,
        entryA: match.entryA?.name ?? 'A definir',
        entryB: match.entryB?.name ?? 'A definir',
        venue: match.venue ?? undefined,
        status: matchStatusLabels[match.status],
        ...fromScheduledAt(match.scheduledAt),
        // O servidor não distingue "0×0 porque não começou" de "0×0 no
        // intervalo": o placar nasce zerado e só os eventos o movem. Agendada
        // é a única leitura em que zero não é resultado, e a tela mostra `×`.
        scoreA: match.status === 'SCHEDULED' ? null : match.scoreA,
        scoreB: match.status === 'SCHEDULED' ? null : match.scoreB,
      };
    }
  });

  return { tournaments, matches, index: { entryByName, phases, matchPhase } };
}

/**
 * A classificação oficial da categoria, na chave com que a tela a procura.
 *
 * Duas rotas participam, com papéis separados de propósito. Os números e a
 * **ordem** vêm de `GET /phases/:phaseId/standings`, que é o que o servidor
 * calculou e persistiu. O chaveamento entra só para dizer quem está em qual
 * grupo — é a única rota que sabe isso —, e nada além disso: ele tem cache de
 * 60 s na API, e tirar dali os números faria a tabela envelhecer um minuto
 * inteiro depois de cada partida encerrada.
 *
 * A lista da fase vem plana com os grupos misturados, porque o servidor calcula
 * um grupo de cada vez (`standings.service.ts`, `recomputeStandings`) e depois
 * devolve tudo junto: o `rank` reinicia em cada grupo e se repete entre eles.
 * Filtrar por grupo é o que devolve sentido ao número.
 *
 * Fase sem grupos entra pelo nome dela, que é como a tela chama a aba de uma
 * liga. Fase sem nenhuma linha não entra: tabela vazia não é tabela — quer
 * dizer que o recálculo nunca rodou ali — e quem recebe `undefined` calcula.
 */
function remountStandings(bundle: TournamentBundle, groupsOf: (phaseId: string) => NonNullable<NonNullable<ApiBracket['phases'][number]['groups']>>): OfficialStandings {
  const official: OfficialStandings = {};
  // Sem o chaveamento não dá para saber se a lista plana é a tabela da fase ou
  // três grupos misturados, e um grupo misturado é pior que grupo nenhum: sai
  // uma tabela plausível com posições repetidas e adversários que nunca se
  // enfrentaram. Nesse caso a tela calcula a dela.
  if (!bundle.bracket) return official;
  for (const phase of bundle.phases) {
    const rows = bundle.standings[phase.id] ?? [];
    if (!rows.length) continue;
    const groups = groupsOf(phase.id);
    if (!groups.length) {
      official[phase.name] = toStandings(rows);
      continue;
    }
    for (const group of groups) {
      const membros = new Set(group.standings.map((standing) => standing.entryId));
      const doGrupo = rows.filter((row) => membros.has(row.entryId));
      if (doGrupo.length) official[group.name] = toStandings(doGrupo);
    }
  }
  return official;
}

/**
 * A linha do servidor na linha que a tela desenha, sem inventar o que falta.
 *
 * Saldo é o único número derivado, e é subtração do que veio. Fair play não tem
 * coluna na API, e o critério que separou o empate não volta na resposta:
 * ficam zerado e ausente, então a linha "desempate por ..." simplesmente não
 * aparece em modo `http`. Preenchê-la com o critério que o cliente teria usado
 * seria dar uma justificativa que o servidor não deu — e que pode não ser a
 * dele, porque as duas cadeias são implementações diferentes.
 *
 * O `rank` é o do servidor, inclusive quando ele repete: duas linhas empatadas
 * em todos os critérios recebem lá a mesma posição. Nulo é fase que ainda não
 * foi ranqueada, e aí a posição na lista é o que sobra.
 */
function toStandings(rows: ApiStanding[]): Standing[] {
  return rows.map((row, position) => ({
    rank: row.rank ?? position + 1,
    name: row.entryName,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.scoreFor,
    goalsAgainst: row.scoreAgainst,
    balance: row.scoreFor - row.scoreAgainst,
    points: row.points,
    disciplinary: 0,
  }));
}

// ---------------------------------------------------------------------------
// O quadro que o tempo real empurra.
// ---------------------------------------------------------------------------

/** Objeto, e não lista: um array também é `'object'`, e viraria mapa com índice como chave. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilledList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Que contêiner cada campo do estado é.
 *
 * O `satisfies` é o que faz um campo renomeado no contrato quebrar o typecheck
 * aqui, em vez de sumir da checagem em silêncio.
 */
const objectFields = ['teams', 'athletes', 'disciplines', 'tournaments', 'matches', 'staff', 'overallRanking', 'preferences'] as const satisfies readonly (keyof FrontendState)[];
const listFields = ['competitions', 'editions', 'audit'] as const satisfies readonly (keyof FrontendState)[];

/**
 * Um corpo empurrado pelo canal vira estado de edição, ou é recusado em voz alta.
 *
 * É a metade que `remountEdition` não cobre. O que chega pelo stream não passa
 * por rota nenhuma e não é remontado de nada: vem pronto, e até aqui virava o
 * estado inteiro do app por um `as FrontendState`, que não checa nada em tempo
 * de execução. JSON válido com a forma errada — corpo embrulhado, página de
 * erro de proxy, quadro de outro assunto — não dava erro em lugar nenhum: as
 * coleções saíam vazias e as telas diziam "pronto" sobre uma edição que
 * ninguém carregou.
 *
 * A recusa é a mesma de `remountEdition`, pelo mesmo motivo: sem competição e
 * sem edição não existe o que a tela chame de edição. Depois dela, cada campo
 * presente precisa ser do tipo de contêiner certo — `teams: []` passaria pelo
 * `field in payload` do antigo `normalizeSnapshot` e esvaziaria a tela do
 * mesmo jeito.
 *
 * O que **falta** é completado, e isso é tolerância antiga: o servidor pode
 * omitir coleção vazia, e completar aqui evita `undefined` em 45 telas.
 * Completar tudo é que seria inventar uma edição — por isso `competitions` e
 * `editions` são exigidas em vez de caírem no exemplo de `initialFrontendState`,
 * que traz três edições fictícias.
 *
 * O que não é checado é o conteúdo de cada registro. A fronteira é deliberada:
 * o defeito que este repositório caça é a tela que esvazia sem erro, e ele mora
 * no contêiner, não no campo de uma equipe.
 */
export function toEditionState(payload: unknown): FrontendState {
  if (!isRecord(payload)) throw new Error('O quadro recebido não é o estado da edição.');
  const frame = payload as Partial<FrontendState>;
  if (!isFilledList(frame.competitions) || !isFilledList(frame.editions)) throw new Error('O quadro recebido não traz competição e edição.');
  for (const field of objectFields) {
    if (frame[field] !== undefined && !isRecord(frame[field])) throw new Error(`O quadro recebido tem \`${field}\` fora do formato do estado.`);
  }
  for (const field of listFields) {
    if (frame[field] !== undefined && !Array.isArray(frame[field])) throw new Error(`O quadro recebido tem \`${field}\` fora do formato do estado.`);
  }

  return {
    ...initialFrontendState,
    ...frame,
    teams: frame.teams ?? {},
    athletes: frame.athletes ?? {},
    disciplines: frame.disciplines ?? {},
    tournaments: frame.tournaments ?? {},
    matches: frame.matches ?? {},
    staff: frame.staff ?? {},
    audit: frame.audit ?? [],
    overallRanking: {
      metrics: frame.overallRanking?.metrics ?? initialFrontendState.overallRanking.metrics,
      awards: frame.overallRanking?.awards ?? [],
      closures: frame.overallRanking?.closures ?? [],
    },
    preferences: { ...initialFrontendState.preferences, ...frame.preferences },
  };
}
