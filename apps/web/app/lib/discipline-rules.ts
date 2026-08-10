import type { DisciplineRule, DisciplineState } from './frontend-state.ts';

export const defaultDisciplineRules: Record<string, DisciplineRule> = {
  Futsal: { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 20, clockMode: 'countdown', scoringEvent: 'Gol', secondaryEvents: ['Falta', 'Cartão'] },
  Vôlei: { periodLabel: 'Set', periodCount: 5, periodDurationMinutes: 0, clockMode: 'none', scoringEvent: 'Ponto', secondaryEvents: ['Fim de set', 'Falta'] },
  Handebol: { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 30, clockMode: 'countdown', scoringEvent: 'Gol', secondaryEvents: ['Falta', '2 minutos'] },
  Xadrez: { periodLabel: 'Rodada', periodCount: 7, periodDurationMinutes: 0, clockMode: 'none', scoringEvent: 'Ponto', secondaryEvents: ['Advertência', 'Encerrar tabuleiro'] },
  Natação: { periodLabel: 'Prova', periodCount: 1, periodDurationMinutes: 0, clockMode: 'none', scoringEvent: 'Resultado', secondaryEvents: ['Largada', 'Ocorrência'] },
  Basquete: { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 10, clockMode: 'countdown', scoringEvent: 'Ponto', secondaryEvents: ['Falta', 'Tempo técnico'] },
};

const genericRule: DisciplineRule = { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 20, clockMode: 'countdown', scoringEvent: 'Ponto', secondaryEvents: ['Falta', 'Ocorrência'] };

export function resolveDisciplineRule(name: string, discipline?: Pick<DisciplineState, 'rules'>): DisciplineRule {
  return discipline?.rules ?? defaultDisciplineRules[name] ?? genericRule;
}

export function formatDisciplineRule(rule: DisciplineRule) {
  if (rule.clockMode === 'none') return `${rule.periodCount} ${rule.periodCount === 1 ? rule.periodLabel : `${rule.periodLabel}s`}`;
  return `${rule.periodCount} × ${rule.periodDurationMinutes} min · relógio ${rule.clockMode === 'countdown' ? 'regressivo' : 'progressivo'}`;
}

export function matchClockLabel(rule: DisciplineRule, elapsedSeconds: number) {
  const durationSeconds = rule.periodDurationMinutes * 60;
  if (rule.clockMode === 'countdown' && durationSeconds > 0) return Math.max(0, durationSeconds - elapsedSeconds);
  return Math.max(0, elapsedSeconds);
}
