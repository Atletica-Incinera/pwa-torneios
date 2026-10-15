import assert from 'node:assert/strict';
import test from 'node:test';
import { bracketRounds, roundName } from '../../app/lib/bracket-view.ts';

const m = (id: string, phase = 'Mata-mata') => ({ id, entryA: 'A', entryB: 'B', scoreA: null, scoreB: null, status: 'Agendada', phase });

test('a fase chamada "Mata-mata" entra na chave (em 2026 a aba ficava vazia)', () => {
  const rounds = bracketRounds([m('cat-generated-1', 'Grupo A'), m('cat-advanced-r1-1'), m('cat-advanced-r1-2'), m('cat-advanced-r2-1'), m('cat-advanced-third')], ['Mata-mata']);
  assert.deepEqual(rounds.map((round) => round.name), ['Semifinal', 'Disputa de 3º lugar', 'Final']);
});

test('jogo eliminatório agendado à mão não some', () => {
  const rounds = bracketRounds([m('match-123', 'Final')], []);
  assert.equal(rounds.length, 1);
});

test('nome da rodada pelo tamanho', () => {
  assert.deepEqual([1, 2, 4, 8].map(roundName), ['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final']);
});

test('rótulo da fase: rodada no mata-mata, nome da fase fora dele', async () => {
  const { matchStageLabel } = await import('../../app/lib/bracket-view.ts');
  const ids = ['c-1', 'c-advanced-r1-1', 'c-advanced-r1-2', 'c-advanced-r2-1', 'c-advanced-third'];
  assert.equal(matchStageLabel('c-advanced-r1-2', 'Mata-mata', ids), 'Semifinal');
  assert.equal(matchStageLabel('c-advanced-r2-1', 'Mata-mata', ids), 'Final');
  assert.equal(matchStageLabel('c-advanced-third', 'Mata-mata', ids), 'Disputa de 3º lugar');
  assert.equal(matchStageLabel('c-1', 'Grupo A', ids), 'Grupo A');
});
