import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDisciplineRule, matchClockLabel, resolveDisciplineRule } from '../../app/lib/discipline-rules.ts';

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

/*
 * Sem regra própria e sem preset com o nome dela, o app cai numa regra
 * genérica. O problema não é a regra — é ela se DISFARÇAR de decisão: a tela
 * mostrava "2 × 20 min com cronômetro" do mesmo jeito que mostra o futsal, e
 * nada dizia que aquilo era um palpite.
 *
 * No InterEng 2026 isso vale para Queimado e Tênis de Mesa. Queimado tem treze
 * jogos: a mesa abriria o placar com um cronômetro regressivo que não tem nada
 * a ver com o jogo.
 */
test('acusa a modalidade cujo regulamento ninguém definiu', async () => {
  const { regulamentoIndefinido } = await import('../../app/lib/discipline-rules.ts');

  assert.equal(regulamentoIndefinido('Queimado'), true);
  assert.equal(regulamentoIndefinido('Tênis de Mesa'), true);

  // Estas têm preset com o nome exato: o que a tela mostra é uma decisão.
  for (const nome of ['Futsal', 'Vôlei', 'Handebol', 'Basquete', 'Xadrez', 'Natação']) {
    assert.equal(regulamentoIndefinido(nome), false, nome);
  }
});

test('regra configurada pela organização deixa de ser lacuna', async () => {
  const { regulamentoIndefinido, resolveDisciplineRule } = await import(
    '../../app/lib/discipline-rules.ts'
  );
  const configurada = { rules: resolveDisciplineRule('Futsal') };

  // A partir do momento em que alguém salva o regulamento, a lacuna sumiu —
  // mesmo numa modalidade sem preset.
  assert.equal(regulamentoIndefinido('Queimado', configurada), false);
});
