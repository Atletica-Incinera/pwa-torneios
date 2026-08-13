import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDisciplineRule, matchClockLabel, resolveDisciplineRule } from '@atletica-incinera/intereng-contract/rules';

test('carrega a regra padrão da modalidade antes da partida', () => {
  const rule = resolveDisciplineRule('Basquete');

  assert.equal(rule.periodLabel, 'Tempo');
  assert.equal(rule.periodCount, 2);
  assert.equal(rule.periodDurationMinutes, 10);
  assert.equal(rule.clockMode, 'countdown');
  assert.equal(formatDisciplineRule(rule), '2 × 10 min · relógio regressivo');
});

test('prioriza a regra configurada na edição e calcula o relógio', () => {
  const configured = {
    periodLabel: 'Quarto',
    periodCount: 4,
    periodDurationMinutes: 8,
    clockMode: 'countdown' as const,
    scoringEvent: 'Ponto',
    secondaryEvents: ['Falta', 'Tempo técnico'] as [string, string],
  };
  const rule = resolveDisciplineRule('Basquete', { rules: configured });

  assert.equal(rule, configured);
  assert.equal(matchClockLabel(rule, 75), 405);
  assert.equal(matchClockLabel({ ...rule, clockMode: 'progressive' }, 75), 75);
});
