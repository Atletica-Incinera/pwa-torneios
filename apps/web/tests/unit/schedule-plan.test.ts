import assert from 'node:assert/strict';
import test from 'node:test';
import { planSchedule, roundRobinRounds, suggestedInterval } from '../../app/lib/schedule-plan.ts';

test('todos contra todos em rodadas: cada equipe joga uma vez por rodada', () => {
  const rounds = roundRobinRounds(['A', 'B', 'C', 'D']);
  assert.equal(rounds.length, 3);
  for (const round of rounds) {
    const teams = round.flat();
    assert.equal(new Set(teams).size, teams.length);
  }
  const pairs = rounds.flat().map((pair) => [...pair].sort().join('-'));
  assert.equal(new Set(pairs).size, 6);
});

test('número ímpar de equipes ganha folga, sem confronto fantasma', () => {
  const rounds = roundRobinRounds(['A', 'B', 'C']);
  assert.equal(rounds.flat().length, 3);
  assert.ok(rounds.flat().flat().every((team) => ['A', 'B', 'C'].includes(team)));
});

test('uma quadra: jogos em sequência, sem dois no mesmo horário', () => {
  const plan = planSchedule({ buckets: [{ name: 'Grupo A', teams: ['A', 'B', 'C', 'D'] }], startDate: '2026-10-15', startTime: '14:00', intervalMinutes: 55, venues: ['Ginásio CIn'] });
  assert.deepEqual(plan.map((item) => item.time), ['14:00', '14:55', '15:50', '16:45', '17:40', '18:35']);
  assert.ok(plan.every((item) => item.venue === 'Ginásio CIn'));
});

test('ninguém joga duas vezes seguidas quando há outro grupo para alternar', () => {
  const plan = planSchedule({ buckets: [{ name: 'Grupo A', teams: ['A1', 'A2', 'A3', 'A4'] }, { name: 'Grupo B', teams: ['B1', 'B2', 'B3', 'B4'] }], startDate: '2026-10-15', startTime: '09:00', intervalMinutes: 60, venues: ['Quadra 1'] });
  for (let index = 1; index < plan.length; index += 1) {
    const before = [plan[index - 1].entryA, plan[index - 1].entryB];
    assert.ok(!before.includes(plan[index].entryA) && !before.includes(plan[index].entryB), `jogo ${index + 1} repete equipe do anterior`);
  }
});

test('duas quadras usam o mesmo horário sem pôr uma equipe em dois jogos', () => {
  const plan = planSchedule({ buckets: [{ name: 'Grupo A', teams: ['A', 'B', 'C', 'D'] }], startDate: '2026-10-15', startTime: '09:00', intervalMinutes: 60, venues: ['Quadra 1', 'Quadra 2'] });
  const bySlot = new Map<string, string[]>();
  for (const item of plan) bySlot.set(`${item.date} ${item.time}`, [...(bySlot.get(`${item.date} ${item.time}`) ?? []), item.entryA, item.entryB]);
  for (const teams of bySlot.values()) assert.equal(new Set(teams).size, teams.length);
  assert.equal(bySlot.size, 3);
});

test('passado o último horário do dia, continua no dia seguinte', () => {
  const plan = planSchedule({ buckets: [{ name: 'G', teams: ['A', 'B', 'C', 'D'] }], startDate: '2026-10-15', startTime: '20:00', intervalMinutes: 60, venues: [], lastStart: '21:00' });
  assert.deepEqual(plan.map((item) => `${item.date} ${item.time}`), ['2026-10-15 20:00', '2026-10-15 21:00', '2026-10-16 20:00', '2026-10-16 21:00', '2026-10-17 20:00', '2026-10-17 21:00']);
  assert.ok(plan.every((item) => item.venue === 'A definir'));
});

test('intervalo sugerido sai do regulamento', () => {
  assert.equal(suggestedInterval({ periodCount: 2, periodDurationMinutes: 20 }), 55);
  assert.equal(suggestedInterval({ completion: { mode: 'sets', setsToWin: 2 } }), 50);
});
