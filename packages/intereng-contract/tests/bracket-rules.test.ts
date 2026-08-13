import test from 'node:test';
import assert from 'node:assert/strict';
import { byes, collectQualifiers, describeAdvancement, roundName, seedPairs, type GroupStanding, calculateStandings } from '@atletica-incinera/intereng-contract/rules';

function group(name: string, participants: string[], matches: Parameters<typeof calculateStandings>[1]): GroupStanding {
  return { group: name, rows: calculateStandings(participants, matches) };
}

const grupoA = group('Grupo A', ['A', 'B', 'C'], [
  { id: '1', entryA: 'A', entryB: 'B', scoreA: 2, scoreB: 0, status: 'Encerrada' },
  { id: '2', entryA: 'A', entryB: 'C', scoreA: 3, scoreB: 0, status: 'Encerrada' },
  { id: '3', entryA: 'B', entryB: 'C', scoreA: 1, scoreB: 0, status: 'Encerrada' },
]);
const grupoB = group('Grupo B', ['D', 'E', 'F'], [
  { id: '4', entryA: 'D', entryB: 'E', scoreA: 1, scoreB: 0, status: 'Encerrada' },
  { id: '5', entryA: 'D', entryB: 'F', scoreA: 1, scoreB: 0, status: 'Encerrada' },
  { id: '6', entryA: 'E', entryB: 'F', scoreA: 2, scoreB: 0, status: 'Encerrada' },
]);

test('a origem de cada vaga fica explícita', () => {
  const slots = collectQualifiers([grupoA, grupoB], { perGroup: 2, bestThirds: 0, crossing: 'padrao', thirdPlaceMatch: false });

  assert.deepEqual(slots.map((slot) => slot.label), ['1º Grupo A', '1º Grupo B', '2º Grupo A', '2º Grupo B']);
  assert.deepEqual(slots.map((slot) => slot.team), ['A', 'D', 'B', 'E']);
});

test('melhores terceiros entram depois dos classificados diretos', () => {
  const slots = collectQualifiers([grupoA, grupoB], { perGroup: 2, bestThirds: 1, crossing: 'padrao', thirdPlaceMatch: false });

  assert.equal(slots.length, 5);
  assert.equal(slots.at(-1)?.position, 3);
});

test('cruzamento olímpico evita que os primeiros se enfrentem cedo', () => {
  const slots = collectQualifiers([grupoA, grupoB], { perGroup: 2, bestThirds: 0, crossing: 'padrao', thirdPlaceMatch: false });
  const pairs = seedPairs(slots, 'padrao');

  assert.deepEqual(pairs.map((pair) => [pair.entryA, pair.entryB]), [['A', 'E'], ['D', 'B']]);
});

test('cruzamento sequencial enfrenta vizinhos na ordem', () => {
  const slots = collectQualifiers([grupoA, grupoB], { perGroup: 2, bestThirds: 0, crossing: 'padrao', thirdPlaceMatch: false });

  assert.deepEqual(seedPairs(slots, 'sequencial').map((pair) => [pair.entryA, pair.entryB]), [['A', 'D'], ['B', 'E']]);
});

test('chave incompleta distribui bye para os melhores seeds', () => {
  const slots = collectQualifiers([grupoA, grupoB], { perGroup: 2, bestThirds: 1, crossing: 'padrao', thirdPlaceMatch: false });
  const pairs = seedPairs(slots, 'padrao');

  assert.equal(pairs.length, 4);
  assert.deepEqual(byes(pairs), ['A', 'D', 'B']);
  assert.deepEqual(pairs.filter((pair) => pair.entryB).map((pair) => [pair.entryA, pair.entryB]), [['E', slots[4].team]]);
});

test('nomeia a rodada pelo tamanho da chave', () => {
  assert.equal(roundName(2), 'Final');
  assert.equal(roundName(4), 'Semifinal');
  assert.equal(roundName(8), 'Quartas de final');
});

test('descreve o critério de avanço configurado', () => {
  const text = describeAdvancement({ perGroup: 2, bestThirds: 2, crossing: 'padrao', thirdPlaceMatch: true }, 4);

  assert.match(text, /2 equipes avançam por grupo/);
  assert.match(text, /2 melhores terceiros/);
  assert.match(text, /10 classificados/);
  assert.match(text, /disputa de 3º lugar/);
});
