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
