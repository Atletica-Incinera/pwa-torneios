import test from 'node:test';
import assert from 'node:assert/strict';
import { seededFrontendState, type FrontendState, type OverallAwardState } from '../../app/lib/frontend-state.ts';
import { activeAwards, computeOverallRanking, hasAward, isRankingClosed, suggestAutomaticAwards } from '../../app/lib/overall-ranking.ts';
import { isOfficialResult, isPublicTournamentStatus } from '../../app/lib/publication.ts';

const editionId = 'intereng-2026';

function award(overrides: Partial<OverallAwardState> = {}): OverallAwardState {
  return { id: 'award-1', editionId, teamId: 'alcateia', discipline: 'Futsal', metricId: 'metric-champion', points: 10, createdAt: '2026-10-19T12:00:00.000Z', ...overrides };
}

function withAwards(awards: OverallAwardState[]): FrontendState {
  return { ...seededFrontendState, overallRanking: { ...seededFrontendState.overallRanking, awards } };
}

test('bonificação estornada some do ranking mas fica no histórico', () => {
  const state = withAwards([award(), award({ id: 'award-2', metricId: 'metric-participation', points: 1, revokedAt: '2026-10-20T10:00:00.000Z', revokedBy: 'Ana', revokeReason: 'Duplicidade' })]);

  assert.equal(activeAwards(state, editionId).length, 1);
  assert.equal(state.overallRanking.awards.length, 2);
  assert.equal(computeOverallRanking(state, [{ id: 'alcateia', name: 'Alcateia' }], editionId)[0].points, 10);
});

test('a mesma métrica não pode ser lançada duas vezes na mesma modalidade', () => {
  const awards = [award()];

  assert.equal(hasAward(awards, 'alcateia', 'Futsal', 'metric-champion'), true);
  assert.equal(hasAward(awards, 'alcateia', 'Vôlei', 'metric-champion'), false);
  // Depois de estornada, a métrica volta a ficar disponível para novo lançamento.
  assert.equal(hasAward([award({ revokedAt: '2026-10-20T10:00:00.000Z' })], 'alcateia', 'Futsal', 'metric-champion'), false);
});

test('empate no ranking geral compartilha a mesma posição', () => {
  const state = withAwards([award(), award({ id: 'award-2', teamId: 'caotica' })]);
  const ranking = computeOverallRanking(state, [{ id: 'alcateia', name: 'Alcateia' }, { id: 'caotica', name: 'Caótica' }, { id: 'voraz', name: 'Voraz' }], editionId);

  assert.deepEqual(ranking.map((row) => [row.name, row.rank]), [['Alcateia', 1], ['Caótica', 1], ['Voraz', 3]]);
});

test('pontos automáticos saem do pódio das disputas encerradas', () => {
  const state: FrontendState = {
    ...seededFrontendState,
    tournaments: {
      'futsal-m': { status: 'Encerrado', editionId, discipline: 'Futsal', name: 'Futsal Masculino', participants: ['Alcateia', 'Cangaceiros', 'Caótica', 'Voraz'], seeds: {}, phases: [{ id: 'k', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 }], assignments: {}, generated: true },
    },
    matches: {
      'futsal-m-advanced-r1-1': { created: true, tournamentId: 'futsal-m', entryA: 'Alcateia', entryB: 'Caótica', scoreA: 2, scoreB: 1, status: 'Encerrada', phase: 'Semifinal' },
      'futsal-m-advanced-r1-2': { created: true, tournamentId: 'futsal-m', entryA: 'Cangaceiros', entryB: 'Voraz', scoreA: 3, scoreB: 0, status: 'Encerrada', phase: 'Semifinal' },
      'futsal-m-advanced-r2-1': { created: true, tournamentId: 'futsal-m', entryA: 'Alcateia', entryB: 'Cangaceiros', scoreA: 1, scoreB: 0, status: 'Encerrada', phase: 'Final' },
      'futsal-m-advanced-third': { created: true, tournamentId: 'futsal-m', entryA: 'Caótica', entryB: 'Voraz', scoreA: 2, scoreB: 0, status: 'Encerrada', phase: 'Disputa de 3º lugar' },
    },
  };
  const suggestions = suggestAutomaticAwards(state, editionId);
  const byMetric = (id: string) => suggestions.filter((item) => item.metric.id === id).map((item) => item.teamName);

  assert.deepEqual(byMetric('metric-champion'), ['Alcateia']);
  assert.deepEqual(byMetric('metric-runner-up'), ['Cangaceiros']);
  assert.deepEqual(byMetric('metric-third'), ['Caótica']);
  assert.equal(byMetric('metric-participation').length, 4);

  // Já lançado não volta a ser sugerido.
  const applied = { ...state, overallRanking: { ...state.overallRanking, awards: [{ id: 'a', editionId, teamId: 'alcateia', discipline: 'Futsal', metricId: 'metric-champion', points: 10, createdAt: '2026-10-19T12:00:00.000Z' }] } };
  assert.deepEqual(suggestAutomaticAwards(applied, editionId).filter((item) => item.metric.id === 'metric-champion'), []);
});

test('disputa não encerrada não gera bonificação automática', () => {
  const state: FrontendState = {
    ...seededFrontendState,
    tournaments: { cup: { status: 'Em andamento', editionId, discipline: 'Futsal', participants: ['A', 'B'], seeds: {}, phases: [], assignments: {}, generated: true } },
    matches: { 'cup-advanced-r1-1': { created: true, tournamentId: 'cup', entryA: 'A', entryB: 'B', scoreA: 1, scoreB: 0, status: 'Encerrada', phase: 'Final' } },
  };

  assert.deepEqual(suggestAutomaticAwards(state, editionId), []);
});

test('fechamento do ranking marca a edição como oficial', () => {
  const closed: FrontendState = { ...seededFrontendState, overallRanking: { ...seededFrontendState.overallRanking, closures: [{ editionId, at: '2026-10-20T12:00:00.000Z', actor: 'Ana' }] } };

  assert.equal(isRankingClosed(seededFrontendState, editionId), false);
  assert.equal(isRankingClosed(closed, editionId), true);
  assert.equal(isRankingClosed(closed, 'intereng-2025'), false);
});

test('a área pública só enxerga disputas publicadas e resultados oficiais', () => {
  assert.equal(isPublicTournamentStatus('Rascunho'), false);
  assert.equal(isPublicTournamentStatus('Arquivado'), false);
  assert.equal(isPublicTournamentStatus('Publicado'), true);
  assert.equal(isPublicTournamentStatus('Encerrado'), true);
  // Rótulo legado do catálogo inicial: continua visível.
  assert.equal(isPublicTournamentStatus('Agendado'), true);
  assert.equal(isOfficialResult('Encerrada'), true);
  assert.equal(isOfficialResult('W.O.'), true);
  assert.equal(isOfficialResult('Ao vivo'), false);
});
