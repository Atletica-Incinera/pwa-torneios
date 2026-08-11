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
