import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStandings, distributeGroups, formatClock, generateRoundRobin } from '../../app/lib/tournament-engine.ts';

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
