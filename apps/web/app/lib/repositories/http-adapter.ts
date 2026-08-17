import type { FrontendState } from '@atletica-incinera/intereng-contract/state';
import type { Action } from '@atletica-incinera/intereng-contract/actions';
import { ApiError, apiRequest } from './api-client.ts';
import { readSessionToken, readStoredSession } from './session-storage.ts';
import { activeScopeOf, UnauthorizedError } from './auth-adapter.ts';
import {
  fromScheduledAt,
  remountEdition,
  slugFrom,
  toMatchStatus,
  toScheduledAt,
  type ApiAthlete,
  type ApiBracket,
  type ApiCompetition,
  type ApiEdition,
  type ApiEditionDiscipline,
  type ApiEntry,
  type ApiIndex,
  type ApiMatch,
  type ApiMe,
  type ApiPhase,
  type ApiRoster,
  type ApiStaffRole,
  type ApiStanding,
  type ApiTeam,
  type ApiTournament,
  type EditionPayload,
  type TournamentBundle,
} from './api-mapping.ts';
import type { ConnectionState, StateAdapter } from './state-adapter.ts';

/**
 * Estado vindo da API REST.
 *
 * A API não tem snapshot da edição nem despachante de ações: é um controller
 * por recurso. `StateAdapter` continua igual — é ela que mantém as telas sem
 * saber de onde o dado vem — mas o que havia atrás dela mudou inteiro. `load()`
 * remonta a edição de dezenas de rotas granulares, e `apply()` traduz cada ação
 * nomeada na chamada REST correspondente.
 *
 * Duas consequências que valem estar escritas aqui:
 * 1. **Nenhuma escrita devolve estado.** A API responde o recurso que mudou, e
 *    só ele. Como a resposta continua sendo a verdade, `apply()` relê a edição
 *    depois de escrever. É caro e é honesto; devolver o estado anterior com o
 *    campo remendado na mão seria a otimista que este adaptador nunca fez.
 * 2. **O id de tudo que nasce é do servidor.** O `createId` do cliente viaja no
 *    payload da ação e é ignorado pela API, que gera o seu. Depois da releitura
 *    o registro existe com outro id — quem navegar para o id que escolheu cai
 *    numa rota que não existe.
 */

/** Conexão de tempo real. Recebe o estado novo e devolve como se desligar. */
export type RealtimeConnect = (onSnapshot: (next: FrontendState) => void, onConnection?: (state: ConnectionState) => void) => () => void;

export type HttpAdapterOptions = {
  /**
   * Edição a carregar. A API não tem o apelido `active`: quando não vem id, a
   * edição vigente é resolvida por regra na leitura.
   */
  edition?: string;
  getToken?: () => string | null;
  fetchImpl?: typeof fetch;
  connect?: RealtimeConnect;
};

/** O que o servidor recusou por falta de papel, e não por estar fora do ar. */
function isForbidden(caught: unknown) {
  return caught instanceof ApiError && caught.status === 403;
}

/**
 * Coleção que o servidor pode negar por papel.
 *
 * `GET /teams` e `GET /athletes` exigem sessão; `GET /editions/:id/staff-roles`
 * exige ser admin da edição. Negar essas três é resposta legítima para quem
 * está olhando como espectador ou como gestor de modalidade, e derrubar a
 * carga inteira por isso deixaria a tela pública sem nada.
 *
 * O 401 só é tolerado **sem token**. Com token na mão, 401 é sessão vencida —
 * engolir aqui devolveria ao operador a visão do espectador, sem nenhum aviso,
 * e ele passaria a achar que perdeu os dados em vez de a sessão.
 */
async function optional<T>(hasToken: boolean, fallback: T, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (caught) {
    if (isForbidden(caught)) return fallback;
    if (!hasToken && caught instanceof UnauthorizedError) return fallback;
    throw caught;
  }
}

/**
 * A edição vigente, quando ninguém a fixou.
 *
 * A API não marca edição ativa: `EditionStatus.ONGOING` é o que mais perto
 * chega, e nada impede que duas edições estejam `ONGOING` ao mesmo tempo — a
 * exclusividade era garantida pelo reducer do pacote e agora não é garantida
 * por ninguém. Entre empatadas vence a mais recente; sem nenhuma em andamento,
 * a mais recente de todas, que é o que a tela precisa para não abrir vazia.
 *
 * Quem tem papel na edição tem preferência: um gestor de futsal da edição
 * passada abriria o app numa edição onde não pode nada.
 */
export function resolveEditionId(editions: ApiEdition[], me: ApiMe | null, pinned?: string) {
  if (pinned && editions.some((edition) => edition.id === pinned)) return pinned;
  const mine = new Set((me?.editionRoles ?? []).map((role) => role.editionId));
  const byYear = [...editions].sort((left, right) => right.year - left.year);
  const preferidas = me?.isSuperAdmin || mine.size === 0 ? byYear : byYear.filter((edition) => mine.has(edition.id));
  const escolha = preferidas.find((edition) => edition.status === 'ONGOING') ?? preferidas[0] ?? byYear[0];
  if (!escolha) throw new Error('A API não tem nenhuma edição cadastrada.');
  return escolha.id;
}

/**
 * A edição fixada, antes de a regra acima decidir por conta própria.
 *
 * Primeiro a de quem montou o adaptador; depois a do **escopo em uso**. Quem
 * tem papel em duas edições e troca de acesso espera ver a edição daquele
 * papel — sem isto a permissão mudava e os dados não, e a tela ficava
 * oferecendo administração sobre a edição errada.
 */
function pinnedEdition(options: HttpAdapterOptions) {
  if (options.edition && options.edition !== 'active') return options.edition;
  return activeScopeOf(readStoredSession())?.editionId;
}

/**
 * Ações que ainda não falam com a API, com dono.
 *
 * O ponto de extensão é este mapa, e é de propósito que ele seja explícito em
 * vez de um `default:` que lança: quem chegar aqui precisa saber onde encaixar
 * a tradução e por que ela ainda não existe. Duas razões diferentes convivem —
 * módulo de outra pessoa, e rota que a API não tem — e o texto diz qual é.
 */
const pendingActions: Record<string, { owner: string; hint: string }> = {
  'discipline/update': { owner: 'módulo de modalidades', hint: 'PATCH /editions/:editionId/disciplines/:editionDisciplineId aceita só `config`; o regulamento do front não tem coluna' },
  'category/create': { owner: 'módulo de categorias', hint: 'POST /editions/:editionId/tournaments + POST /tournaments/:id/phases, uma fase por vez' },
  'category/update': { owner: 'módulo de categorias', hint: 'inscrições, grupos e fases são quatro famílias de rota distintas; não há PATCH que receba a categoria inteira' },
  'category/generateMatches': { owner: 'módulo de categorias', hint: 'a API não gera chaveamento: cada partida nasce de um POST /phases/:phaseId/matches' },
  'match/start': { owner: 'módulo de operação de partida', hint: 'PATCH /matches/:id/status aceita LIVE, mas cronômetro, `startedAt` e nota de início não têm campo na API' },
  'match/updateClock': { owner: 'módulo de operação de partida', hint: 'a API não tem cronômetro: nenhum campo de relógio existe em Match' },
  'match/registerEvent': { owner: 'módulo de operação de partida', hint: 'POST /matches/:matchId/events, com `metadata` validado por slug da modalidade; o placar é recalculado no servidor' },
  'match/undoEvent': { owner: 'módulo de operação de partida', hint: 'DELETE /matches/:matchId/events/:id existe, mas não emite evento no SSE nem invalida cache' },
  'match/claimOperator': { owner: 'módulo de operação de partida', hint: 'a API não tem trava de operador: nenhum campo, nenhuma rota' },
  'match/releaseOperator': { owner: 'módulo de operação de partida', hint: 'a API não tem trava de operador: nenhum campo, nenhuma rota' },
  'match/finish': { owner: 'módulo de operação de partida', hint: 'PATCH /matches/:id/status aceita FINISHED e é ele que dispara a classificação — quem escrever isto precisa esperar por `settleStandings`, como `match/update` faz; desempate de partida não tem coluna' },
  'match/correctResult': { owner: 'módulo de operação de partida', hint: 'não há rota que aceite placar: corrigir é apagar e recriar eventos, e o vencedor gravado não é recalculado' },
  'ranking/addMetric': { owner: 'módulo de ranking geral', hint: 'a API não tem ranking geral: nem tabela, nem rota' },
  'ranking/updateMetric': { owner: 'módulo de ranking geral', hint: 'a API não tem ranking geral: nem tabela, nem rota' },
  'ranking/removeMetric': { owner: 'módulo de ranking geral', hint: 'a API não tem ranking geral: nem tabela, nem rota' },
  'ranking/addAwards': { owner: 'módulo de ranking geral', hint: 'a API não tem ranking geral: nem tabela, nem rota' },
  'ranking/revokeAward': { owner: 'módulo de ranking geral', hint: 'a API não tem ranking geral: nem tabela, nem rota' },
  'ranking/close': { owner: 'módulo de ranking geral', hint: 'a API não tem fechamento de edição: nem estado, nem rota' },
  'ranking/reopen': { owner: 'módulo de ranking geral', hint: 'a API não tem fechamento de edição: nem estado, nem rota' },
  'staff/upsert': { owner: 'módulo de staff', hint: 'POST /editions/:editionId/staff-roles exige um staffId preexistente, e a API não tem cadastro nem busca de Staff' },
  'competition/rename': { owner: 'módulo de competições', hint: 'a API não tem PATCH /competitions/:id' },
  'competition/activate': { owner: 'módulo de competições', hint: 'a API não marca competição ativa: a competição vigente é a dona da edição em andamento' },
  'team/update': { owner: 'módulo de equipes e atletas', hint: 'o catálogo global só tem POST e GET: não existe PATCH /teams/:id nem DELETE' },
};

/** A ação não tem tradução REST ainda, e a mensagem diz de quem é a vez. */
function pending(type: string): never {
  const entry = pendingActions[type];
  if (!entry) throw new Error(`A operação "${type}" não tem tradução para a API REST, e não está registrada como pendente.`);
  throw new Error(`A operação "${type}" ainda não fala com a API REST — ${entry.owner}. Onde encaixar: ${entry.hint}.`);
}

/** Alteração que não tem para onde ir na API, dita com o campo pelo nome. */
function unsupported(what: string): never {
  throw new Error(`${what} A API não tem rota para isso.`);
}

/**
 * A escrita que, ao falhar, deixa outra escrita gravada atrás de si.
 *
 * Várias ações do front viram duas ou mais chamadas REST, e a API não tem
 * transação nem rota de desfazer: quando a segunda falha, o que a primeira
 * gravou fica no servidor. "Não foi possível salvar" é, aí, uma frase falsa —
 * e cara, porque o operador tenta de novo e ou fica com dois registros, ou
 * esbarra num conflito de campo único que não explica de onde ele veio.
 *
 * `gravado` é essa parte da mensagem: o que já está no servidor e por onde
 * retomar. Só quem escreveu a tradução sabe disso; o servidor não tem como
 * dizer. A frase dele vai junto mesmo assim, porque é ela que diz **por que**
 * falhou, e o erro original vira `cause` para não sumir do log.
 *
 * `gravado` nulo é o caso em que nada foi gravado antes — o passo anterior não
 * chegou a acontecer. Aí não há o que declarar e o erro passa intacto.
 */
async function afterWrite<T>(gravado: string | null, step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (caught) {
    if (!gravado) throw caught;
    // Sessão morta atravessa inteira. Quem decide expulsar olha o **tipo**, não
    // a mensagem — `handleUnauthorized` no provider faz `instanceof
    // UnauthorizedError` —, então embrulhar aqui deixaria o operador com um
    // aviso de sessão expirada e a sessão viva, sem caminho de volta ao login.
    if (caught instanceof UnauthorizedError) throw caught;
    const motivo = caught instanceof Error ? caught.message : String(caught);
    throw new Error(`${gravado} O servidor recusou: ${motivo}`, { cause: caught });
  }
}

type Requester = <T>(path: string, method?: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown) => Promise<T>;

/**
 * Coleção paginada inteira.
 *
 * A API devolve `meta` ao lado de `data`, mas o cliente HTTP desembrulha o
 * envelope e entrega só `data` — de propósito, porque nenhuma outra rota tem
 * `meta`. Pedir a página cheia e continuar enquanto ela vier cheia dá o mesmo
 * resultado sem furar essa fronteira. O teto de 100 é o do `ValidationPipe`.
 */
async function collect<T>(request: Requester, path: string): Promise<T[]> {
  const pageSize = 100;
  const items: T[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const lote = await request<T[]>(`${path}${separator}page=${page}&pageSize=${pageSize}`);
    // Coleção que não veio como lista é resposta que o app não entende — um
    // proxy no caminho, uma rota renomeada. Espalhar isso estoura lá adiante
    // com um erro de sintaxe que não diz de qual rota veio.
    if (!Array.isArray(lote)) throw new Error(`A rota ${path} respondeu num formato que não é uma coleção.`);
    items.push(...lote);
    if (lote.length < pageSize) break;
  }
  return items;
}

/**
 * Lê a edição inteira das rotas granulares e a remonta em memória.
 *
 * **Uma falha derruba a carga.** As chamadas vão em `Promise.all` e a primeira
 * rejeição rejeita tudo: a alternativa — completar a coleção que faltou com
 * vazio — é exatamente a falha silenciosa que este repositório passou a semana
 * caçando. Uma edição sem torneios porque ninguém cadastrou e uma edição sem
 * torneios porque a rota respondeu 500 são idênticas na tela, e a segunda faz o
 * operador cadastrar tudo de novo. As únicas exceções são as coleções que o
 * servidor nega por papel, tratadas em `optional`, onde a ausência é a
 * resposta correta e não um erro.
 *
 * As ondas existem porque a API não deixa escolher: não há como pedir os
 * torneios sem saber a edição, nem as partidas sem saber as fases. Dentro de
 * cada onda tudo é paralelo.
 */
export async function loadEditionState(options: HttpAdapterOptions = {}): Promise<{ state: FrontendState; index: ApiIndex }> {
  /**
   * O token é lido **a cada requisição**, não uma vez para a carga inteira.
   *
   * A remontagem sai em quatro ondas. Se o acesso vencer no meio, a onda que
   * toma 401 renova e segue — mas as ondas seguintes, com o valor capturado no
   * início, sairiam com o token velho, tomariam 401 também e forçariam uma
   * segunda renovação. Contra o mock isso é só desperdício; contra uma API que
   * invalide a credencial de renovação anterior ao rotacionar, é a sessão do
   * operador se derrubando sozinha no meio de uma carga.
   */
  const readToken = options.getToken ?? readSessionToken;
  const request: Requester = (path, method = 'GET', body) => apiRequest({ path, method, body, token: readToken(), fetchImpl: options.fetchImpl });
  const autenticado = Boolean(readToken());

  // Onda 1: o que não depende de saber qual é a edição.
  const [competitions, me] = await Promise.all([
    collect<ApiCompetition>(request, '/competitions'),
    autenticado ? optional(autenticado, null, () => request<ApiMe>('/auth/me')) : Promise.resolve(null),
  ]);

  // Onda 2: as edições de cada competição, e daí qual é a vigente.
  const editions = (await Promise.all(competitions.map((competition) => request<ApiEdition[]>(`/competitions/${competition.id}/editions`)))).flat();
  const editionId = resolveEditionId(editions, me, pinnedEdition(options));

  // Onda 3: tudo o que pende só da edição.
  const [editionDisciplines, rosters, tournaments, teams, athletes, staffRoles] = await Promise.all([
    request<ApiEditionDiscipline[]>(`/editions/${editionId}/disciplines`),
    request<ApiRoster[]>(`/editions/${editionId}/rosters`),
    request<ApiTournament[]>(`/editions/${editionId}/tournaments`),
    optional<ApiTeam[]>(autenticado, [], () => collect<ApiTeam>(request, '/teams')),
    optional<ApiAthlete[]>(autenticado, [], () => collect<ApiAthlete>(request, '/athletes')),
    optional<ApiStaffRole[]>(autenticado, [], () => request<ApiStaffRole[]>(`/editions/${editionId}/staff-roles`)),
  ]);

  // Onda 4: o miolo de cada torneio, e as partidas e a classificação de cada
  // fase dele.
  const bundles = await Promise.all(tournaments.map(async (tournament): Promise<TournamentBundle> => {
    const [entries, phases, bracket] = await Promise.all([
      request<ApiEntry[]>(`/tournaments/${tournament.id}/entries`),
      request<ApiPhase[]>(`/tournaments/${tournament.id}/phases`),
      // O chaveamento é a única rota que devolve grupo e a associação
      // grupo-classificação. Sem ele a categoria perde os grupos, mas não a
      // carga: é cache de 60 s e pode estar frio num torneio recém-criado.
      optional<ApiBracket | null>(autenticado, null, () => request<ApiBracket>(`/tournaments/${tournament.id}/bracket`)),
    ]);
    const [matches, standings] = await Promise.all([
      Promise.all(phases.map((phase) => request<ApiMatch[]>(`/phases/${phase.id}/matches`))).then((lotes) => lotes.flat()),
      // A classificação não entra em `optional`: a rota é aberta, então 403 e
      // 401 não são resposta dela. Se ela falhar, é a carga que falhou — cair
      // no cálculo do cliente aqui seria trocar a tabela oficial pela nossa
      // sem que ninguém percebesse.
      Promise.all(phases.map(async (phase) => [phase.id, await request<ApiStanding[]>(`/phases/${phase.id}/standings`)] as const)).then(Object.fromEntries),
    ]);
    return { tournament, entries, phases, bracket, matches, standings };
  }));

  const payload: EditionPayload = { competitions, editions, activeEditionId: editionId, editionDisciplines, teams, athletes, rosters, tournaments: bundles, staffRoles };
  return remountEdition(payload);
}

export function createHttpStateAdapter(options: HttpAdapterOptions = {}): StateAdapter {
  const token = () => (options.getToken ?? readSessionToken)();
  const request: Requester = (path, method = 'GET', body) => apiRequest({ path, method, body, token: token(), fetchImpl: options.fetchImpl });
  /**
   * O que a última leitura descobriu sobre os ids da API.
   *
   * As ações do front falam por nome (modalidade, adversário) e por id do
   * front; as rotas exigem id de `EditionDiscipline`, de `TournamentEntry` e
   * de `Phase`. Guardar o índice da última carga evita reler a edição inteira
   * antes de cada escrita.
   */
  let index: ApiIndex | null = null;

  /** O índice em vigor, relendo a edição se a escrita vier antes da carga. */
  async function currentIndex(): Promise<ApiIndex> {
    if (index) return index;
    const loaded = await loadEditionState(options);
    index = loaded.index;
    return index;
  }

  async function reload() {
    const loaded = await loadEditionState(options);
    index = loaded.index;
    return loaded.state;
  }

  return {
    async load() {
      return reload();
    },

    async apply(action: Action) {
      await write(action, request, currentIndex);
      // A API não devolve estado: a verdade continua sendo a do servidor, e a
      // única forma de tê-la é reler o que acabou de mudar.
      return reload();
    },

    subscribe(onRemoteChange, onConnection) {
      // Sem canal configurado o app continua funcionando: cada operação já
      // relê o estado; o que falta é ver a mudança dos outros.
      return options.connect?.((next) => onRemoteChange(next), onConnection) ?? (() => {});
    },
  };
}

/**
 * Uma ação nomeada, nas chamadas REST que a realizam.
 *
 * Só as ações dos módulos assumidos — edições, equipes e atletas, agendamento —
 * têm tradução aqui. O resto cai em `pending`, que diz de quem é a vez.
 */
async function write(action: Action, request: Requester, currentIndex: () => Promise<ApiIndex>) {
  switch (action.type) {
    // ---------------------------------------------------------------- edições
    case 'competition/create': {
      const { competition, edition } = action.payload;
      const criada = await request<ApiCompetition>('/competitions', 'POST', { name: competition.name, slug: competition.slug || slugFrom(competition.name) });
      // Daqui em diante a competição existe e não há como apagá-la: a API não
      // tem `DELETE /competitions/:id`. Quem lesse "não foi possível criar"
      // cadastraria de novo e ficaria com duas — ou com um conflito de slug que
      // não conta que a primeira tentativa gravou.
      return afterWrite(
        `A competição "${criada.name}" foi criada, mas a edição não. Abra a competição e crie a edição de novo, em vez de cadastrar a competição outra vez.`,
        () => request(`/competitions/${criada.id}/editions`, 'POST', editionBody(edition)),
      );
    }

    case 'edition/create': {
      const { edition } = action.payload;
      const competitionId = edition.competitionId ?? (await currentIndex()).competitionId;
      return request(`/competitions/${competitionId}/editions`, 'POST', editionBody(edition));
    }

    case 'edition/update': {
      const { id, patch } = action.payload;
      // `year` e `competitionId` não são editáveis na API, e mandá-los junto
      // derruba a requisição inteira: o ValidationPipe global recusa campo
      // desconhecido em vez de ignorá-lo.
      if (patch.year !== undefined) unsupported('O ano da edição não pode ser alterado.');
      const dados: Record<string, unknown> = {};
      if (patch.name !== undefined) dados.name = patch.name;
      if (patch.start !== undefined) dados.startDate = dayToIso(patch.start);
      if (patch.end !== undefined) dados.endDate = dayToIso(patch.end);
      const salvou = Object.keys(dados).length > 0;
      if (salvou) await request(`/editions/${id}`, 'PATCH', dados);
      // Sem tradução: o estado guardado já é o enum que a rota espera.
      if (patch.status !== undefined) {
        await afterWrite(
          salvou ? 'O nome e as datas da edição foram salvos, mas o estado não mudou. A tela ainda mostra os valores antigos: recarregue antes de editar de novo.' : null,
          () => request(`/editions/${id}/status`, 'PATCH', { status: patch.status }),
        );
      }
      return;
    }

    /**
     * Ativar é pôr em andamento.
     *
     * O front trata ativação como exclusiva — uma edição ativa por competição —
     * e quem garantia isso era o reducer do pacote. A API não tem edição ativa
     * nem exclusividade: o mais próximo é `ONGOING`, e nada impede duas. As
     * outras **não** são rebaixadas aqui de propósito: rebaixar uma edição em
     * andamento é decisão de quem administra, não efeito colateral de um clique
     * em outra tela.
     */
    case 'edition/activate':
      return request(`/editions/${action.payload.id}/status`, 'PATCH', { status: 'ONGOING' });

    // ------------------------------------------------------ equipes e atletas
    case 'team/create': {
      const { id, team } = action.payload;
      const name = team.name ?? id;
      // O `slug` é o que mais perto está do id que o cliente escolheu — e é o
      // único campo, além do nome, que a API aceita numa equipe. Sigla, logo,
      // responsável e tom não têm coluna e ficam só no que a tela desenha.
      return request<ApiTeam>('/teams', 'POST', { name, slug: slugFrom(id || name) });
    }

    case 'athlete/create': {
      const { id, athlete } = action.payload;
      const index = await currentIndex();
      /**
       * Tudo que pode recusar a operação é resolvido **antes** do POST.
       *
       * Depois dele o atleta já está no catálogo global, e a API não tem
       * `DELETE /athletes/:id`: recusar aí deixa um registro que ninguém pediu
       * e que ainda barra o próximo cadastro, porque `document` é único. Vale
       * para as duas recusas — a equipe que falta e a modalidade que não está
       * na edição, que `disciplineIdOf` rejeitava só dentro do `map`.
       *
       * Cada modalidade do atleta é uma inscrição na edição, e a API exige
       * equipe em todas — inclusive nas individuais.
       */
      const teamId = athlete.teamId;
      if (!teamId) unsupported('A inscrição de atleta exige uma equipe.');
      const inscricoes = (athlete.modalities ?? []).map((modality) => disciplineIdOf(index, modality));

      const criado = await request<ApiAthlete>('/athletes', 'POST', { name: athlete.name ?? id, document: documentFor(id) });
      return afterWrite(
        inscricoes.length ? `O atleta "${criado.name}" entrou no catálogo, mas não foi inscrito nas modalidades. Abra o atleta e inscreva-o, em vez de cadastrá-lo de novo.` : null,
        async () => {
          await Promise.all(inscricoes.map((disciplineId) => request(`/editions/${index.editionId}/rosters`, 'POST', { disciplineId, athleteId: criado.id, teamId })));
        },
      );
    }

    case 'athlete/update': {
      const { id, patch } = action.payload;
      const index = await currentIndex();
      const rosters = index.rostersByAthlete[id] ?? [];
      if (patch.name !== undefined) unsupported('O nome do atleta não pode ser alterado.');

      // Saiu da equipe: no front o registro fica marcado; na API o equivalente
      // é a inscrição virar WITHDRAWN, que é o que o histórico preserva.
      if (patch.removed) {
        await Promise.all(rosters.map((roster) => request(`/editions/${index.editionId}/rosters/${roster.id}`, 'PATCH', { status: 'WITHDRAWN' })));
        return;
      }

      const alvo = patch.modalities;
      // Não é `alvo != null`: uma lista igual à que já está lá não escreve
      // nada, e anunciar inscrição que não houve é tão enganoso quanto calar a
      // que houve.
      let inscreveu = false;
      if (alvo) {
        const atuais = new Map(rosters.map((roster) => [roster.disciplineName, roster]));
        const novas = alvo.filter((modality) => !atuais.has(modality));
        const saindo = rosters.filter((roster) => !alvo.includes(roster.disciplineName));
        const teamId = patch.teamId ?? rosters[0]?.teamId;
        if (novas.length && !teamId) unsupported('A inscrição de atleta exige uma equipe.');
        // As modalidades viram id antes de qualquer escrita, pelo mesmo motivo
        // de `athlete/create`: `disciplineIdOf` dentro do `map` recusaria a
        // segunda modalidade com a inscrição da primeira já em voo.
        const entrando = novas.map((modality) => disciplineIdOf(index, modality));
        const escritas = entrando.length + saindo.length;
        inscreveu = escritas > 0;
        await afterWrite(
          // Uma inscrição só não deixa rastro: ou foi, ou não foi. Da segunda
          // em diante o `Promise.all` pode ter gravado parte — e repetir a
          // operação bate no `@@unique(editionDiscipline, athlete)` do que já
          // entrou, com um conflito que não diz que a metade valeu.
          escritas > 1 ? 'Parte das modalidades do atleta pode ter sido gravada. Recarregue e confira as modalidades antes de tentar de novo.' : null,
          () => Promise.all([
            ...entrando.map((disciplineId) => request(`/editions/${index.editionId}/rosters`, 'POST', { disciplineId, athleteId: id, teamId })),
            // Sem DELETE do lado do gestor de modalidade, sair de uma modalidade
            // é a inscrição virar WITHDRAWN — e é o que mantém o histórico.
            ...saindo.map((roster) => request(`/editions/${index.editionId}/rosters/${roster.id}`, 'PATCH', { status: 'WITHDRAWN' })),
          ]),
        );
      }

      if (patch.teamId !== undefined) {
        const trocar = rosters.filter((roster) => roster.teamId !== patch.teamId && (!alvo || alvo.includes(roster.disciplineName)));
        await afterWrite(
          inscreveu ? 'As modalidades do atleta foram atualizadas, mas a troca de equipe não. Recarregue antes de tentar de novo: repetir a operação inteira recadastraria a modalidade que já entrou.' : null,
          () => Promise.all(trocar.map((roster) => request(`/editions/${index.editionId}/rosters/${roster.id}`, 'PATCH', { teamId: patch.teamId }))),
        );
      }
      return;
    }

    // ------------------------------------------------------------ agendamento
    case 'match/schedule': {
      const { match } = action.payload;
      const index = await currentIndex();
      const phaseId = phaseIdFor(index, match.tournamentId, match.phase);
      const entries = index.entryByName[match.tournamentId ?? ''] ?? {};
      return request<ApiMatch>(`/phases/${phaseId}/matches`, 'POST', {
        entryAId: entries[match.entryA ?? ''] ?? null,
        entryBId: entries[match.entryB ?? ''] ?? null,
        scheduledAt: toScheduledAt(match.date, match.time),
        venue: match.venue ?? null,
      });
    }

    case 'match/update': {
      const { id, patch } = action.payload;
      // Placar não é campo de partida na API: ele é derivado dos eventos, e
      // `PATCH /matches/:id` recusa `scoreA`/`scoreB` com 400. Falhar aqui,
      // com o nome do campo, é melhor que deixar o servidor responder uma
      // mensagem de validação que não diz o que o operador fez.
      if (patch.scoreA !== undefined || patch.scoreB !== undefined) unsupported('O placar não é editável direto: ele vem dos eventos da partida.');
      const dados: Record<string, unknown> = {};
      if (patch.venue !== undefined) dados.venue = patch.venue;
      if (patch.date !== undefined || patch.time !== undefined) {
        const atual = await request<ApiMatch>(`/matches/${id}`);
        const { date, time } = { ...fromScheduledAt(atual.scheduledAt), ...clean({ date: patch.date, time: patch.time }) };
        dados.scheduledAt = toScheduledAt(date, time);
      }
      if (patch.entryA !== undefined || patch.entryB !== undefined) {
        // O índice só é necessário aqui: trocar o adversário é o único caso em
        // que o nome precisa virar id de inscrição, e pedi-lo antes obrigaria
        // uma remarcação simples a reler a edição inteira.
        const index = await currentIndex();
        const entries = index.entryByName[matchTournament(index, id)] ?? {};
        if (patch.entryA !== undefined) dados.entryAId = entries[patch.entryA] ?? null;
        if (patch.entryB !== undefined) dados.entryBId = entries[patch.entryB] ?? null;
      }
      const remarcou = Object.keys(dados).length > 0;
      if (remarcou) await request(`/matches/${id}`, 'PATCH', dados);
      // O estado vai por último: virar FINISHED é o que carimba o vencedor e
      // dispara o recálculo da classificação, e ele precisa ver a partida já
      // com o local e o horário novos.
      if (patch.status !== undefined) {
        const status = toMatchStatus(patch.status);
        const phaseId = status === 'FINISHED' ? (await currentIndex()).matchPhase[id] : undefined;
        const antes = phaseId ? await standingsSignature(request, phaseId) : undefined;
        await afterWrite(
          remarcou ? 'A remarcação da partida foi salva, mas o estado não mudou. A tela ainda mostra o horário antigo: recarregue antes de tentar de novo.' : null,
          () => request(`/matches/${id}/status`, 'PATCH', { status }),
        );
        if (phaseId && antes !== undefined) await settleStandings(request, phaseId, antes);
      }
      return;
    }

    default:
      return pending(action.type);
  }
}

/**
 * O que a classificação da fase diz agora, em uma linha comparável.
 *
 * Não é hash de conteúdo: é só o suficiente para reconhecer que o servidor
 * reescreveu a tabela — quem está em cada posição, quantos jogos e quantos
 * pontos. Encerrar uma partida mexe nos três de quem jogou.
 */
async function standingsSignature(request: Requester, phaseId: string) {
  const rows = await request<ApiStanding[]>(`/phases/${phaseId}/standings`);
  return rows.map((row) => `${row.entryId}:${row.rank}:${row.played}:${row.points}`).join('|');
}

/** Tentativas e espera até desistir de ver a classificação nova. */
const settleAttempts = 3;
const settleWaitMs = 80;

/**
 * Espera a classificação absorver a partida que acabou de encerrar.
 *
 * **Não dá para esperar um aviso: não existe aviso.** O único stream da API é
 * por partida (`GET /matches/:matchId/stream`) e só publica criação de evento —
 * quem escuta `MATCH_FINISHED` é a classificação, não o tempo real
 * (`src/realtime/realtime-event-handler.service.ts` assina apenas
 * `MATCH_EVENT_CREATED`). Mudança de estado de partida não vira quadro nenhum.
 *
 * E a corrida é real, não hipotética: o `PATCH /matches/:id/status` publica o
 * evento com `eventEmitter.emit`, sem `await` e sem `emitAsync`
 * (`src/matches/matches.service.ts:432`), enquanto o recálculo é um manipulador
 * assíncrono cuja promessa ninguém segura (`src/standings/standings.service.ts`,
 * `handleMatchFinished`). A resposta do PATCH chega antes de a tabela ser
 * reescrita, e quem reler no ato relê a tabela velha — a partida encerrada na
 * tela, a classificação sem ela, e nada que diga qual das duas está atrasada.
 *
 * Então o gatilho é a própria escrita: guarda a assinatura antes, insiste
 * depois. Se o prazo acabar, a releitura segue com o que o servidor tem —
 * **nunca** com uma tabela calculada aqui. Trocar a origem no meio faria a
 * ordem mudar sozinha e voltar atrás no ciclo seguinte, que é pior do que
 * mostrar uma tabela com um jogo de atraso.
 */
async function settleStandings(request: Requester, phaseId: string, before: string) {
  for (let attempt = 1; attempt <= settleAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, settleWaitMs * attempt));
    if (await standingsSignature(request, phaseId) !== before) return true;
  }
  return false;
}

/** Só o que foi realmente informado, para não sobrescrever com `undefined`. */
function clean(patch: { date?: string; time?: string }) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

function matchTournament(index: ApiIndex, matchId: string) {
  const phaseId = index.matchPhase[matchId];
  return Object.keys(index.phases).find((tournamentId) => index.phases[tournamentId].some((phase) => phase.id === phaseId)) ?? '';
}

/**
 * A fase onde a partida nasce.
 *
 * O front chama a fase pelo rótulo que a tela exibe ("Semifinal", "Grupo A"); a
 * API exige o id. Sem correspondência de nome, cai na primeira fase do torneio,
 * que é o único palpite que não inventa estrutura — criar a fase que falta
 * seria escrever no lugar do módulo de categorias.
 */
function phaseIdFor(index: ApiIndex, tournamentId?: string, phaseName?: string) {
  const phases = index.phases[tournamentId ?? ''] ?? [];
  const found = phases.find((phase) => phase.name === phaseName) ?? phases[0];
  if (!found) unsupported(`A categoria "${tournamentId ?? 'sem id'}" não tem nenhuma fase cadastrada, e a partida precisa de uma.`);
  return found.id;
}

function disciplineIdOf(index: ApiIndex, modality: string) {
  const found = index.disciplines[modality];
  if (!found) unsupported(`A modalidade "${modality}" não está cadastrada nesta edição.`);
  return found.disciplineId;
}

function editionBody(edition: { year: number; name: string; start: string; end: string }) {
  return { year: edition.year, name: edition.name, startDate: dayToIso(edition.start), endDate: dayToIso(edition.end) };
}

/**
 * Dia sem hora para o instante que a API grava.
 *
 * Meio-dia UTC de propósito: o campo é uma data de calendário, e qualquer hora
 * perto da meia-noite muda de dia ao ser lida em outro fuso — o início da
 * edição apareceria um dia antes para metade do mundo.
 */
function dayToIso(day: string) {
  return `${day}T12:00:00.000Z`;
}

/**
 * O documento que a API exige e o front nunca coletou.
 *
 * `POST /athletes` tem `document` obrigatório e único, e o cadastro de atleta
 * do app não tem esse campo. Derivar do id mantém a unicidade e deixa o
 * registro reconhecível como incompleto, em vez de fazer o cadastro falhar com
 * um erro de validação que o operador não tem como corrigir na tela. É dívida:
 * o formulário precisa passar a pedir o documento.
 */
function documentFor(id: string) {
  return `sem-documento-${id}`;
}
