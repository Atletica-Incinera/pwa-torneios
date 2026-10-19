import assert from 'node:assert/strict';
import test from 'node:test';
import { matchSituation, visibleScore } from '../../app/lib/match-situation.ts';

const now = new Date('2026-10-15T15:00:00');

test('jogo futuro é Próximo e não tem placar', () => {
  const situation = matchSituation({ status: 'Agendada', date: '2026-10-15', time: '16:00', durationMinutes: 40 }, now);
  assert.deepEqual(situation, { label: 'Próximo', tone: 'blue', showScore: false });
});

test('passou da hora e ainda cabe no tempo de jogo: Atrasado', () => {
  assert.equal(matchSituation({ status: 'Agendada', date: '2026-10-15', time: '14:30', durationMinutes: 40 }, now).label, 'Atrasado');
});

test('passou do fim previsto mais a tolerância: Sem resultado', () => {
  assert.equal(matchSituation({ status: 'Agendada', date: '2026-10-15', time: '13:00', durationMinutes: 40 }, now).label, 'Sem resultado');
  assert.equal(matchSituation({ status: 'Agendada', date: '2026-10-12', time: '20:00' }, now).label, 'Sem resultado');
});

test('estados finais e interrompidos falam por si', () => {
  assert.equal(matchSituation({ status: 'Ao vivo' }, now).label, 'Ao vivo');
  assert.equal(matchSituation({ status: 'W.O.' }, now).label, 'W.O.');
  assert.equal(matchSituation({ status: 'Cancelada' }, now).label, 'Cancelado');
  assert.equal(matchSituation({ status: 'Adiada' }, now).label, 'Adiado');
  assert.equal(matchSituation({ status: 'Agendada', date: 'A definir' }, now).label, 'A agendar');
});

test('placar só depois do início: a API manda 0 para jogo que não começou', () => {
  assert.equal(visibleScore('Agendada', 0), null);
  assert.equal(visibleScore('Ao vivo', 2), 2);
  assert.equal(visibleScore('Encerrada', undefined), 0);
});

test('ao vivo esquecido vira "Sem atualização" depois de horas do fim previsto', async () => {
  const { matchSituation } = await import('../../app/lib/match-situation.ts');
  const now = new Date('2026-10-15T15:00:00');
  const preso = matchSituation({ status: 'Ao vivo', date: '2026-10-12', time: '09:20', durationMinutes: 40 }, now);
  assert.equal(preso.label, 'Sem atualização');
  assert.equal(preso.stale, true);
  assert.equal(preso.showScore, true);
  const atrasado = matchSituation({ status: 'Ao vivo', date: '2026-10-15', time: '12:30', durationMinutes: 40 }, now);
  assert.equal(atrasado.label, 'Ao vivo');
  assert.equal(atrasado.stale, undefined);
});

test('jogo agendado de dias atrás sem resultado fica marcado como vencido', async () => {
  const { matchSituation } = await import('../../app/lib/match-situation.ts');
  const now = new Date('2026-10-15T15:00:00');
  assert.equal(matchSituation({ status: 'Agendada', date: '2026-10-09', time: '19:00', durationMinutes: 40 }, now).overdue, true);
  assert.equal(matchSituation({ status: 'Agendada', date: '2026-10-16', time: '09:00', durationMinutes: 40 }, now).overdue, undefined);
});
