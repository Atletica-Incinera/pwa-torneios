import type { MatchState } from './frontend-state.ts';
import { absoluteMinutes } from './scheduling-rules.ts';
import { regulationPeriodCount, setTarget, type Regulation } from './regulation.ts';

export type MatchStatus = NonNullable<MatchState['status']>;

/** Fluxo formal de estados. Encerrada, Cancelada e W.O. são terminais. */
export const matchTransitions: Record<MatchStatus, MatchStatus[]> = {
  Agendada: ['Agendada', 'Ao vivo', 'Adiada', 'Cancelada', 'W.O.'],
  'Ao vivo': ['Ao vivo', 'Encerrada', 'Adiada', 'W.O.'],
  Encerrada: ['Encerrada'],
  Adiada: ['Adiada', 'Agendada', 'Cancelada', 'W.O.'],
  Cancelada: ['Cancelada'],
  'W.O.': ['W.O.'],
};

export type StatusRequirement = {
  /** Exige motivo registrado na auditoria. */
  reason: boolean;
  /** Exige nova data/horário — a partida volta para o calendário. */
  reschedule: boolean;
  /** Exige declarar a equipe vencedora. */
  winner: boolean;
  /** Entra no cálculo da classificação. */
  countsForStandings: boolean;
  consequence: string;
};

export const statusRequirements: Record<MatchStatus, StatusRequirement> = {
  Agendada: { reason: false, reschedule: false, winner: false, countsForStandings: false, consequence: 'A partida fica no calendário aguardando início.' },
  'Ao vivo': { reason: false, reschedule: false, winner: false, countsForStandings: false, consequence: 'A partida passa a ser operada no placar.' },
  Encerrada: { reason: false, reschedule: false, winner: false, countsForStandings: true, consequence: 'O resultado alimenta a classificação e o chaveamento.' },
  Adiada: { reason: true, reschedule: true, winner: false, countsForStandings: false, consequence: 'Sai do resultado oficial e volta ao calendário na nova data.' },
  Cancelada: { reason: true, reschedule: false, winner: false, countsForStandings: false, consequence: 'Não conta para a classificação e libera a quadra na agenda.' },
  'W.O.': { reason: true, reschedule: false, winner: true, countsForStandings: true, consequence: 'Aplica o placar regulamentar e conta como resultado oficial.' },
};

export function canTransition(from: MatchStatus, to: MatchStatus) {
  return matchTransitions[from]?.includes(to) ?? false;
}

/** Fases eliminatórias não admitem empate. */
export function isEliminationPhase(phase?: string) {
  return /oitava|quarta|semi|final|mata-?mata|elimina/i.test(phase ?? '');
}

export type StartPolicy = { earlyToleranceMinutes: number; lateToleranceMinutes: number };
export const defaultStartPolicy: StartPolicy = { earlyToleranceMinutes: 30, lateToleranceMinutes: 180 };

export type StartCheck = { allowed: boolean; requiresJustification: boolean; reasonCode: 'ok' | 'estado-invalido' | 'antecipado' | 'atrasado' | 'sem-horario' | 'a-definir'; message: string };

/**
 * Abrir a tela do placar não inicia a partida. O operador precisa confirmar, e
 * fora da janela prevista a confirmação exige justificativa registrada.
 */
export function evaluateStart(match: Pick<MatchState, 'status' | 'date' | 'time' | 'aDefinirA' | 'aDefinirB'>, now: Date, policy: StartPolicy = defaultStartPolicy): StartCheck {
  const status = (match.status ?? 'Agendada') as MatchStatus;
  // Jogo do mata-mata que já está na agenda mas ainda espera o resultado
  // anterior. A API recusa do mesmo jeito; aqui a recusa vem antes, com a
  // frase que explica o que falta em vez de um erro genérico.
  if (status !== 'Ao vivo' && (match.aDefinirA || match.aDefinirB)) {
    return { allowed: false, requiresJustification: false, reasonCode: 'a-definir', message: 'Esta partida ainda depende de um resultado anterior. Ela pode ser iniciada quando os dois participantes forem definidos.' };
  }
  if (status === 'Ao vivo') return { allowed: true, requiresJustification: false, reasonCode: 'ok', message: 'Partida em andamento.' };
  if (!canTransition(status, 'Ao vivo')) return { allowed: false, requiresJustification: false, reasonCode: 'estado-invalido', message: `Uma partida ${status.toLocaleLowerCase('pt-BR')} não pode ser iniciada.` };
  const scheduled = match.date && match.time ? absoluteMinutes(match.date, match.time) : null;
  if (scheduled === null) return { allowed: true, requiresJustification: true, reasonCode: 'sem-horario', message: 'A partida não tem data e horário definidos. Justifique o início.' };
  const current = absoluteMinutes(toDateKey(now), `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  if (current === null) return { allowed: true, requiresJustification: false, reasonCode: 'ok', message: '' };
  const delta = current - scheduled;
  if (delta < -policy.earlyToleranceMinutes) return { allowed: true, requiresJustification: true, reasonCode: 'antecipado', message: `Início ${Math.abs(delta)} min antes do horário previsto. Registre a justificativa.` };
  if (delta > policy.lateToleranceMinutes) return { allowed: true, requiresJustification: true, reasonCode: 'atrasado', message: `Início ${delta} min após o horário previsto. Registre a justificativa.` };
  return { allowed: true, requiresJustification: false, reasonCode: 'ok', message: 'Dentro da janela prevista.' };
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Vencedor da etapa atual num regulamento por sets, respeitando a vantagem mínima. */
export function setWinner(regulation: Regulation, period: number, scoreA: number, scoreB: number): 'home' | 'away' | null {
  if (regulation.completion.mode !== 'sets') return null;
  const target = setTarget(regulation, period);
  const advantage = regulation.completion.minAdvantage;
  if (scoreA >= target && scoreA - scoreB >= advantage) return 'home';
  if (scoreB >= target && scoreB - scoreA >= advantage) return 'away';
  return null;
}

export type PeriodCheck = { allowed: boolean; requiresEarlyClose: boolean; message: string };

/**
 * Só é possível avançar de etapa quando a anterior terminou de forma válida.
 * Fora disso, exige a ação explícita de encerramento antecipado.
 */
export function evaluateAdvancePeriod(regulation: Regulation, match: Pick<MatchState, 'currentPeriod' | 'clockSeconds' | 'paused' | 'periodScoreA' | 'periodScoreB'>): PeriodCheck {
  const { completion } = regulation;
  const period = match.currentPeriod ?? 1;
  const total = regulationPeriodCount(regulation);
  if (period >= total) return { allowed: false, requiresEarlyClose: false, message: `Esta é a última ${regulation.base.periodLabel.toLocaleLowerCase('pt-BR')} prevista no regulamento.` };
  if (completion.mode === 'sets') {
    const decided = setWinner(regulation, period, match.periodScoreA ?? 0, match.periodScoreB ?? 0);
    if (decided) return { allowed: true, requiresEarlyClose: false, message: '' };
    return { allowed: true, requiresEarlyClose: true, message: `O ${regulation.base.periodLabel.toLocaleLowerCase('pt-BR')} ${period} ainda não atingiu ${setTarget(regulation, period)} pontos com ${completion.minAdvantage} de vantagem.` };
  }
  const durationSeconds = regulation.base.periodDurationMinutes * 60;
  const hasClock = regulation.base.clockMode !== 'none' && durationSeconds > 0;
  if (hasClock && (match.clockSeconds ?? 0) < durationSeconds) {
    return { allowed: true, requiresEarlyClose: true, message: `O tempo da ${regulation.base.periodLabel.toLocaleLowerCase('pt-BR')} ${period} ainda não terminou.` };
  }
  return { allowed: true, requiresEarlyClose: false, message: '' };
}

export type FinishCheck = {
  canFinish: boolean;
  requiresTiebreak: boolean;
  requiresEarlyClose: boolean;
  winner: 'home' | 'away' | 'draw' | null;
  message: string;
};

/**
 * Decide se a partida pode ser encerrada com o placar atual e se falta um
 * desempate obrigatório (mata-mata empatado ou modalidade que não admite empate).
 */
export function evaluateFinish(
  regulation: Regulation,
  options: { scoreA: number; scoreB: number; currentPeriod: number; elimination: boolean },
): FinishCheck {
  const { completion } = regulation;
  const { scoreA, scoreB, currentPeriod, elimination } = options;
  const total = regulationPeriodCount(regulation);
  const drawn = scoreA === scoreB;
  const winner: FinishCheck['winner'] = drawn ? 'draw' : scoreA > scoreB ? 'home' : 'away';

  if (completion.mode === 'sets') {
    const target = completion.setsToWin;
    if (scoreA >= target || scoreB >= target) return { canFinish: true, requiresTiebreak: false, requiresEarlyClose: false, winner, message: '' };
    return { canFinish: true, requiresTiebreak: false, requiresEarlyClose: true, winner, message: `Nenhuma equipe venceu ${target} sets. Encerrar agora exige justificativa.` };
  }

  const needsTiebreak = drawn && (elimination || !completion.allowDraw);
  const early = currentPeriod < total;
  return {
    canFinish: true,
    requiresTiebreak: needsTiebreak,
    requiresEarlyClose: early,
    winner,
    message: needsTiebreak
      ? `${elimination ? 'Partida eliminatória' : 'Esta modalidade'} não pode terminar empatada. Aplique ${regulation.knockout.label.toLocaleLowerCase('pt-BR')}.`
      : early
        ? `Ainda faltam etapas previstas (${currentPeriod} de ${total}). Encerrar agora exige justificativa.`
        : '',
  };
}

/** Placar regulamentar do W.O. conforme a modalidade. */
export function walkoverScores(regulation: Regulation, winnerSide: 'home' | 'away') {
  const { winnerScore, loserScore } = regulation.walkover;
  return winnerSide === 'home' ? { scoreA: winnerScore, scoreB: loserScore } : { scoreA: loserScore, scoreB: winnerScore };
}

/** Resultado oficial da partida, já considerando desempate e W.O. */
export function officialWinner(match: Pick<MatchState, 'status' | 'scoreA' | 'scoreB' | 'entryA' | 'entryB' | 'tiebreak' | 'walkoverWinner'>) {
  if (match.status === 'W.O.') return match.walkoverWinner ?? null;
  if (match.status !== 'Encerrada' || match.scoreA == null || match.scoreB == null) return null;
  if (match.scoreA === match.scoreB) return match.tiebreak?.winner ?? null;
  return match.scoreA > match.scoreB ? match.entryA ?? null : match.entryB ?? null;
}

/** Uma partida encerrada só pode ser retificada com motivo e responsável. */
export function canCorrectResult(status: MatchStatus) {
  return status === 'Encerrada' || status === 'W.O.';
}

/** Tempo que a trava do operador continua válida sem ser renovada. */
export const operatorLockMs = 120_000;
/** A partir de quando vale a pena renovar a trava. */
export const operatorRenewMs = 90_000;

export type OperatorAction = 'renew' | 'skip' | 'blocked';

/**
 * Decide se o placar precisa mesmo gravar a trava do operador.
 *
 * Antes o registro era reescrito a cada 10 s, o que reescrevia o estado inteiro
 * e re-renderizava o app durante a partida. Agora só grava quando a trava está
 * perto de expirar — e nunca quando ela pertence a outro operador ativo.
 */
export function evaluateOperatorLock(
  active: Pick<MatchState, 'operatorId' | 'operatorHeartbeat'>,
  operatorId: string,
  now = Date.now(),
): OperatorAction {
  const age = active.operatorHeartbeat ? now - new Date(active.operatorHeartbeat).getTime() : Number.POSITIVE_INFINITY;
  const fresh = age < operatorLockMs;
  if (fresh && active.operatorId && active.operatorId !== operatorId) return 'blocked';
  if (active.operatorId === operatorId && age < operatorRenewMs) return 'skip';
  return 'renew';
}
