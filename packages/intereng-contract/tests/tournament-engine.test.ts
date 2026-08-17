import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStandings, distributeGroups, findOfficialStanding, formatClock, generateRoundRobin, qualifiedTeams, resolveRegulation, resolveStandings, type Standing, type StandingsRule } from '@atletica-incinera/intereng-contract/rules';

test('calcula J, V, E, D e pontos com desempate', () => {
  const table = calculateStandings(['A', 'B', 'C'], [
    { id: '1', entryA: 'A', entryB: 'B', scoreA: 2, scoreB: 0, status: 'Encerrada' },
    { id: '2', entryA: 'A', entryB: 'C', scoreA: 1, scoreB: 1, status: 'Encerrada' },
    { id: '3', entryA: 'B', entryB: 'C', scoreA: null, scoreB: null, status: 'Agendada' },
  ]);
  assert.deepEqual(table.map(({ name, played, won, drawn, lost, points }) => ({ name, played, won, drawn, lost, points })), [
    { name: 'A', played: 2, won: 1, drawn: 1, lost: 0, points: 4 },
    { name: 'C', played: 1, won: 0, drawn: 1, lost: 0, points: 1 },
    { name: 'B', played: 1, won: 0, drawn: 0, lost: 1, points: 0 },
  ]);
});

test('distribui seeds em serpentina e gera turno completo', () => {
  const teams = ['A', 'B', 'C', 'D'];
  assert.deepEqual(distributeGroups(teams, ['Grupo A', 'Grupo B'], { A: 1, B: 2, C: 3, D: 4 }), { A: 'Grupo A', B: 'Grupo B', C: 'Grupo B', D: 'Grupo A' });
  assert.equal(generateRoundRobin(teams).length, 6);
});

test('formata relógio real da partida', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(4365), '72:45');
});

test('respeita quantidades diferentes de classificados por grupo', () => {
  const groups = [{ name: 'Grupo A', participants: ['A', 'B', 'C'] }];
  const matches = [
    { id: '1', entryA: 'A', entryB: 'B', scoreA: 2, scoreB: 0, status: 'Encerrada', group: 'Grupo A' },
    { id: '2', entryA: 'A', entryB: 'C', scoreA: 1, scoreB: 0, status: 'Encerrada', group: 'Grupo A' },
    { id: '3', entryA: 'B', entryB: 'C', scoreA: 1, scoreB: 0, status: 'Encerrada', group: 'Grupo A' },
  ];

  assert.deepEqual(qualifiedTeams(groups, matches, 1), ['A']);
  assert.deepEqual(qualifiedTeams(groups, matches, 2), ['A', 'B']);
  assert.deepEqual(qualifiedTeams(groups, matches, 3), ['A', 'B', 'C']);
});

test('aplica a pontuação configurada no regulamento da modalidade', () => {
  // FIBA: vitória vale 2 e derrota vale 1, e o empate não existe.
  const table = calculateStandings(['A', 'B', 'C'], [
    { id: '1', entryA: 'A', entryB: 'B', scoreA: 80, scoreB: 70, status: 'Encerrada' },
    { id: '2', entryA: 'A', entryB: 'C', scoreA: 60, scoreB: 90, status: 'Encerrada' },
  ], resolveRegulation('Basquete').standings);

  assert.deepEqual(table.map((row) => [row.name, row.points]), [['A', 3], ['C', 2], ['B', 1]]);
});

test('desempata por confronto direto antes do saldo', () => {
  const rule: StandingsRule = { win: 3, draw: 1, loss: 0, tiebreakers: ['confronto-direto', 'saldo', 'marcados'] };
  // A e B terminam com 3 pontos; B tem saldo melhor, mas A venceu o confronto direto.
  const table = calculateStandings(['A', 'B', 'C'], [
    { id: '1', entryA: 'A', entryB: 'B', scoreA: 1, scoreB: 0, status: 'Encerrada' },
    { id: '2', entryA: 'B', entryB: 'C', scoreA: 5, scoreB: 0, status: 'Encerrada' },
  ], rule);

  assert.deepEqual(table.map((row) => [row.name, row.points, row.balance]), [['A', 3, 1], ['B', 3, 4], ['C', 0, -5]]);
  assert.equal(table[0].tiebreak, 'Confronto direto');
});

test('desempata blocos com mais de duas equipes e registra o critério de cada uma', () => {
  const rule: StandingsRule = { win: 3, draw: 1, loss: 0, tiebreakers: ['confronto-direto', 'saldo', 'marcados', 'sorteio'] };
  // Triplo empate em 3 pontos: A bateu B, B bateu C, C bateu A.
  const table = calculateStandings(['A', 'B', 'C'], [
    { id: '1', entryA: 'A', entryB: 'B', scoreA: 3, scoreB: 0, status: 'Encerrada' },
    { id: '2', entryA: 'B', entryB: 'C', scoreA: 2, scoreB: 0, status: 'Encerrada' },
    { id: '3', entryA: 'C', entryB: 'A', scoreA: 1, scoreB: 0, status: 'Encerrada' },
  ], rule);

  assert.deepEqual(table.map((row) => row.points), [3, 3, 3]);
  assert.deepEqual(table.map((row) => row.name), ['A', 'B', 'C']);
  assert.deepEqual(table.map((row) => row.tiebreak), ['Confronto direto', 'Pontos marcados', 'Pontos marcados']);
});

test('conta W.O. como resultado oficial e ignora cancelada', () => {
  const table = calculateStandings(['A', 'B', 'C'], [
    { id: '1', entryA: 'A', entryB: 'B', scoreA: 1, scoreB: 0, status: 'W.O.' },
    { id: '2', entryA: 'A', entryB: 'C', scoreA: 3, scoreB: 0, status: 'Cancelada' },
  ]);

  assert.equal(table.find((row) => row.name === 'A')?.points, 3);
  assert.equal(table.find((row) => row.name === 'A')?.played, 1);
  assert.equal(table.find((row) => row.name === 'C')?.played, 0);
});

test('fair play usa os pontos disciplinares da partida', () => {
  const rule: StandingsRule = { win: 3, draw: 1, loss: 0, tiebreakers: ['fair-play'] };
  const table = calculateStandings(['A', 'B'], [
    { id: '1', entryA: 'A', entryB: 'B', scoreA: 1, scoreB: 1, status: 'Encerrada', disciplinaryA: 3, disciplinaryB: 0 },
  ], rule);

  assert.deepEqual(table.map((row) => row.name), ['B', 'A']);
  assert.equal(table[0].tiebreak, 'Fair play');
});

/** Uma linha como o servidor a manda: já com posição, já ordenada. */
function oficial(name: string, rank: number, points: number): Standing {
  return { rank, name, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, balance: 0, points, disciplinary: 0 };
}

test('a tabela oficial vence o cálculo local, inclusive na ordem', () => {
  const partidas = [{ id: '1', entryA: 'A', entryB: 'B', scoreA: 3, scoreB: 0, status: 'Encerrada' }];

  // O cálculo daqui poria A na frente com 3 pontos. Quando o servidor mandou a
  // tabela, é a dele que vale — misturar a ordem de um com os números do outro
  // deixaria a posição sem justificativa nos números exibidos.
  assert.deepEqual(resolveStandings([oficial('B', 1, 1), oficial('A', 2, 1)], ['A', 'B'], partidas).map((row) => row.name), ['B', 'A']);
  assert.deepEqual(resolveStandings(undefined, ['A', 'B'], partidas).map((row) => row.name), ['A', 'B']);
});

test('tabela oficial vazia não é tabela: cai no cálculo', () => {
  // Fase que nunca foi recalculada devolve lista vazia. Exibi-la faria um
  // torneio que ainda não começou parecer um torneio sem inscritos.
  const table = resolveStandings([], ['A', 'B'], []);

  assert.deepEqual(table.map((row) => row.name), ['A', 'B']);
  assert.equal(table[0].played, 0);
});

test('a linha oficial do participante vem da primeira fase em que ele aparece', () => {
  const tabelas = { 'Grupo A': [oficial('A', 1, 4)], 'Mata-mata': [oficial('A', 3, 0)] };

  assert.equal(findOfficialStanding(tabelas, 'A')?.points, 4);
  assert.equal(findOfficialStanding(tabelas, 'Z'), undefined);
  assert.equal(findOfficialStanding(undefined, 'A'), undefined);
});
