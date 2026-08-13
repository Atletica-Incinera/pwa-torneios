import test from 'node:test';
import assert from 'node:assert/strict';
import { seededFrontendState } from '@atletica-incinera/intereng-contract/state';
import { progressTournament } from '@atletica-incinera/intereng-contract/rules';

test('gera semifinais automaticamente após a conclusão dos grupos', () => {
  const tournamentId = 'cup';
  const state = {
    ...seededFrontendState,
    tournaments: { [tournamentId]: { status: 'Em andamento' as const, participants: ['A', 'B', 'C', 'D'], seeds: { A: 1, B: 2, C: 3, D: 4 }, phases: [{ id: 'g', name: 'Grupos', format: 'Grupos' as const, groups: ['Grupo A', 'Grupo B'], qualifiers: 2 }, { id: 'k', name: 'Mata-mata', format: 'Mata-mata' as const, groups: [], qualifiers: 1 }], assignments: { A: 'Grupo A', B: 'Grupo A', C: 'Grupo B', D: 'Grupo B' }, generated: true, discipline: 'Futsal' } },
    matches: {
      'cup-generated-1': { created: true, tournamentId, entryA: 'A', entryB: 'B', scoreA: 2, scoreB: 0, status: 'Encerrada' as const, phase: 'Grupo A', date: '2026-10-12' },
      'cup-generated-2': { created: true, tournamentId, entryA: 'C', entryB: 'D', scoreA: 1, scoreB: 0, status: 'Encerrada' as const, phase: 'Grupo B', date: '2026-10-12' },
    },
  };
  const progressed = progressTournament(state, tournamentId);
  const next = Object.values(progressed.matches).filter((match) => match.phase === 'Semifinal');
  assert.equal(next.length, 2);
  assert.deepEqual(next.map((match) => [match.entryA, match.entryB]), [['A', 'D'], ['C', 'B']]);
  assert.equal(next[0]?.date, '2026-10-13');
});

function knockoutState(overrides: Partial<Parameters<typeof progressTournament>[0]> = {}) {
  const tournamentId = 'cup';
  return {
    ...seededFrontendState,
    tournaments: {
      [tournamentId]: {
        status: 'Em andamento' as const,
        participants: ['A', 'B', 'C', 'D'],
        seeds: { A: 1, B: 2, C: 3, D: 4 },
        phases: [{ id: 'k', name: 'Mata-mata', format: 'Mata-mata' as const, groups: [], qualifiers: 1 }],
        assignments: {},
        generated: true,
        discipline: 'Futsal',
        advancement: { perGroup: 2, bestThirds: 0, crossing: 'padrao' as const, thirdPlaceMatch: true },
      },
    },
    ...overrides,
  };
}

test('sem fase de grupos, o chaveamento sai direto dos seeds', () => {
  const progressed = progressTournament(knockoutState(), 'cup');
  const created = Object.entries(progressed.matches).filter(([id]) => id.startsWith('cup-advanced-r1-'));

  assert.deepEqual(created.map(([, match]) => [match.entryA, match.entryB]), [['A', 'D'], ['B', 'C']]);
  assert.equal(created[0][1].phase, 'Semifinal');
});

test('empate em mata-mata sem desempate registrado interrompe a progressão', () => {
  const base = progressTournament(knockoutState(), 'cup');
  const drawn = {
    ...base,
    matches: {
      'cup-advanced-r1-1': { ...base.matches['cup-advanced-r1-1'], status: 'Encerrada' as const, scoreA: 1, scoreB: 1 },
      'cup-advanced-r1-2': { ...base.matches['cup-advanced-r1-2'], status: 'Encerrada' as const, scoreA: 2, scoreB: 0 },
    },
  };

  assert.deepEqual(Object.keys(progressTournament(drawn, 'cup').matches), Object.keys(drawn.matches));
});

test('desempate registrado libera a final e cria a disputa de terceiro lugar', () => {
  const base = progressTournament(knockoutState(), 'cup');
  const resolved = {
    ...base,
    matches: {
      'cup-advanced-r1-1': { ...base.matches['cup-advanced-r1-1'], status: 'Encerrada' as const, scoreA: 1, scoreB: 1, tiebreak: { method: 'penaltis' as const, label: 'Pênaltis', scoreA: 4, scoreB: 2, winner: 'A', reason: 'Decidido nos pênaltis', decidedBy: 'Ana', at: '2026-10-13T22:00:00.000Z' } },
      'cup-advanced-r1-2': { ...base.matches['cup-advanced-r1-2'], status: 'Encerrada' as const, scoreA: 2, scoreB: 0 },
    },
  };
  const progressed = progressTournament(resolved, 'cup');

  assert.deepEqual([progressed.matches['cup-advanced-r2-1'].entryA, progressed.matches['cup-advanced-r2-1'].entryB], ['A', 'B']);
  assert.equal(progressed.matches['cup-advanced-r2-1'].phase, 'Final');
  assert.deepEqual([progressed.matches['cup-advanced-third'].entryA, progressed.matches['cup-advanced-third'].entryB], ['D', 'C']);
});

test('equipe com bye avança sem jogar e entra na rodada seguinte', () => {
  const state = {
    ...seededFrontendState,
    // Sem a agenda semeada: o teste olha só os confrontos que a chave gera.
    matches: {},
    tournaments: {
      cup: {
        status: 'Em andamento' as const,
        participants: ['A', 'B', 'C'],
        seeds: { A: 1, B: 2, C: 3 },
        phases: [{ id: 'k', name: 'Mata-mata', format: 'Mata-mata' as const, groups: [], qualifiers: 1 }],
        assignments: {},
        generated: true,
        discipline: 'Futsal',
        advancement: { perGroup: 2, bestThirds: 0, crossing: 'padrao' as const, thirdPlaceMatch: false },
      },
    },
  };
  const first = progressTournament(state, 'cup');

  assert.deepEqual(first.tournaments.cup.byes, { '1': 'A' });
  assert.deepEqual(Object.keys(first.matches), ['cup-advanced-r1-2']);

  const played = { ...first, matches: { 'cup-advanced-r1-2': { ...first.matches['cup-advanced-r1-2'], status: 'Encerrada' as const, scoreA: 3, scoreB: 1 } } };
  const second = progressTournament(played, 'cup');

  assert.deepEqual([second.matches['cup-advanced-r2-1'].entryA, second.matches['cup-advanced-r2-1'].entryB], ['A', 'B']);
  assert.equal(second.matches['cup-advanced-r2-1'].phase, 'Final');
});

test('a disputa vira Encerrado quando a final e o terceiro lugar terminam', () => {
  const state = {
    ...seededFrontendState,
    tournaments: {
      cup: {
        status: 'Em andamento' as const,
        participants: ['A', 'B'],
        seeds: { A: 1, B: 2 },
        phases: [{ id: 'k', name: 'Mata-mata', format: 'Mata-mata' as const, groups: [], qualifiers: 1 }],
        assignments: {},
        generated: true,
        discipline: 'Futsal',
      },
    },
    matches: {
      'cup-advanced-r1-1': { created: true, tournamentId: 'cup', entryA: 'A', entryB: 'B', scoreA: 2, scoreB: 1, status: 'Encerrada' as const, phase: 'Final', date: '2026-10-14' },
    },
  };

  assert.equal(progressTournament(state, 'cup').tournaments.cup.status, 'Encerrado');
});
