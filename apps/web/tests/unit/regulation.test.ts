import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRegulationRule, describeCompletion, estimatedMatchMinutes, regulationFromRule, resolveRegulation, setTarget } from '../../app/lib/regulation.ts';

test('basquete pontua 1, 2 e 3 por ação e não admite empate', () => {
  const regulation = resolveRegulation('Basquete');

  assert.deepEqual(regulation.scoring.map((item) => item.points), [1, 2, 3]);
  assert.equal(regulation.completion.mode, 'periods');
  assert.equal(regulation.completion.mode === 'periods' && regulation.completion.allowDraw, false);
  assert.equal(regulation.standings.win, 2);
  assert.equal(regulation.standings.loss, 1);
});

test('vôlei encerra por sets, com set decisivo mais curto', () => {
  const regulation = resolveRegulation('Vôlei');

  assert.equal(regulation.completion.mode, 'sets');
  assert.equal(setTarget(regulation, 1), 25);
  assert.equal(setTarget(regulation, 5), 15);
  assert.match(describeCompletion(regulation), /Melhor de 5 sets/);
});

test('futevôlei usa sets e admite até duas duplas por atlética', () => {
  const regulation = resolveRegulation('Futevôlei');
  assert.equal(regulation.completion.mode, 'sets');
  assert.equal(setTarget(regulation, 1), 18);
  assert.equal(setTarget(regulation, 3), 15);
  assert.deepEqual([regulation.roster.min, regulation.roster.max], [2, 4]);
  const custom = regulationFromRule('Futevôlei', { ...defaultRegulationRule('Futevôlei'), roster: { required: false, min: 0, max: 10, lock: 'never' } });
  assert.deepEqual([custom.roster.required, custom.roster.min, custom.roster.max], [true, 2, 4]);
});

test('queimado pontua por queima e permite configurar o tempo da partida', () => {
  const regulation = resolveRegulation('Queimado');
  assert.equal(regulation.scoring[0].label, 'Queima');
  assert.equal(regulation.completion.mode, 'periods');
  assert.equal(regulation.base.periodCount, 2);
});

test('xadrez registra resultado da rodada e vale meio ponto no empate', () => {
  const regulation = resolveRegulation('Xadrez');

  assert.equal(regulation.completion.mode, 'board');
  assert.equal(regulation.standings.draw, 0.5);
  assert.equal(regulation.roster.required, false);
});

test('regra salva antes do regulamento continua válida com incremento unitário', () => {
  const legacy = { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 10, clockMode: 'countdown' as const, scoringEvent: 'Ponto', secondaryEvents: ['Falta', 'Cartão'] as [string, string] };
  const regulation = regulationFromRule('Basquete', legacy);

  assert.deepEqual(regulation.scoring, [{ id: 'ponto', label: 'Ponto', points: 1 }]);
  assert.equal(regulation.secondary.length, 2);
  assert.equal(regulation.completion.mode, 'periods');
});

test('estima a duração da partida para a crítica de agenda', () => {
  assert.equal(estimatedMatchMinutes(resolveRegulation('Futsal')), 45);
  assert.equal(estimatedMatchMinutes(resolveRegulation('Basquete')), 30);
  assert.equal(estimatedMatchMinutes(resolveRegulation('Vôlei')), 125);
});

test('a regra padrão da modalidade já carrega o regulamento completo', () => {
  const rule = defaultRegulationRule('Futsal');

  assert.equal(rule.scoring?.[0].label, 'Gol');
  assert.equal(rule.roster?.min, 5);
  assert.equal(rule.knockout?.method, 'penaltis');
});
