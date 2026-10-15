import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSheet, visibleSetRows } from '../../app/lib/match-result.ts';
import { resolveRegulation } from '../../app/lib/regulation.ts';

const volei = resolveRegulation('Vôlei', { rules: { ...resolveRegulation('Vôlei').base, completion: { mode: 'sets', setsToWin: 2, pointsToWinSet: 25, pointsToWinDecidingSet: 15, minAdvantage: 2 } } as never });
const futsal = resolveRegulation('Futsal');

test('vôlei: 2 sets a 0 com placares válidos', () => {
  const check = checkSheet(volei, { periods: [{ scoreA: 25, scoreB: 18 }, { scoreA: 26, scoreB: 24 }], knockout: false });
  assert.deepEqual(check.ok && [check.scoreA, check.scoreB], [2, 0]);
});

test('vôlei: tie-break a 15 no set decisivo', () => {
  const check = checkSheet(volei, { periods: [{ scoreA: 25, scoreB: 20 }, { scoreA: 18, scoreB: 25 }, { scoreA: 15, scoreB: 13 }], knockout: false });
  assert.ok(check.ok);
});

test('vôlei: recusa set que não fecha, 26-10 e set depois de decidido', () => {
  assert.equal(checkSheet(volei, { periods: [{ scoreA: 25, scoreB: 24 }, { scoreA: 25, scoreB: 10 }], knockout: false }).ok, false);
  assert.equal(checkSheet(volei, { periods: [{ scoreA: 26, scoreB: 10 }, { scoreA: 25, scoreB: 10 }], knockout: false }).ok, false);
  assert.equal(checkSheet(volei, { periods: [{ scoreA: 25, scoreB: 10 }, { scoreA: 25, scoreB: 10 }, { scoreA: 15, scoreB: 10 }], knockout: false }).ok, false);
  assert.equal(checkSheet(volei, { periods: [{ scoreA: 25, scoreB: 10 }], knockout: false }).ok, false);
});

test('vôlei: a folha só mostra o 3º set em 1 × 1', () => {
  assert.equal(visibleSetRows(volei, []), 2);
  assert.equal(visibleSetRows(volei, [{ scoreA: 25, scoreB: 10 }, { scoreA: 25, scoreB: 12 }]), 2);
  assert.equal(visibleSetRows(volei, [{ scoreA: 25, scoreB: 10 }, { scoreA: 12, scoreB: 25 }]), 3);
});

test('futsal: placar final; empate no mata-mata pede desempate', () => {
  const grupo = checkSheet(futsal, { periods: [], scoreA: 2, scoreB: 2, knockout: false });
  assert.ok(grupo.ok && !grupo.needsTiebreak);
  const chave = checkSheet(futsal, { periods: [], scoreA: 2, scoreB: 2, knockout: true });
  assert.ok(chave.ok && chave.needsTiebreak);
});

test('futsal: parciais precisam somar o placar final', () => {
  assert.equal(checkSheet(futsal, { periods: [{ scoreA: 1, scoreB: 0 }, { scoreA: 1, scoreB: 2 }], scoreA: 2, scoreB: 2, knockout: false }).ok, true);
  assert.equal(checkSheet(futsal, { periods: [{ scoreA: 1, scoreB: 0 }], scoreA: 2, scoreB: 2, knockout: false }).ok, false);
});

test('basquete: empate pede o placar com a prorrogação, não um desempate à parte', () => {
  const basquete = resolveRegulation('Basquete');
  const empate = checkSheet(basquete, { periods: [], scoreA: 30, scoreB: 30, knockout: false });
  assert.equal(empate.ok, false);
  assert.ok(checkSheet(basquete, { periods: [], scoreA: 36, scoreB: 34, knockout: false }).ok);
});
