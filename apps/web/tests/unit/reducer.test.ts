import test from 'node:test';
import assert from 'node:assert/strict';
import { initialFrontendState } from '../../app/lib/frontend-state.ts';
import { applyAction } from '../../app/lib/repositories/reducer.ts';

const context = { actor: 'Ana Coordenadora' };

test('a ação aplica a mudança e registra a auditoria com autor e horário', () => {
  const next = applyAction(initialFrontendState, {
    type: 'team/create',
    payload: { id: 'aurora', team: { name: 'Aurora', created: true } },
    audit: { action: 'Equipe cadastrada', entity: 'Aurora', after: 'Ativa' },
  }, context);

  assert.equal(next.teams.aurora?.name, 'Aurora');
  assert.equal(next.audit.length, 1);
  assert.equal(next.audit[0].actor, 'Ana Coordenadora');
  assert.equal(next.audit[0].action, 'Equipe cadastrada');
  assert.equal(Number.isNaN(Date.parse(next.audit[0].at)), false);
  assert.match(next.audit[0].id, /^audit-/);
});

test('o registro mais recente entra no topo da auditoria', () => {
  const first = applyAction(initialFrontendState, { type: 'competition/rename', payload: { id: 'jogos-engenharia', name: 'InterEng' }, audit: { action: 'Primeira', entity: 'X' } }, context);
  const second = applyAction(first, { type: 'competition/rename', payload: { id: 'jogos-engenharia', name: 'InterEng' }, audit: { action: 'Segunda', entity: 'X' } }, context);

  assert.deepEqual(second.audit.map((item) => item.action), ['Segunda', 'Primeira']);
});

test('ação sem mudança e sem auditoria devolve o mesmo estado, sem gravar', () => {
  // Liberar uma trava que não é sua não muda nada — e não deve gravar nada.
  const untouched = applyAction(initialFrontendState, { type: 'match/releaseOperator', payload: { id: 'jogo', operatorId: 'op-1' } }, context);

  // Mesma referência: o adaptador usa isso para não escrever nem acordar as telas.
  assert.equal(untouched, initialFrontendState);
});

test('ação sem mudança mas com auditoria ainda registra', () => {
  const next = applyAction(initialFrontendState, { type: 'match/releaseOperator', payload: { id: 'jogo', operatorId: 'op-1' }, audit: { action: 'Conferência', entity: 'Edição' } }, context);

  assert.notEqual(next, initialFrontendState);
  assert.equal(next.audit.length, 1);
});

test('a ação não altera o estado recebido', () => {
  const before = JSON.stringify(initialFrontendState);
  applyAction(initialFrontendState, {
    type: 'staff/upsert',
    payload: { email: 'novo@ufpe.br', member: { name: 'Novo', email: 'novo@ufpe.br', initials: 'NV', role: 'Gestor de modalidade', scope: 'Futsal' } },
    audit: { action: 'Acesso concedido', entity: 'Novo' },
  }, context);

  assert.equal(JSON.stringify(initialFrontendState), before);
});

test('registrar evento coloca o mais recente no topo e grava a parcial do set', () => {
  const base = { ...initialFrontendState, matches: { jogo: { entryA: 'A', entryB: 'B', events: [], periodResults: [] } } };
  const event = { id: 'ev-1', at: '2026-10-13T20:10:00.000Z', elapsedSeconds: 12, type: 'Ponto', detail: 'A', side: 'home' as const, scoreA: 1, scoreB: 0 };
  const next = applyAction(base, {
    type: 'match/registerEvent',
    payload: { id: 'jogo', event, patch: { status: 'Ao vivo', scoreA: 1, scoreB: 0 }, periodResult: { period: 1, scoreA: 25, scoreB: 23 } },
    audit: { action: 'Ponto registrado', entity: 'A' },
  }, context);

  assert.equal(next.matches.jogo.events?.[0].id, 'ev-1');
  assert.equal(next.matches.jogo.scoreA, 1);
  assert.deepEqual(next.matches.jogo.periodResults, [{ period: 1, scoreA: 25, scoreB: 23 }]);
});

test('desfazer remove o evento, restaura o placar e apaga a parcial do set fechado', () => {
  const base = {
    ...initialFrontendState,
    matches: { jogo: { scoreA: 1, scoreB: 0, currentPeriod: 2, periodScoreA: 0, periodScoreB: 0, periodResults: [{ period: 1, scoreA: 25, scoreB: 23 }], events: [{ id: 'ev-1', at: '', elapsedSeconds: 0, type: 'Ponto', detail: 'A', side: 'home' as const, scoreA: 1, scoreB: 0 }] } },
  };
  const next = applyAction(base, {
    type: 'match/undoEvent',
    payload: { id: 'jogo', eventId: 'ev-1', restore: { scoreA: 0, scoreB: 0, periodScoreA: 24, periodScoreB: 23, currentPeriod: 1 } },
    audit: { action: 'Último evento desfeito', entity: 'A × B' },
  }, context);

  assert.deepEqual(next.matches.jogo.events, []);
  assert.equal(next.matches.jogo.scoreA, 0);
  assert.equal(next.matches.jogo.currentPeriod, 1);
  assert.deepEqual(next.matches.jogo.periodResults, []);
});

test('a trava do operador respeita quem já está operando, e força só quando pedido', () => {
  const agora = new Date().toISOString();
  const ocupado = { ...initialFrontendState, matches: { jogo: { operatorId: 'op-2', operatorName: 'Bruno', operatorHeartbeat: agora } } };

  const semForce = applyAction(ocupado, { type: 'match/claimOperator', payload: { id: 'jogo', operatorId: 'op-1', operatorName: 'Ana' } }, context);
  assert.equal(semForce, ocupado);

  const comForce = applyAction(ocupado, { type: 'match/claimOperator', payload: { id: 'jogo', operatorId: 'op-1', operatorName: 'Ana', force: true } }, context);
  assert.equal(comForce.matches.jogo.operatorId, 'op-1');
});

test('liberar operação só vale para quem detém a trava', () => {
  const ocupado = { ...initialFrontendState, matches: { jogo: { operatorId: 'op-2', operatorName: 'Bruno', operatorHeartbeat: new Date().toISOString() } } };

  assert.equal(applyAction(ocupado, { type: 'match/releaseOperator', payload: { id: 'jogo', operatorId: 'op-1' } }, context), ocupado);
  assert.equal(applyAction(ocupado, { type: 'match/releaseOperator', payload: { id: 'jogo', operatorId: 'op-2' } }, context).matches.jogo.operatorId, undefined);
});

test('encerrar a partida dispara a cascata do chaveamento', () => {
  const base = {
    ...initialFrontendState,
    tournaments: { cup: { status: 'Em andamento' as const, editionId: 'intereng-2026', discipline: 'Futsal', participants: ['A', 'B'], seeds: {}, assignments: {}, generated: true, phases: [{ id: 'k', name: 'Mata-mata', format: 'Mata-mata' as const, groups: [], qualifiers: 1 }] } },
    matches: { 'cup-advanced-r1-1': { created: true, tournamentId: 'cup', entryA: 'A', entryB: 'B', status: 'Ao vivo' as const, phase: 'Final', date: '2026-10-14' } },
  };
  const next = applyAction(base, {
    type: 'match/finish',
    payload: { id: 'cup-advanced-r1-1', patch: { status: 'Encerrada', scoreA: 2, scoreB: 1 } },
    audit: { action: 'Partida encerrada', entity: 'A × B' },
  }, context);

  // Com o campeão definido, a disputa é encerrada pela própria ação.
  assert.equal(next.matches['cup-advanced-r1-1'].status, 'Encerrada');
  assert.equal(next.tournaments.cup.status, 'Encerrado');
});

test('estornar bonificação preserva o lançamento com motivo e responsável', () => {
  const award = { id: 'award-1', editionId: 'intereng-2026', teamId: 'alcateia', discipline: 'Futsal', metricId: 'metric-1', points: 10, createdAt: '2026-10-13T20:00:00.000Z', origin: 'manual' as const };
  const lancado = applyAction(initialFrontendState, { type: 'ranking/addAwards', payload: { awards: [award] } }, context);
  const next = applyAction(lancado, {
    type: 'ranking/revokeAward',
    payload: { id: 'award-1', revokedAt: '2026-10-14T09:00:00.000Z', revokedBy: 'Ana Coordenadora', revokeReason: 'lançamento em duplicidade' },
    audit: { action: 'Pontuação estornada no ranking geral', entity: 'Alcateia', reason: 'lançamento em duplicidade' },
  }, context);

  assert.equal(next.overallRanking.awards.length, 1);
  assert.equal(next.overallRanking.awards[0].points, 10);
  assert.equal(next.overallRanking.awards[0].revokeReason, 'lançamento em duplicidade');
});

test('fechar e reabrir o ranking geral vale só para a edição informada', () => {
  const fechado = applyAction(initialFrontendState, { type: 'ranking/close', payload: { closure: { editionId: 'intereng-2026', at: '2026-10-20T12:00:00.000Z', actor: 'Ana Coordenadora' } } }, context);
  assert.equal(fechado.overallRanking.closures?.length, 1);

  const outraEdicao = applyAction(fechado, { type: 'ranking/reopen', payload: { editionId: 'intereng-2025' } }, context);
  assert.equal(outraEdicao.overallRanking.closures?.length, 1);

  const reaberto = applyAction(fechado, { type: 'ranking/reopen', payload: { editionId: 'intereng-2026' } }, context);
  assert.equal(reaberto.overallRanking.closures?.length, 0);
});

test('ativar torneio ou edição é exclusivo: o anterior deixa de ser o contexto', () => {
  const base = {
    ...initialFrontendState,
    competitions: [{ id: 'jogos-engenharia', name: 'InterEng', slug: 'intereng', active: true }, { id: 'copa', name: 'Copa', slug: 'copa', active: false }],
    editions: [{ id: 'e-2026', name: '2026', year: 2026, start: '2026-10-01', end: '2026-10-30', status: 'Em andamento' as const, active: true }, { id: 'e-2027', name: '2027', year: 2027, start: '2027-10-01', end: '2027-10-30', status: 'Planejamento' as const, active: false }],
  };

  const torneio = applyAction(base, { type: 'competition/activate', payload: { id: 'copa' } }, context);
  assert.deepEqual(torneio.competitions.map((item) => item.active), [false, true]);

  const edicao = applyAction(base, { type: 'edition/activate', payload: { id: 'e-2027' } }, context);
  assert.deepEqual(edicao.editions.map((item) => item.active), [false, true]);
});

test('criar torneio traz junto a primeira edição', () => {
  const next = applyAction(initialFrontendState, {
    type: 'competition/create',
    payload: {
      competition: { id: 'copa', name: 'Copa', slug: 'copa', active: false },
      edition: { id: 'e-2027', name: '2027', year: 2027, start: '2027-10-01', end: '2027-10-30', status: 'Planejamento', active: false, competitionId: 'copa' },
    },
    audit: { action: 'Torneio criado', entity: 'Copa' },
  }, context);

  assert.equal(next.competitions.at(-1)?.slug, 'copa');
  assert.equal(next.editions[0].competitionId, 'copa');
});
