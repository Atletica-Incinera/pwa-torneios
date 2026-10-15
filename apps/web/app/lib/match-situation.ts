import { hasStarted, matchStatus } from './status.ts';

export type SituationTone = 'orange' | 'blue' | 'pink' | 'neutral';
export type MatchSituation = {
  /** Como a pessoa lê o estado: "Ao vivo", "Atrasado", "Sem resultado"... */
  label: string;
  tone: SituationTone;
  /** O placar só existe depois que o jogo começou. */
  showScore: boolean;
  /**
   * Está "Ao vivo" no sistema, mas o horário já passou muito do fim previsto:
   * a mesa não encerrou. Não é jogo em quadra e não pode ser anunciado assim.
   */
  stale?: boolean;
};

type SituationInput = {
  status?: string;
  date?: string;
  time?: string;
  /** Minutos de jogo previstos pelo regulamento. */
  durationMinutes?: number;
};

/** Tolerância depois do fim previsto antes de um jogo virar "Sem resultado". */
const graceMinutes = 30;
/**
 * Depois do fim previsto, quanto tempo um jogo "Ao vivo" ainda é tratado como
 * em quadra. Folga larga de propósito: atraso, prorrogação e intervalo longo
 * não podem tirar do ar um jogo que de fato está acontecendo.
 */
const staleLiveMinutes = 180;

function startOf(date?: string, time?: string): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const clock = time && /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  const value = new Date(`${date}T${clock}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

/**
 * Situação de uma partida, numa função só.
 *
 * Antes, todo jogo que não estava ao vivo nem encerrado era "Próximo" — inclusive
 * os de dias anteriores — e aparecia com "0 — 0", porque a API devolve placar
 * zero para jogo que nem começou. Em 2026 o público leu 32 empates sem gols que
 * não aconteceram. Agora o selo envelhece com o relógio e o placar só aparece
 * quando há placar.
 */
export function matchSituation(match: SituationInput, now: Date = new Date()): MatchSituation {
  const status = match.status ?? matchStatus.scheduled;
  if (status === matchStatus.live) {
    // Em 2026 um jogo ficou "Ao vivo" por dias, porque ninguém encerrou na mesa,
    // e a home pública o anunciava como acontecendo agora.
    const liveStart = startOf(match.date, match.time);
    const overdue = liveStart && (now.getTime() - liveStart.getTime()) / 60_000 > (match.durationMinutes ?? 60) + staleLiveMinutes;
    return overdue
      ? { label: 'Sem atualização', tone: 'pink', showScore: true, stale: true }
      : { label: 'Ao vivo', tone: 'orange', showScore: true };
  }
  if (status === matchStatus.finished) return { label: 'Encerrado', tone: 'neutral', showScore: true };
  if (status === matchStatus.walkover) return { label: 'W.O.', tone: 'neutral', showScore: true };
  if (status === matchStatus.cancelled) return { label: 'Cancelado', tone: 'pink', showScore: false };
  if (status === matchStatus.postponed) return { label: 'Adiado', tone: 'pink', showScore: false };
  const start = startOf(match.date, match.time);
  if (!start) return { label: 'A agendar', tone: 'blue', showScore: false };
  const elapsed = (now.getTime() - start.getTime()) / 60_000;
  if (elapsed < 0) return { label: 'Próximo', tone: 'blue', showScore: false };
  if (elapsed <= (match.durationMinutes ?? 60) + graceMinutes) return { label: 'Atrasado', tone: 'pink', showScore: false };
  return { label: 'Sem resultado', tone: 'pink', showScore: false };
}

/** O placar exibível: nulo enquanto o jogo não começou. */
export function visibleScore(status: string | undefined, score: number | null | undefined) {
  return hasStarted(status) ? score ?? 0 : null;
}
