import test from 'node:test';
import assert from 'node:assert/strict';
import { findScheduleConflicts, isBlocking, scheduledDuration, type ScheduledMatch } from '../../app/lib/scheduling-rules.ts';
import { resolveRegulation } from '../../app/lib/regulation.ts';

const futsal = scheduledDuration(resolveRegulation('Futsal'));
const window = { start: '2026-10-12', end: '2026-10-19' };

function existing(overrides: Partial<ScheduledMatch> = {}): ScheduledMatch {
  return { id: 'jogo-1', date: '2026-10-13', time: '19:00', venue: 'Ginásio CIn', discipline: 'Futsal', entryA: 'Alcateia', entryB: 'Cangaceiros', status: 'Agendada', durationMinutes: futsal, ...overrides };
}

function candidate(overrides: Partial<Parameters<typeof findScheduleConflicts>[0]> = {}) {
  return { date: '2026-10-13', time: '19:30', venue: 'Ginásio CIn', discipline: 'Futsal', entryA: 'Caótica', entryB: 'Energizada', durationMinutes: futsal, ...overrides };
}

test('bloqueia dois jogos na mesma quadra em horários sobrepostos', () => {
  const conflicts = findScheduleConflicts(candidate(), [existing()], { window });

  assert.equal(conflicts.some((item) => item.code === 'local-ocupado'), true);
  assert.equal(conflicts.filter(isBlocking).length > 0, true);
});

test('libera a quadra quando o jogo anterior termina e há tempo de troca', () => {
  const conflicts = findScheduleConflicts(candidate({ time: '20:00' }), [existing()], { window });

  assert.deepEqual(conflicts, []);
});

test('impede que a mesma equipe jogue em horários incompatíveis', () => {
  // O jogo anterior termina 19:45; 20:15 deixa apenas 30 min de descanso.
  const semDescanso = findScheduleConflicts(candidate({ entryA: 'Alcateia', time: '20:15' }), [existing()], { window });
  assert.equal(semDescanso.some((item) => item.code === 'equipe-sem-descanso'), true);
  assert.equal(semDescanso.some(isBlocking), false);

  const comDescanso = findScheduleConflicts(candidate({ entryA: 'Alcateia', time: '21:00' }), [existing()], { window });
  assert.deepEqual(comDescanso, []);
});

test('considera partidas do catálogo já existentes na edição', () => {
  const catalogMatch = existing({ id: 'semifinal-1', entryA: 'Caótica', entryB: 'Voraz', venue: 'Quadra 2' });
  const conflicts = findScheduleConflicts(candidate({ venue: 'Quadra 3', time: '19:00' }), [catalogMatch], { window });

  assert.equal(conflicts.some((item) => item.code === 'equipe-ocupada'), true);
});

test('recusa partida fora do período da edição', () => {
  const conflicts = findScheduleConflicts(candidate({ date: '2026-11-02' }), [], { window });

  assert.deepEqual(conflicts.map((item) => item.code), ['fora-da-edicao']);
});

test('partida cancelada ou adiada não ocupa mais a quadra', () => {
  const conflicts = findScheduleConflicts(candidate(), [existing({ status: 'Cancelada' }), existing({ id: 'jogo-2', status: 'Adiada' })], { window });

  assert.deepEqual(conflicts, []);
});

test('acusa confronto repetido no mesmo horário', () => {
  const conflicts = findScheduleConflicts(candidate({ entryA: 'Cangaceiros', entryB: 'Alcateia', time: '19:00' }), [existing()], { window });

  assert.equal(conflicts[0].code, 'confronto-duplicado');
});
