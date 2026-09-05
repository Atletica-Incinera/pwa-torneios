import type { AthleteState, DisciplineState, MatchState, StaffState, TeamState, TournamentPhase, TournamentState } from '../frontend-state.ts';

/**
 * Dados iniciais da edição no adaptador local.
 *
 * Antes eram arrays constantes importados por 24 telas, e cada uma sobrepunha o
 * estado à sua maneira. Aqui eles são apenas o primeiro snapshot: têm o mesmo
 * formato de tudo o que vem depois, então o adaptador HTTP entrega o seu no
 * lugar deste e nenhuma tela percebe a troca.
 */
const editionId = 'intereng-2026';

export const seedTeams: Record<string, TeamState> = {
  alcateia: { name: 'Alcateia', initials: 'ALC', logo: '/teams/alcateia.webp', tone: 'blue' },
  cangaceiros: { name: 'Cangaceiros', initials: 'CAN', logo: '/teams/cangaceiros.webp', tone: 'pink' },
  caotica: { name: 'Caótica', initials: 'CAO', logo: '/teams/caotica.webp', tone: 'orange' },
  energizada: { name: 'Energizada', initials: 'ENE', logo: '/teams/energizada.webp', tone: 'blue' },
  engenhosa: { name: 'Engenhosa', initials: 'ENG', logo: '/teams/engenhosa.webp', tone: 'pink' },
  incinera: { name: 'Incinera', initials: 'INC', logo: '/teams/incinera.webp', tone: 'orange' },
  invasora: { name: 'Invasora', initials: 'INV', logo: '/teams/invasora.webp', tone: 'blue' },
  invocados: { name: 'Invocados', initials: 'IVC', logo: '/teams/invocados.webp', tone: 'pink' },
  graxeiros: { name: 'Graxeiros', initials: 'GRX', logo: '/teams/graxeiros.webp', tone: 'orange' },
  radioativa: { name: 'Radioativa', initials: 'RAD', logo: '/teams/radioativa.webp', tone: 'blue' },
  reativa: { name: 'Reativa', initials: 'REA', logo: '/teams/reativa.webp', tone: 'pink' },
  soberana: { name: 'Soberana', initials: 'SOB', logo: '/teams/soberana.webp', tone: 'orange' },
  thenebrosa: { name: 'THENEBROSA', initials: 'THE', logo: '/teams/thenebrosa.webp', tone: 'blue' },
  tubaroes: { name: 'Tubarões', initials: 'TUB', logo: '/teams/tubaroes.webp', tone: 'pink' },
  voraz: { name: 'Voraz', initials: 'VOR', logo: '/teams/voraz.webp', tone: 'orange' },
  zangada: { name: 'Zangada', initials: 'ZAN', logo: '/teams/zangada.webp', tone: 'blue' },
};

export const seedAthletes: Record<string, AthleteState> = {
  'ana-lima': { name: 'Ana Lima', teamId: 'alcateia', modalities: ['Futsal', 'Vôlei'] },
  'marina-souza': { name: 'Marina Souza', teamId: 'alcateia', modalities: ['Vôlei'] },
  'rafael-santos': { name: 'Rafael Santos', teamId: 'cangaceiros', modalities: ['Futsal'] },
  'joao-pedro': { name: 'João Pedro', teamId: 'caotica', modalities: [] },
};

export const seedDisciplines: Record<string, DisciplineState> = {
  Futsal: { name: 'Futsal', mode: 'Coletiva', tone: 'blue', enabled: true },
  'Vôlei': { name: 'Vôlei', mode: 'Coletiva', tone: 'pink', enabled: true },
  Handebol: { name: 'Handebol', mode: 'Coletiva', tone: 'orange', enabled: true },
  Xadrez: { name: 'Xadrez', mode: 'Individual', tone: 'blue', enabled: true },
  // Sem preset com este nome e sem regra propria: e a modalidade que cai na
  // regra generica, e o unico jeito de exercitar o aviso que diz isso.
  Queimado: { name: 'Queimado', mode: 'Coletiva', tone: 'orange', enabled: true },
};

/** Toda categoria nasce com estas duas fases, semeada ou criada no app. */
const defaultPhases: TournamentPhase[] = [
  { id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: ['Grupo A', 'Grupo B'], qualifiers: 2 },
  { id: 'knockout', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 },
];

function category(name: string, discipline: string, status: TournamentState['status'], tone: TournamentState['tone'], participants: string[] = []): TournamentState {
  const groups = defaultPhases.find((phase) => phase.format === 'Grupos')?.groups ?? [];
  return {
    editionId, name, discipline, status, tone,
    participants,
    seeds: Object.fromEntries(participants.map((team, index) => [team, index + 1])),
    assignments: Object.fromEntries(participants.map((team, index) => [team, groups[index % Math.max(1, groups.length)]])),
    phases: defaultPhases.map((phase) => ({ ...phase })),
    generated: false,
  };
}

/**
 * Categoria publicada ou em andamento nasce com inscritos.
 *
 * Sem eles a semente ensinava um fluxo que o servidor recusa: a API resolve o
 * confronto pela inscrição na categoria e devolve 404 para quem não está
 * inscrito. Pior no caso de "Em andamento", que trava a estrutura — não havia
 * caminho na interface para consertar. Rascunho continua vazio de propósito: é
 * o estado em que ninguém inscreveu ninguém ainda.
 */
export const seedTournaments: Record<string, TournamentState> = {
  'futsal-m': category('Futsal Masculino', 'Futsal', 'Em andamento', 'blue', ['Alcateia', 'Cangaceiros', 'Engenhosa', 'Incinera']),
  'volei-f': category('Vôlei Feminino', 'Vôlei', 'Publicado', 'pink', ['Caótica', 'Energizada', 'Invasora', 'Invocados']),
  xadrez: category('Xadrez Individual', 'Xadrez', 'Rascunho', 'orange'),
};

export const seedMatches: Record<string, MatchState> = {
  'semifinal-1': { editionId, tournamentId: 'futsal-m', time: '20:00', date: 'Hoje', discipline: 'Futsal', entryA: 'Alcateia', logoA: '/teams/alcateia.webp', entryB: 'Cangaceiros', logoB: '/teams/cangaceiros.webp', scoreA: 2, scoreB: 1, venue: 'Ginásio CIn', phase: 'Semifinal', status: 'Ao vivo' },
  'volei-grupo-a': { editionId, tournamentId: 'volei-f', time: '21:30', date: 'Hoje', discipline: 'Vôlei', entryA: 'Caótica', logoA: '/teams/caotica.webp', entryB: 'Energizada', logoB: '/teams/energizada.webp', scoreA: null, scoreB: null, venue: 'Quadra 2', phase: 'Grupo A', status: 'Agendada' },
  /*
   * Confronto do mata-mata que ainda espera um resultado: entra na agenda com
   * o rotulo no lugar do participante. Esta na semente porque e o unico jeito
   * de a tela da mesa ser exercitada nesse estado.
   *
   * Fica no Futsal, e nao no Volei, porque partida de mata-mata TRANCA o
   * elenco da modalidade (`lock: 'knockout'`) -- e o Futsal ja tem uma
   * semifinal aqui, entao o elenco dele ja estava trancado. No Volei, esta
   * partida trancaria um elenco que os testes de gestao ainda editam.
   */
  'futsal-m-advanced-r1-1': { editionId, tournamentId: 'futsal-m', time: '19:00', date: 'Hoje', discipline: 'Futsal', entryA: 'Vencedor do Jogo 1', entryB: 'Vencedor do Jogo 2', aDefinirA: true, aDefinirB: true, scoreA: null, scoreB: null, venue: 'Ginásio CIn', phase: 'Semifinal', status: 'Agendada' },
  /*
   * Jogo encerrado com gols SEM AUTOR -- o estado em que a mesa termina a
   * partida no ginasio, porque escolher quem marcou no meio do jogo custa
   * placar errado. E o estado que o painel de artilharia pos-jogo existe para
   * resolver, e o unico jeito de exercita-lo.
   */
  'futsal-grupo-encerrado': {
    editionId, tournamentId: 'futsal-m', time: '16:00', date: 'Hoje', discipline: 'Futsal',
    entryA: 'Alcateia', logoA: '/teams/alcateia.webp', entryB: 'Cangaceiros', logoB: '/teams/cangaceiros.webp',
    scoreA: 1, scoreB: 1, venue: 'Ginásio CIn', phase: 'Grupo A', status: 'Encerrada',
    events: [
      { id: 'gol-cangaceiros', at: '2026-10-13T16:20:00-03:00', elapsedSeconds: 1200, period: 2, type: 'Gol', detail: 'Gol do Cangaceiros', side: 'away', scoreA: 1, scoreB: 1, points: 1 },
      { id: 'gol-alcateia', at: '2026-10-13T16:05:00-03:00', elapsedSeconds: 300, period: 1, type: 'Gol', detail: 'Gol da Alcateia', side: 'home', scoreA: 1, scoreB: 0, points: 1 },
    ],
  },
  'futsal-quartas': { editionId, tournamentId: 'futsal-m', time: '18:00', date: 'Hoje', discipline: 'Futsal', entryA: 'Engenhosa', logoA: '/teams/engenhosa.webp', entryB: 'Incinera', logoB: '/teams/incinera.webp', scoreA: 3, scoreB: 3, venue: 'Ginásio CIn', phase: 'Quartas', status: 'Encerrada' },
};

export const seedStaff: Record<string, StaffState> = {
  'ana@ufpe.br': { name: 'Ana Coordenadora', email: 'ana@ufpe.br', initials: 'AC', role: 'Admin da edição', scope: 'InterEng 2026' },
  'bruno@ufpe.br': { name: 'Bruno Martins', email: 'bruno@ufpe.br', initials: 'BM', role: 'Gestor de modalidade', scope: 'Futsal' },
  'camila@ufpe.br': { name: 'Camila Rocha', email: 'camila@ufpe.br', initials: 'CR', role: 'Gestor de modalidade', scope: 'Vôlei' },
};
