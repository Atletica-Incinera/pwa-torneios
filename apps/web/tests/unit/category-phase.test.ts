import assert from 'node:assert/strict';
import test from 'node:test';
import { currentPhaseLabel } from '../../app/lib/category-phase.ts';

const phases = [{ name: 'Fase de grupos' }, { name: 'Mata-mata' }] as never;
const setup = { status: 'Em andamento' as const, phases, generated: true };

test('categoria encerrada não diz mais "Fase de grupos"', () => {
  assert.equal(currentPhaseLabel({ ...setup, status: 'Encerrado' }, [['t-1', { status: 'Encerrada', phase: 'Fase de grupos' }]]), 'Encerrada');
});

test('com jogos de grupo pendentes, a fase é a de grupos', () => {
  assert.equal(currentPhaseLabel(setup, [['t-1', { status: 'Encerrada', phase: 'Fase de grupos' }], ['t-2', { status: 'Agendada', phase: 'Fase de grupos' }]]), 'Fase de grupos');
});

test('no mata-mata, o nome da rodada pendente', () => {
  const matches: Array<[string, { status: 'Encerrada' | 'Agendada'; phase: string }]> = [
    ['t-1', { status: 'Encerrada', phase: 'Fase de grupos' }],
    ['t-advanced-r1-1', { status: 'Encerrada', phase: 'Mata-mata' }],
    ['t-advanced-r1-2', { status: 'Agendada', phase: 'Mata-mata' }],
    ['t-advanced-r2-1', { status: 'Agendada', phase: 'Mata-mata' }],
  ];
  assert.equal(currentPhaseLabel(setup, matches), 'Semifinal');
  matches[2][1].status = 'Encerrada';
  assert.equal(currentPhaseLabel(setup, matches), 'Final');
});

test('sem jogos gerados', () => {
  assert.equal(currentPhaseLabel({ ...setup, generated: false }, []), 'Jogos a gerar');
  assert.equal(currentPhaseLabel({ ...setup, generated: false, phases: [] }, []), 'Configuração');
});

test('resumo da fase: liga não vira "eliminação simples"', async () => {
  const { phaseSummary } = await import('../../app/lib/category-phase.ts');
  assert.equal(phaseSummary({ format: 'Liga', groups: [], qualifiers: 2 }, false), 'Todos contra todos');
  assert.equal(phaseSummary({ format: 'Liga', groups: [], qualifiers: 2 }, true), 'Todos contra todos · avançam 2');
  assert.equal(phaseSummary({ format: 'Grupos', groups: ['Grupo A', 'Grupo B'], qualifiers: 2 }, true), '2 grupos · Grupo A, Grupo B · avançam 2 por grupo');
  assert.equal(phaseSummary({ format: 'Mata-mata', groups: [], qualifiers: 0 }, false), 'Eliminação simples');
});
