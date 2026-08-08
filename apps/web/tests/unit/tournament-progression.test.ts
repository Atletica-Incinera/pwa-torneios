import test from 'node:test';
import assert from 'node:assert/strict';
import { initialFrontendState } from '../../app/lib/frontend-state.ts';
import { progressTournament } from '../../app/lib/tournament-progression.ts';

test('gera semifinais automaticamente após a conclusão dos grupos', () => {
  const tournamentId = 'cup';
  const state = {
    ...initialFrontendState,
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
