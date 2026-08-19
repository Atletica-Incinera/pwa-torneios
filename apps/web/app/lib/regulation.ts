import type { DisciplineRule, DisciplineState } from './frontend-state.ts';

/** Ação que altera o placar. `points` é o quanto cada toque soma. */
export type ScoringAction = { id: string; label: string; points: number };

/**
 * Ação registrada na partida sem alterar o placar — falta, cartão, tempo.
 *
 * `scorePoints` está declarado e nunca é lido: nenhum caminho do placar o soma.
 * Fica só porque estados já gravados o carregam; um evento que também pontua
 * deve ser declarado na lista de ações de placar, que é quem move o resultado.
 * @deprecated não consumido — não configure esperando efeito.
 */
export type SecondaryAction = { id: string; label: string; requiresSide: boolean; allowedWhenStopped: boolean; scorePoints: number; fairPlayPoints: number };

/**
 * Como a partida termina.
 * - `periods`: acaba após a última etapa; prorrogação opcional quando o empate não é permitido.
 * - `sets`: cada etapa é um set próprio; o placar da partida conta sets vencidos.
 * - `board`: resultado declarado da mesa/rodada (xadrez), sem contador incremental.
 * - `result`: resultado único da prova (natação e provas individuais).
 */
export type CompletionRule =
  | { mode: 'periods'; allowDraw: boolean; overtimePeriods: number; overtimeDurationMinutes: number }
  | { mode: 'sets'; setsToWin: number; pointsToWinSet: number; pointsToWinDecidingSet: number; minAdvantage: number }
  | { mode: 'board'; allowDraw: boolean; winPoints: number; drawPoints: number }
  | { mode: 'result'; allowDraw: boolean };

/** Elenco exigido pelo regulamento da modalidade. */
export type RosterRule = { required: boolean; min: number; max: number; lock: 'never' | 'discipline-start' | 'knockout' };

export type TiebreakerId = 'confronto-direto' | 'vitorias' | 'saldo' | 'marcados' | 'sofridos' | 'fair-play' | 'sorteio';

/** Regulamento da tabela de classificação. */
export type StandingsRule = { win: number; draw: number; loss: number; tiebreakers: TiebreakerId[] };

export type KnockoutMethod = 'prorrogacao' | 'penaltis' | 'set-extra' | 'criterio-tecnico' | 'administrativo';

/** Como um mata-mata empatado é resolvido. */
export type KnockoutRule = { method: KnockoutMethod; label: string; requiresScore: boolean; thirdPlaceMatch: boolean };

/** Placar regulamentar aplicado quando a partida é decidida por W.O. */
export type WalkoverRule = { winnerScore: number; loserScore: number };

export type Regulation = {
  discipline: string;
  base: DisciplineRule;
  scoring: ScoringAction[];
  secondary: SecondaryAction[];
  completion: CompletionRule;
  roster: RosterRule;
  standings: StandingsRule;
  knockout: KnockoutRule;
  walkover: WalkoverRule;
};

export type RegulationExtension = Partial<Pick<Regulation, 'scoring' | 'secondary' | 'completion' | 'roster' | 'standings' | 'knockout' | 'walkover'>>;

export const tiebreakerLabels: Record<TiebreakerId, string> = {
  'confronto-direto': 'Confronto direto',
  vitorias: 'Vitórias',
  saldo: 'Saldo',
  marcados: 'Pontos marcados',
  sofridos: 'Menos pontos sofridos',
  'fair-play': 'Fair play',
  sorteio: 'Sorteio',
};

export const knockoutMethodLabels: Record<KnockoutMethod, string> = {
  prorrogacao: 'Prorrogação',
  penaltis: 'Pênaltis',
  'set-extra': 'Set extra',
  'criterio-tecnico': 'Critério técnico do regulamento',
  administrativo: 'Decisão administrativa',
};

const collectiveStandings: StandingsRule = { win: 3, draw: 1, loss: 0, tiebreakers: ['confronto-direto', 'vitorias', 'saldo', 'marcados', 'fair-play', 'sorteio'] };

function action(label: string, points: number): ScoringAction {
  return { id: label.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-'), label, points };
}

function secondary(label: string, options: Partial<Omit<SecondaryAction, 'id' | 'label'>> = {}): SecondaryAction {
  return { id: label.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-'), label, requiresSide: true, allowedWhenStopped: true, scorePoints: 0, fairPlayPoints: 0, ...options };
}

/**
 * Regulamento padrão por modalidade. É apenas o ponto de partida: a edição pode
 * sobrescrever qualquer campo ao configurar a modalidade.
 */
export const defaultRegulations: Record<string, RegulationExtension> = {
  Futsal: {
    scoring: [action('Gol', 1)],
    secondary: [secondary('Falta'), secondary('Cartão', { fairPlayPoints: 1 })],
    completion: { mode: 'periods', allowDraw: true, overtimePeriods: 0, overtimeDurationMinutes: 0 },
    roster: { required: true, min: 5, max: 12, lock: 'knockout' },
    standings: collectiveStandings,
    knockout: { method: 'penaltis', label: knockoutMethodLabels.penaltis, requiresScore: true, thirdPlaceMatch: true },
    walkover: { winnerScore: 1, loserScore: 0 },
  },
  Handebol: {
    scoring: [action('Gol', 1)],
    secondary: [secondary('Falta'), secondary('2 minutos', { fairPlayPoints: 1 })],
    completion: { mode: 'periods', allowDraw: true, overtimePeriods: 0, overtimeDurationMinutes: 0 },
    roster: { required: true, min: 7, max: 14, lock: 'knockout' },
    standings: collectiveStandings,
    knockout: { method: 'penaltis', label: knockoutMethodLabels.penaltis, requiresScore: true, thirdPlaceMatch: true },
    walkover: { winnerScore: 1, loserScore: 0 },
  },
  Basquete: {
    scoring: [action('Lance livre', 1), action('Cesta de 2', 2), action('Cesta de 3', 3)],
    secondary: [secondary('Falta', { fairPlayPoints: 1 }), secondary('Tempo técnico', { requiresSide: true })],
    completion: { mode: 'periods', allowDraw: false, overtimePeriods: 1, overtimeDurationMinutes: 5 },
    roster: { required: true, min: 5, max: 12, lock: 'knockout' },
    // FIBA: vitória vale 2 e derrota vale 1; empate não existe.
    standings: { win: 2, draw: 0, loss: 1, tiebreakers: ['confronto-direto', 'saldo', 'marcados', 'fair-play', 'sorteio'] },
    knockout: { method: 'prorrogacao', label: knockoutMethodLabels.prorrogacao, requiresScore: true, thirdPlaceMatch: true },
    walkover: { winnerScore: 20, loserScore: 0 },
  },
  'Vôlei': {
    scoring: [action('Ponto', 1)],
    secondary: [secondary('Falta'), secondary('Tempo técnico')],
    completion: { mode: 'sets', setsToWin: 3, pointsToWinSet: 25, pointsToWinDecidingSet: 15, minAdvantage: 2 },
    roster: { required: true, min: 6, max: 12, lock: 'knockout' },
    standings: { win: 3, draw: 0, loss: 0, tiebreakers: ['confronto-direto', 'vitorias', 'saldo', 'marcados', 'sorteio'] },
    knockout: { method: 'set-extra', label: knockoutMethodLabels['set-extra'], requiresScore: true, thirdPlaceMatch: true },
    walkover: { winnerScore: 3, loserScore: 0 },
  },
  Xadrez: {
    scoring: [action('Ponto', 1)],
    secondary: [secondary('Advertência', { fairPlayPoints: 1 })],
    completion: { mode: 'board', allowDraw: true, winPoints: 1, drawPoints: 0.5 },
    roster: { required: false, min: 1, max: 1, lock: 'never' },
    standings: { win: 1, draw: 0.5, loss: 0, tiebreakers: ['confronto-direto', 'vitorias', 'sorteio'] },
    knockout: { method: 'criterio-tecnico', label: 'Critério de desempate do regulamento', requiresScore: false, thirdPlaceMatch: false },
    walkover: { winnerScore: 1, loserScore: 0 },
  },
  'Natação': {
    scoring: [action('Resultado', 1)],
    secondary: [secondary('Largada', { requiresSide: false }), secondary('Ocorrência')],
    completion: { mode: 'result', allowDraw: false },
    roster: { required: true, min: 1, max: 8, lock: 'discipline-start' },
    standings: { win: 3, draw: 1, loss: 0, tiebreakers: ['vitorias', 'marcados', 'sorteio'] },
    knockout: { method: 'criterio-tecnico', label: 'Critério de desempate do regulamento', requiresScore: false, thirdPlaceMatch: false },
    walkover: { winnerScore: 1, loserScore: 0 },
  },
};

const genericExtension: RegulationExtension = {
  completion: { mode: 'periods', allowDraw: true, overtimePeriods: 0, overtimeDurationMinutes: 0 },
  roster: { required: false, min: 0, max: 30, lock: 'never' },
  standings: collectiveStandings,
  knockout: { method: 'criterio-tecnico', label: 'Critério de desempate do regulamento', requiresScore: false, thirdPlaceMatch: false },
  walkover: { winnerScore: 1, loserScore: 0 },
};

/**
 * Constrói o regulamento completo a partir da regra salva na partida ou na
 * modalidade. Campos ausentes caem no padrão da modalidade e, por fim, no
 * genérico — o que mantém compatível todo estado gravado antes deste módulo.
 */
export function regulationFromRule(discipline: string, rule: DisciplineRule): Regulation {
  const preset = defaultRegulations[discipline] ?? genericExtension;
  const legacyScoring = rule.scoringEvent ? [action(rule.scoringEvent, 1)] : [];
  const legacySecondary = (rule.secondaryEvents ?? []).filter(Boolean).map((label) => {
    const known = preset.secondary?.find((item) => item.label === label);
    return known ?? secondary(label);
  });
  const scoring = rule.scoring?.length ? rule.scoring : preset.scoring?.length && preset.scoring[0].label === rule.scoringEvent ? preset.scoring : legacyScoring.length ? legacyScoring : preset.scoring ?? [action('Ponto', 1)];
  return {
    discipline,
    base: rule,
    scoring,
    secondary: rule.secondary?.length ? rule.secondary : legacySecondary.length ? legacySecondary : preset.secondary ?? [],
    completion: rule.completion ?? preset.completion ?? genericExtension.completion!,
    roster: rule.roster ?? preset.roster ?? genericExtension.roster!,
    standings: rule.standings ?? preset.standings ?? genericExtension.standings!,
    knockout: rule.knockout ?? preset.knockout ?? genericExtension.knockout!,
    walkover: rule.walkover ?? preset.walkover ?? genericExtension.walkover!,
  };
}

/** Regulamento vigente da modalidade na edição. */
export function resolveRegulation(discipline: string, state?: Pick<DisciplineState, 'rules'>, matchRule?: DisciplineRule): Regulation {
  const rule = matchRule ?? state?.rules;
  if (rule) return regulationFromRule(discipline, rule);
  const fallback = defaultRegulationRule(discipline);
  return regulationFromRule(discipline, fallback);
}

const baseTimings: Record<string, Pick<DisciplineRule, 'periodLabel' | 'periodCount' | 'periodDurationMinutes' | 'clockMode' | 'scoringEvent' | 'secondaryEvents'>> = {
  Futsal: { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 20, clockMode: 'countdown', scoringEvent: 'Gol', secondaryEvents: ['Falta', 'Cartão'] },
  'Vôlei': { periodLabel: 'Set', periodCount: 5, periodDurationMinutes: 0, clockMode: 'none', scoringEvent: 'Ponto', secondaryEvents: ['Falta', 'Tempo técnico'] },
  Handebol: { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 30, clockMode: 'countdown', scoringEvent: 'Gol', secondaryEvents: ['Falta', '2 minutos'] },
  Xadrez: { periodLabel: 'Rodada', periodCount: 7, periodDurationMinutes: 0, clockMode: 'none', scoringEvent: 'Ponto', secondaryEvents: ['Advertência', 'Encerrar tabuleiro'] },
  'Natação': { periodLabel: 'Prova', periodCount: 1, periodDurationMinutes: 0, clockMode: 'none', scoringEvent: 'Resultado', secondaryEvents: ['Largada', 'Ocorrência'] },
  Basquete: { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 10, clockMode: 'countdown', scoringEvent: 'Ponto', secondaryEvents: ['Falta', 'Tempo técnico'] },
  __generic: { periodLabel: 'Tempo', periodCount: 2, periodDurationMinutes: 20, clockMode: 'countdown', scoringEvent: 'Ponto', secondaryEvents: ['Falta', 'Ocorrência'] },
};

/** Regra base padrão já com a extensão do regulamento aplicada. */
export function defaultRegulationRule(discipline: string): DisciplineRule {
  const preset = defaultRegulations[discipline] ?? genericExtension;
  const timing = baseTimings[discipline] ?? baseTimings.__generic;
  return { ...timing, ...preset } as DisciplineRule;
}

/** Quantidade máxima de etapas antes de prorrogação, considerando o modo de encerramento. */
export function regulationPeriodCount(regulation: Regulation) {
  if (regulation.completion.mode === 'sets') return regulation.completion.setsToWin * 2 - 1;
  return regulation.base.periodCount;
}

/** Pontos necessários para vencer a etapa `period` (o set decisivo costuma ser menor). */
export function setTarget(regulation: Regulation, period: number) {
  if (regulation.completion.mode !== 'sets') return 0;
  const decidingSet = regulation.completion.setsToWin * 2 - 1;
  return period >= decidingSet ? regulation.completion.pointsToWinDecidingSet : regulation.completion.pointsToWinSet;
}

/** Descreve o regulamento em uma linha, para telas de conferência. */
export function describeCompletion(regulation: Regulation) {
  const { completion } = regulation;
  if (completion.mode === 'sets') return `Melhor de ${completion.setsToWin * 2 - 1} sets · ${completion.pointsToWinSet} pontos (${completion.pointsToWinDecidingSet} no decisivo) com ${completion.minAdvantage} de vantagem`;
  // "vitória 1 / empate 0.5" solto aparecia a dois centímetros dos campos de
  // pontuação da tabela e reintroduzia a mesma ambiguidade que o formulário
  // acabou de desfazer: aqui o número é o placar da súmula, não a pontuação.
  if (completion.mode === 'board') return `Resultado por ${regulation.base.periodLabel.toLocaleLowerCase('pt-BR')} · placar ${completion.winPoints} para o vencedor / ${completion.drawPoints} no empate`;
  if (completion.mode === 'result') return `Resultado único da ${regulation.base.periodLabel.toLocaleLowerCase('pt-BR')}`;
  const overtime = completion.overtimePeriods > 0 ? ` · prorrogação de ${completion.overtimePeriods} × ${completion.overtimeDurationMinutes} min` : '';
  return `${regulation.base.periodCount} ${regulation.base.periodLabel.toLocaleLowerCase('pt-BR')}s${completion.allowDraw ? ' · empate permitido' : ' · não admite empate'}${overtime}`;
}

/** Texto curto do critério de desempate configurado. */
export function describeTiebreakers(rule: StandingsRule) {
  return rule.tiebreakers.map((item) => tiebreakerLabels[item]).join(', ');
}

/**
 * Duração estimada da partida, usada para detectar choque de quadra na agenda.
 * Inclui intervalos entre etapas e a prorrogação prevista no regulamento.
 */
export function estimatedMatchMinutes(regulation: Regulation) {
  const { base, completion } = regulation;
  if (completion.mode === 'sets') return (completion.setsToWin * 2 - 1) * 25;
  if (completion.mode === 'board') return 60;
  if (completion.mode === 'result') return 30;
  const playing = base.periodCount * base.periodDurationMinutes;
  const breaks = Math.max(0, base.periodCount - 1) * 5;
  return playing + breaks + completion.overtimePeriods * completion.overtimeDurationMinutes;
}

