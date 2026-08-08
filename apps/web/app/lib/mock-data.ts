export const currentContext = {
  competition: 'Jogos de Engenharia',
  edition: 'InterEng 2026',
  editionId: 'clx_edition_2026',
  period: '12–19 out',
};

export const teams = [
  { id: 'alcateia', name: 'Alcateia', athletes: 18, tone: 'blue', initial: 'A', logo: '/teams/alcateia.jpg' },
  { id: 'cangaceiros', name: 'Cangaceiros', athletes: 16, tone: 'pink', initial: 'C', logo: '/teams/cangaceiros.jpg' },
  { id: 'caotica', name: 'Caótica', athletes: 15, tone: 'orange', initial: 'C', logo: '/teams/caotica.png' },
  { id: 'energizada', name: 'Energizada', athletes: 14, tone: 'blue', initial: 'E', logo: '/teams/energizada.png' },
  { id: 'engenhosa', name: 'Engenhosa', athletes: 17, tone: 'pink', initial: 'E', logo: '/teams/engenhosa.png' },
  { id: 'incinera', name: 'Incinera', athletes: 13, tone: 'orange', initial: 'I', logo: '/teams/incinera.jpg' },
  { id: 'invasora', name: 'Invasora', athletes: 12, tone: 'blue', initial: 'I', logo: '/teams/invasora.png' },
  { id: 'invocados', name: 'Invocados', athletes: 16, tone: 'pink', initial: 'I', logo: '/teams/invocados.png' },
  { id: 'graxeiros', name: 'Graxeiros', athletes: 14, tone: 'orange', initial: 'G', logo: '/teams/graxeiros.png' },
  { id: 'radioativa', name: 'Radioativa', athletes: 15, tone: 'blue', initial: 'R', logo: '/teams/radioativa.jpg' },
  { id: 'reativa', name: 'Reativa', athletes: 11, tone: 'pink', initial: 'R', logo: '/teams/reativa.jpg' },
  { id: 'soberana', name: 'Soberana', athletes: 18, tone: 'orange', initial: 'S', logo: '/teams/soberana.jpg' },
  { id: 'thenebrosa', name: 'THENEBROSA', athletes: 13, tone: 'blue', initial: 'T', logo: '/teams/thenebrosa.png' },
  { id: 'tubaroes', name: 'Tubarões', athletes: 16, tone: 'pink', initial: 'T', logo: '/teams/tubaroes.jpg' },
  { id: 'voraz', name: 'Voraz', athletes: 12, tone: 'orange', initial: 'V', logo: '/teams/voraz.png' },
  { id: 'zangada', name: 'Zangada', athletes: 14, tone: 'blue', initial: 'Z', logo: '/teams/zangada.jpg' },
] as const;

export const athletes = [
  { id: 'ana-lima', name: 'Ana Lima', teamId: 'alcateia', modalities: ['Futsal', 'Vôlei'] },
  { id: 'marina-souza', name: 'Marina Souza', teamId: 'alcateia', modalities: ['Vôlei'] },
  { id: 'rafael-santos', name: 'Rafael Santos', teamId: 'cangaceiros', modalities: ['Futsal'] },
  { id: 'joao-pedro', name: 'João Pedro', teamId: 'caotica', modalities: [] },
] as const;

export const tournaments = [
  { id: 'futsal-m', name: 'Futsal Masculino', discipline: 'Futsal', status: 'Em andamento', entries: 8, phase: 'Semifinais', progress: 72, tone: 'blue' },
  { id: 'volei-f', name: 'Vôlei Feminino', discipline: 'Vôlei', status: 'Agendado', entries: 6, phase: 'Fase de grupos', progress: 38, tone: 'pink' },
  { id: 'xadrez', name: 'Xadrez Individual', discipline: 'Xadrez', status: 'Rascunho', entries: 12, phase: 'Configuração', progress: 16, tone: 'orange' },
] as const;

export const matches = [
  { id: 'semifinal-1', time: '20:00', date: 'Hoje', discipline: 'Futsal', entryA: 'Alcateia', logoA: '/teams/alcateia.jpg', entryB: 'Cangaceiros', logoB: '/teams/cangaceiros.jpg', scoreA: 2, scoreB: 1, venue: 'Ginásio CIn', phase: 'Semifinal', status: 'Ao vivo' },
  { id: 'volei-grupo-a', time: '21:30', date: 'Hoje', discipline: 'Vôlei', entryA: 'Caótica', logoA: '/teams/caotica.png', entryB: 'Energizada', logoB: '/teams/energizada.png', scoreA: null, scoreB: null, venue: 'Quadra 2', phase: 'Grupo A', status: 'Agendada' },
  { id: 'futsal-quartas', time: '18:00', date: 'Hoje', discipline: 'Futsal', entryA: 'Engenhosa', logoA: '/teams/engenhosa.png', entryB: 'Incinera', logoB: '/teams/incinera.jpg', scoreA: 3, scoreB: 3, venue: 'Ginásio CIn', phase: 'Quartas', status: 'Encerrada' },
] as const;

export function getMatchStatusLabel(status: string) {
  if (status === 'Agendada') return 'Próximo';
  if (status === 'Encerrada') return 'Encerrado';
  if (status === 'Adiada') return 'Adiado';
  if (status === 'Cancelada') return 'Cancelado';
  if (status === 'W.O.') return 'W.O.';
  return 'Ao vivo';
}

export const standings = [
  { rank: 1, name: 'Alcateia', logo: '/teams/alcateia.jpg', played: 3, won: 2, drawn: 1, lost: 0, balance: 5, points: 7 },
  { rank: 2, name: 'Cangaceiros', logo: '/teams/cangaceiros.jpg', played: 3, won: 2, drawn: 0, lost: 1, balance: 3, points: 6 },
  { rank: 3, name: 'Caótica', logo: '/teams/caotica.png', played: 3, won: 1, drawn: 1, lost: 1, balance: 0, points: 4 },
  { rank: 4, name: 'Energizada', logo: '/teams/energizada.png', played: 3, won: 0, drawn: 0, lost: 3, balance: -8, points: 0 },
] as const;

export const disciplines = [
  { name: 'Futsal', mode: 'Coletiva', config: '2 × 20 min', tournaments: 2, tone: 'blue' },
  { name: 'Vôlei', mode: 'Coletiva', config: '3 sets • 25 pts', tournaments: 2, tone: 'pink' },
  { name: 'Handebol', mode: 'Coletiva', config: '2 × 30 min', tournaments: 1, tone: 'orange' },
  { name: 'Xadrez', mode: 'Individual', config: 'Suíço • 7 rodadas', tournaments: 1, tone: 'blue' },
] as const;

export const staff = [
  { name: 'Ana Coordenadora', email: 'ana@ufpe.br', role: 'Admin da edição', scope: 'InterEng 2026', initials: 'AC' },
  { name: 'Bruno Martins', email: 'bruno@ufpe.br', role: 'Gestor de modalidade', scope: 'Futsal', initials: 'BM' },
  { name: 'Camila Rocha', email: 'camila@ufpe.br', role: 'Gestora de modalidade', scope: 'Vôlei', initials: 'CR' },
] as const;
