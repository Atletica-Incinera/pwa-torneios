import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAgendaDate, moveDateKey, resolveMatchDate, toDateKey } from '../../app/lib/date-utils.ts';

test('converte datas sem depender de UTC', () => {
  assert.equal(toDateKey(new Date(2026, 7, 8, 23, 30)), '2026-08-08');
  assert.equal(moveDateKey('2026-12-31', 1), '2027-01-01');
});

test('resolve rótulos relativos da agenda', () => {
  const today = new Date(2026, 7, 8, 12);
  assert.equal(resolveMatchDate('Hoje', today), '2026-08-08');
  assert.equal(resolveMatchDate('Amanhã', today), '2026-08-09');
  assert.equal(formatAgendaDate('2026-08-07', '2026-08-08').label, 'ONTEM');
});
