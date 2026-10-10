import type { DisciplineRule, DisciplineState } from './frontend-state.ts';
import { defaultRegulationRule, describeCompletion, regulationFromRule } from './regulation.ts';

export const defaultDisciplineRules: Record<string, DisciplineRule> = {
  Futsal: defaultRegulationRule('Futsal'),
  'Vôlei': defaultRegulationRule('Vôlei'),
  Handebol: defaultRegulationRule('Handebol'),
  Xadrez: defaultRegulationRule('Xadrez'),
  'Natação': defaultRegulationRule('Natação'),
  Basquete: defaultRegulationRule('Basquete'),
};

const genericRule: DisciplineRule = defaultRegulationRule('__generic');

export function resolveDisciplineRule(name: string, discipline?: Pick<DisciplineState, 'rules'>): DisciplineRule {
  return discipline?.rules ?? defaultDisciplineRules[name] ?? genericRule;
}

/**
 * Ninguem decidiu o regulamento desta modalidade.
 *
 * Sem regra propria e sem preset com o nome dela, o app cai numa regra
 * generica -- dois tempos de vinte minutos com cronometro regressivo. O
 * problema nao e a regra: e ela se DISFARCAR de decisao. A tela mostrava
 * "2 x 20 min com cronometro" do mesmo jeito que mostra o futsal, e nada
 * dizia que aquilo era um palpite do app.
 *
 * No InterEng 2026 isso vale para Queimado e Tenis de Mesa. Queimado tem
 * treze jogos: a mesa abriria o placar com um cronometro regressivo que nao
 * tem nada a ver com o jogo.
 *
 * Quem resolve e o admin, na tela da modalidade. O que o app faz e nao deixar
 * a lacuna passar por decisao.
 */
export function regulamentoIndefinido(name: string, discipline?: Pick<DisciplineState, 'rules'>): boolean {
  if (discipline?.rules) return false;
  return !Object.prototype.hasOwnProperty.call(defaultDisciplineRules, name);
}

export function formatDisciplineRule(rule: DisciplineRule) {
  if (rule.clockMode === 'none') return `${rule.periodCount} ${rule.periodCount === 1 ? rule.periodLabel : `${rule.periodLabel}s`}`;
  return `${rule.periodCount} × ${rule.periodDurationMinutes} min · relógio ${rule.clockMode === 'countdown' ? 'regressivo' : 'progressivo'}`;
}

/** Linha completa: estrutura de tempo + condição de encerramento do regulamento. */
export function formatDisciplineRegulation(name: string, rule: DisciplineRule) {
  return `${formatDisciplineRule(rule)} · ${describeCompletion(regulationFromRule(name, rule))}`;
}

export function matchClockLabel(rule: DisciplineRule, elapsedSeconds: number) {
  const durationSeconds = rule.periodDurationMinutes * 60;
  if (rule.clockMode === 'countdown' && durationSeconds > 0) return Math.max(0, durationSeconds - elapsedSeconds);
  return Math.max(0, elapsedSeconds);
}
