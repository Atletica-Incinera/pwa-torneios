import { describe, expect, it } from 'vitest';
import { findOfficialStanding } from '@atletica-incinera/intereng-contract/rules';
import { fromScheduledAt, remountEdition, toScheduledAt, type EditionPayload } from '../../app/lib/repositories/api-mapping';

/**
 * A remontagem e o mapeamento de data, sem rede.
 *
 * As duas são puras, e é nelas que o defeito da integração mora: o transporte
 * ou traz o corpo ou não traz, mas a tradução erra em silêncio — um campo no
 * lugar do outro, um horário deslocado, uma coleção montada pela metade.
 */

const base: EditionPayload = {
  competitions: [
    { id: 'jogos-engenharia', name: 'InterEng', slug: 'intereng' },
    { id: 'outra', name: 'Interlaser', slug: 'interlaser' },
  ],
  editions: [
    { id: 'intereng-2026', competitionId: 'jogos-engenharia', year: 2026, name: '2026', startDate: '2026-10-12T12:00:00.000Z', endDate: '2026-10-19T12:00:00.000Z', status: 'ONGOING' },
    { id: 'intereng-2025', competitionId: 'jogos-engenharia', year: 2025, name: '2025', startDate: '2025-10-13T12:00:00.000Z', endDate: '2025-10-20T12:00:00.000Z', status: 'FINISHED' },
  ],
  activeEditionId: 'intereng-2026',
  editionDisciplines: [
    { id: 'ed-futsal', disciplineId: 'futsal', disciplineName: 'Futsal', isIndividual: false, config: null },
    { id: 'ed-xadrez', disciplineId: 'xadrez', disciplineName: 'Xadrez', isIndividual: true, config: null },
  ],
  teams: [
    { id: 'time-1', name: 'Alcateia', slug: 'alcateia' },
    { id: 'time-2', name: 'Cangaceiros', slug: 'cangaceiros' },
  ],
  athletes: [{ id: 'atleta-1', name: 'Ana Lima' }],
  rosters: [
    { id: 'roster-1', editionId: 'intereng-2026', disciplineId: 'futsal', disciplineName: 'Futsal', teamId: 'time-1', teamName: 'Alcateia', jerseyNumber: 7, status: 'ACTIVE', athlete: { id: 'atleta-1', name: 'Ana Lima' } },
    { id: 'roster-2', editionId: 'intereng-2026', disciplineId: 'xadrez', disciplineName: 'Xadrez', teamId: 'time-1', teamName: 'Alcateia', jerseyNumber: null, status: 'WITHDRAWN', athlete: { id: 'atleta-1', name: 'Ana Lima' } },
  ],
  tournaments: [{
    tournament: { id: 'futsal-m', editionId: 'intereng-2026', disciplineId: 'futsal', name: 'Futsal Masculino', format: 'GROUP_KNOCKOUT', status: 'ONGOING' },
    entries: [
      { id: 'entry-a', tournamentId: 'futsal-m', teamId: 'time-1', teamName: 'Alcateia', athleteId: null, athleteName: null, seed: 1 },
      { id: 'entry-b', tournamentId: 'futsal-m', teamId: 'time-2', teamName: 'Cangaceiros', athleteId: null, athleteName: null, seed: null },
    ],
    phases: [
      { id: 'fase-grupos', tournamentId: 'futsal-m', order: 1, name: 'Fase de grupos', type: 'GROUP', config: { advanceCount: 2, tiebreakers: ['points'] } },
      { id: 'fase-mata', tournamentId: 'futsal-m', order: 2, name: 'Mata-mata', type: 'KNOCKOUT', config: {} },
    ],
    bracket: {
      format: 'GROUP_KNOCKOUT',
      phases: [{ phaseId: 'fase-grupos', name: 'Fase de grupos', type: 'GROUP', groups: [{ name: 'Grupo A', standings: [{ entryId: 'entry-a', entryName: 'Alcateia' }, { entryId: 'entry-b', entryName: 'Cangaceiros' }] }] }],
    },
    // A classificação oficial: `Grupo A` sai da fase de grupos cruzada com o
    // chaveamento, e a fase sem grupos entra pelo nome dela.
    standings: {
      'fase-grupos': [
        { entryId: 'entry-b', entryName: 'Cangaceiros', played: 2, won: 1, drawn: 1, lost: 0, scoreFor: 4, scoreAgainst: 3, points: 4, rank: 1 },
        { entryId: 'entry-a', entryName: 'Alcateia', played: 2, won: 1, drawn: 1, lost: 0, scoreFor: 6, scoreAgainst: 4, points: 4, rank: 2 },
      ],
      'fase-mata': [
        { entryId: 'entry-a', entryName: 'Alcateia', played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, points: 0, rank: null },
        { entryId: 'entry-b', entryName: 'Cangaceiros', played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, points: 0, rank: null },
      ],
    },
    matches: [
      { id: 'partida-1', phaseId: 'fase-grupos', groupId: 'grupo-a', round: 1, bracketSlot: null, entryA: { id: 'entry-a', name: 'Alcateia' }, entryB: { id: 'entry-b', name: 'Cangaceiros' }, winnerEntryId: null, scoreA: 2, scoreB: 1, status: 'LIVE', scheduledAt: '2026-10-12T23:00:00.000Z', venue: 'Ginásio CIn', lastEventSequence: 3 },
      { id: 'partida-2', phaseId: 'fase-mata', groupId: null, round: 2, bracketSlot: 1, entryA: null, entryB: null, winnerEntryId: null, scoreA: 0, scoreB: 0, status: 'SCHEDULED', scheduledAt: null, venue: null, lastEventSequence: 0 },
    ],
  }],
  staffRoles: [
    { id: 'role-1', editionId: 'intereng-2026', staffId: 'staff-1', staffName: 'Ana Coordenadora', staffEmail: 'ana@ufpe.br', disciplineId: null, disciplineName: null, role: 'EDITION_ADMIN' },
    { id: 'role-2', editionId: 'intereng-2026', staffId: 'staff-2', staffName: 'Bruno Martins', staffEmail: 'bruno@ufpe.br', disciplineId: 'futsal', disciplineName: 'Futsal', role: 'DISCIPLINE_MANAGER' },
  ],
};

describe('remontagem da edição', () => {
  it('marca como ativa a edição pedida e a competição dona dela', () => {
    const { state } = remountEdition(base);

    expect(state.editions.find((edition) => edition.active)?.id).toBe('intereng-2026');
    expect(state.editions.filter((edition) => edition.active)).toHaveLength(1);
    expect(state.competitions.find((competition) => competition.active)?.id).toBe('jogos-engenharia');
  });

  it('traduz o vocabulário de estado da API para o que a tela exibe', () => {
    const { state } = remountEdition(base);

    expect(state.tournaments['futsal-m'].status).toBe('Em andamento');
    expect(state.matches['partida-1'].status).toBe('Ao vivo');
    expect(state.matches['partida-2'].status).toBe('Agendada');
  });

  it('o estado da edição atravessa sem tradução, porque o front adotou o enum da API', () => {
    const { state } = remountEdition(base);

    expect(state.editions.find((edition) => edition.id === 'intereng-2025')?.status).toBe('FINISHED');
  });

  it('recusa em voz alta quando a edição pedida não veio', () => {
    // Sem isto o estado sairia plausível — competição, coleções vazias, nenhum
    // erro — e a tela diria `pronto` sem ter carregado nada.
    expect(() => remountEdition({ ...base, activeEditionId: 'intereng-2030' })).toThrow(/edição pedida/i);
  });

  it('reúne as inscrições do atleta numa lista de modalidades, sem as que ele deixou', () => {
    const { state } = remountEdition(base);

    expect(state.athletes['atleta-1'].modalities).toEqual(['Futsal']);
    expect(state.athletes['atleta-1'].teamId).toBe('time-1');
    expect(state.athletes['atleta-1'].removed).toBeUndefined();
  });

  it('atleta sem nenhuma inscrição ativa sai do elenco sem sumir do histórico', () => {
    const semAtivas: EditionPayload = { ...base, rosters: base.rosters.map((roster) => ({ ...roster, status: 'WITHDRAWN' as const })) };
    const { state } = remountEdition(semAtivas);

    expect(state.athletes['atleta-1'].removed).toBe(true);
    expect(state.athletes['atleta-1'].name).toBe('Ana Lima');
  });

  it('indexa a modalidade por nome, porque é assim que a tela a procura', () => {
    const { state } = remountEdition(base);

    expect(Object.keys(state.disciplines)).toEqual(['Futsal', 'Xadrez']);
    expect(state.disciplines.Xadrez.mode).toBe('Individual');
    expect(state.disciplines.Futsal.tournaments).toBe(1);
  });

  it('monta a categoria com participantes, fases e a alocação dos grupos', () => {
    const { state } = remountEdition(base);
    const categoria = state.tournaments['futsal-m'];

    // Nome, não id: é assim que a partida guarda `entryA`, é o que o
    // formulário de agendamento oferece como opção, e é o que as telas de
    // categoria e desempenho comparam.
    expect(categoria.participants).toEqual(['Alcateia', 'Cangaceiros']);
    expect(categoria.seeds).toEqual({ Alcateia: 1 });
    expect(categoria.phases.map((phase) => phase.format)).toEqual(['Grupos', 'Mata-mata']);
    expect(categoria.phases[0].groups).toEqual(['Grupo A']);
    expect(categoria.phases[0].qualifiers).toBe(2);
    // O chaveamento é a única rota que diz quem está em qual grupo.
    expect(categoria.assignments).toEqual({ Alcateia: 'Grupo A', Cangaceiros: 'Grupo A' });

    // A asserção que amarra as duas pontas, e que teria pego o defeito na
    // origem: o que a categoria lista precisa ser o mesmo vocabulário que a
    // partida guarda. Com id de um lado e nome do outro, agendar criava a
    // partida com os dois times em "A definir", e o servidor respondia 201.
    expect(categoria.participants).toContain(state.matches['partida-1'].entryA);
    expect(categoria.generated).toBe(true);
  });

  it('a partida agendada não tem placar, e a que já rolou tem o do servidor', () => {
    const { state } = remountEdition(base);

    // Zero de partida agendada é "ainda não começou", não resultado: a tela
    // mostra `×` quando o placar é nulo.
    expect(state.matches['partida-2'].scoreA).toBeNull();
    expect(state.matches['partida-1'].scoreA).toBe(2);
    expect(state.matches['partida-1'].entryA).toBe('Alcateia');
    expect(state.matches['partida-2'].entryA).toBe('A definir');
  });

  it('entrega o índice de ids que as escritas exigem e o estado não guarda', () => {
    const { index } = remountEdition(base);

    expect(index.editionId).toBe('intereng-2026');
    expect(index.disciplines.Futsal).toEqual({ disciplineId: 'futsal', editionDisciplineId: 'ed-futsal', isIndividual: false });
    expect(index.entryByName['futsal-m'].Alcateia).toBe('entry-a');
    expect(index.matchPhase['partida-1']).toBe('fase-grupos');
    expect(index.teamSlugs['time-1']).toBe('alcateia');
  });

  it('o staff da edição vira acesso indexado por e-mail, com o rótulo do papel', () => {
    const { state } = remountEdition(base);

    expect(state.staff['ana@ufpe.br'].role).toBe('Admin da edição');
    expect(state.staff['bruno@ufpe.br'].role).toBe('Gestor de modalidade');
    expect(state.staff['bruno@ufpe.br'].scope).toBe('Futsal');
  });

  it('não inventa ranking geral nem auditoria, que a API não tem', () => {
    const { state } = remountEdition(base);

    expect(state.overallRanking.awards).toEqual([]);
    expect(state.audit).toEqual([]);
    // As métricas continuam sendo as do contrato: são catálogo, não lançamento.
    expect(state.overallRanking.metrics.length).toBeGreaterThan(0);
  });
});

describe('classificação oficial', () => {
  it('a tabela do grupo sai do servidor com a ordem e os números dele', () => {
    const { state } = remountEdition(base);
    const grupo = state.tournaments['futsal-m'].standings?.['Grupo A'];

    // O servidor pôs Cangaceiros na frente com o mesmo número de pontos e saldo
    // pior. A cadeia de desempate daqui inverteria as duas, e é exatamente por
    // isso que a ordem não pode ser recalculada: a posição é a dele.
    expect(grupo?.map((row) => row.name)).toEqual(['Cangaceiros', 'Alcateia']);
    expect(grupo?.map((row) => row.rank)).toEqual([1, 2]);
    expect(grupo?.[1]).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 4, goalsFor: 6, goalsAgainst: 4 });
  });

  it('o saldo é derivado, e o que a API não tem não é inventado', () => {
    const { state } = remountEdition(base);
    const [primeira] = state.tournaments['futsal-m'].standings?.['Grupo A'] ?? [];

    expect(primeira.balance).toBe(1);
    // Fair play não tem coluna na API e o critério do desempate não volta na
    // resposta: preencher qualquer um dos dois seria dar uma justificativa que
    // o servidor não deu — e que pode não ser a dele.
    expect(primeira.disciplinary).toBe(0);
    expect(primeira.tiebreak).toBeUndefined();
  });

  it('a fase sem grupos entra pelo nome dela, e rank nulo vira a posição na lista', () => {
    const { state } = remountEdition(base);
    const mata = state.tournaments['futsal-m'].standings?.['Mata-mata'];

    expect(mata?.map((row) => row.name)).toEqual(['Alcateia', 'Cangaceiros']);
    expect(mata?.map((row) => row.rank)).toEqual([1, 2]);
  });

  it('fase sem nenhuma linha não vira tabela vazia na tela', () => {
    const semTabela: EditionPayload = { ...base, tournaments: base.tournaments.map((bundle) => ({ ...bundle, standings: {} })) };
    const { state } = remountEdition(semTabela);

    // Vazio quer dizer que o recálculo nunca rodou naquela fase, não que
    // ninguém está inscrito: quem recebe nada calcula a tabela.
    expect(state.tournaments['futsal-m'].standings).toEqual({});
  });

  it('sem chaveamento não há tabela oficial, porque não dá para separar os grupos', () => {
    const semChaveamento: EditionPayload = { ...base, tournaments: base.tournaments.map((bundle) => ({ ...bundle, bracket: null })) };
    const { state } = remountEdition(semChaveamento);

    // A lista da fase vem plana: sem saber quem está em qual grupo, publicá-la
    // daria uma tabela plausível com posições repetidas e adversários que nunca
    // se enfrentaram.
    expect(state.tournaments['futsal-m'].standings).toEqual({});
  });

  it('a linha oficial do participante é a da primeira fase em que ele aparece', () => {
    const { state } = remountEdition(base);

    expect(findOfficialStanding(state.tournaments['futsal-m'].standings, 'Alcateia')?.points).toBe(4);
    expect(findOfficialStanding(state.tournaments['futsal-m'].standings, 'Quem não jogou')).toBeUndefined();
  });
});

describe('data e hora da partida', () => {
  it('o horário digitado é o horário local, e volta igual do servidor', () => {
    const iso = toScheduledAt('2026-10-12', '20:00');

    expect(iso).toBeTruthy();
    // Um jogo às 20:00 precisa continuar às 20:00 em quem for ler — é o
    // defeito que só apareceria no dia do jogo.
    expect(new Date(iso as string).getHours()).toBe(20);
    expect(fromScheduledAt(iso)).toEqual({ date: '2026-10-12', time: '20:00' });
  });

  it('a conversão é do fuso do aparelho, não a leitura literal do texto como UTC', () => {
    const iso = toScheduledAt('2026-10-12', '20:00') as string;
    const offset = new Date(2026, 9, 12, 20, 0).getTimezoneOffset();

    if (offset === 0) expect(iso).toBe('2026-10-12T20:00:00.000Z');
    // Onde há fuso, gravar o texto como UTC deslocaria o jogo na tela de todo
    // mundo — inclusive na de quem o marcou.
    else expect(iso).not.toBe('2026-10-12T20:00:00.000Z');
  });

  it('aceita o rótulo relativo que a semente usa, resolvendo para o dia de hoje', () => {
    const hoje = new Date();
    const esperado = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    expect(fromScheduledAt(toScheduledAt('Hoje', '18:30'))).toEqual({ date: esperado, time: '18:30' });
  });

  it('partida sem data ou sem hora não vira instante nenhum', () => {
    // Metade do agendamento não é agendamento: mandar meio-dia por omissão
    // colocaria no calendário um jogo que ninguém marcou.
    expect(toScheduledAt('2026-10-12', undefined)).toBeNull();
    expect(toScheduledAt(undefined, '20:00')).toBeNull();
    expect(toScheduledAt('2026-10-12', 'depois do almoço')).toBeNull();
    expect(fromScheduledAt(null)).toEqual({});
  });
});
