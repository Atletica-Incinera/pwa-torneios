import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryPodium } from '../../app/lib/podium.ts';

const row = (entryName: string, rank: number) => ({ entryId: entryName, entryName, rank, played: 2, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, points: 0 });
const liga = (status: string) => ({
  tournaments: { t: { status, participants: ['A', 'B', 'C'], seeds: {}, assignments: {}, generated: true, phases: [{ id: 'p', name: 'Liga', format: 'Liga', groups: [], qualifiers: 0, standings: [row('B', 2), row('A', 1), row('C', 3)] }] } },
  matches: { 't-1': { tournamentId: 't', status: 'Encerrada', entryA: 'A', entryB: 'B', scoreA: 1, scoreB: 0 } },
}) as never;

test('liga encerrada: pódio pela tabela oficial', () => {
  assert.deepEqual(categoryPodium(liga('Encerrado'), 't'), { champion: 'A', vice: 'B', third: 'C', source: 'tabela' });
});

test('liga em andamento: ainda sem pódio', () => {
  assert.equal(categoryPodium(liga('Em andamento'), 't'), null);
});

test('mata-mata: campeã e vice da final, 3º da disputa de 3º lugar', () => {
  const state = {
    tournaments: { t: { status: 'Encerrado', participants: [], seeds: {}, assignments: {}, generated: true, phases: [] } },
    matches: {
      't-advanced-r1-1': { tournamentId: 't', status: 'Encerrada', entryA: 'A', entryB: 'C', scoreA: 2, scoreB: 0 },
      't-advanced-r1-2': { tournamentId: 't', status: 'Encerrada', entryA: 'B', entryB: 'D', scoreA: 2, scoreB: 1 },
      't-advanced-r2-1': { tournamentId: 't', status: 'Encerrada', entryA: 'A', entryB: 'B', scoreA: 1, scoreB: 3 },
      't-advanced-third': { tournamentId: 't', status: 'Encerrada', entryA: 'C', entryB: 'D', scoreA: 0, scoreB: 1 },
    },
  } as never;
  assert.deepEqual(categoryPodium(state, 't'), { champion: 'B', vice: 'A', third: 'D', source: 'final' });
});

test('vários grupos ou mata-mata não lançado: sem pódio inventado', () => {
  const base = { participants: [], seeds: {}, assignments: {}, generated: true, status: 'Encerrado' };
  const grupos = { tournaments: { t: { ...base, phases: [{ id: 'g', name: 'Grupos', format: 'Grupos', groups: ['A', 'B'], qualifiers: 1, standings: [row('X', 1), row('Y', 1)] }] } }, matches: {} } as never;
  assert.equal(categoryPodium(grupos, 't'), null);
  const semChave = { tournaments: { t: { ...base, phases: [{ id: 'g', name: 'Grupo', format: 'Grupos', groups: ['A'], qualifiers: 2, standings: [row('X', 1), row('Y', 2)] }, { id: 'k', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 }] } }, matches: {} } as never;
  assert.equal(categoryPodium(semChave, 't'), null);
});
