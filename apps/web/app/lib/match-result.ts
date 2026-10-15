import { setTarget, type Regulation } from './regulation.ts';

export type SheetPeriod = { scoreA: number; scoreB: number };
export type SheetInput = { periods: SheetPeriod[]; scoreA?: number; scoreB?: number; knockout: boolean };
export type SheetCheck =
  | { ok: true; scoreA: number; scoreB: number; periods: SheetPeriod[]; needsTiebreak: boolean }
  | { ok: false; message: string };

/**
 * Validação da súmula — a mesma regra que a API aplica em `match/recordResult`,
 * para recusar antes de enviar e dizer o motivo em frase de quadra.
 *
 * Por sets: cada set vai ao alvo com a vantagem mínima; passado o alvo, termina
 * exatamente com a vantagem (25-23, 26-24, nunca 26-10). Ninguém joga set depois
 * de a partida estar decidida, e alguém precisa ter vencido os sets necessários.
 * Por tempo: o placar final; parciais, se informadas, precisam somar o final.
 */
export function checkSheet(regulation: Regulation, input: SheetInput): SheetCheck {
  const { completion } = regulation;
  if (completion.mode === 'sets') {
    const periods = input.periods.filter((item) => Number.isFinite(item.scoreA) && Number.isFinite(item.scoreB));
    if (!periods.length) return { ok: false, message: 'Informe o placar de cada set.' };
    let setsA = 0;
    let setsB = 0;
    for (const [index, item] of periods.entries()) {
      const period = index + 1;
      if (setsA >= completion.setsToWin || setsB >= completion.setsToWin) {
        return { ok: false, message: `A partida já estava decidida antes do ${period}º set.` };
      }
      const target = setTarget(regulation, period);
      const high = Math.max(item.scoreA, item.scoreB);
      const low = Math.min(item.scoreA, item.scoreB);
      const valid = high >= target && high - low >= completion.minAdvantage && (high === target || high - low === completion.minAdvantage);
      if (!valid) return { ok: false, message: `O ${period}º set (${item.scoreA}-${item.scoreB}) não fecha: vai a ${target} com ${completion.minAdvantage} de vantagem.` };
      if (item.scoreA > item.scoreB) setsA += 1; else setsB += 1;
    }
    if (setsA < completion.setsToWin && setsB < completion.setsToWin) {
      return { ok: false, message: `Ninguém venceu ${completion.setsToWin} sets ainda: falta um set.` };
    }
    return { ok: true, scoreA: setsA, scoreB: setsB, periods, needsTiebreak: false };
  }
  const scoreA = input.scoreA;
  const scoreB = input.scoreB;
  if (scoreA === undefined || scoreB === undefined || !Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA < 0 || scoreB < 0) {
    return { ok: false, message: 'Informe o placar final das duas equipes.' };
  }
  const periods = input.periods.filter((item) => Number.isFinite(item.scoreA) && Number.isFinite(item.scoreB));
  if (periods.length) {
    const sumA = periods.reduce((total, item) => total + item.scoreA, 0);
    const sumB = periods.reduce((total, item) => total + item.scoreB, 0);
    if (sumA !== scoreA || sumB !== scoreB) return { ok: false, message: `As parciais somam ${sumA} × ${sumB}, mas o placar final é ${scoreA} × ${scoreB}.` };
  }
  const allowsDraw = 'allowDraw' in completion ? completion.allowDraw : false;
  const needsTiebreak = scoreA === scoreB && (input.knockout || !allowsDraw);
  // Prorrogação não é um placar à parte: os pontos dela entram no placar final
  // da súmula. Só pênaltis (e afins) pedem um placar de desempate separado.
  if (needsTiebreak && regulation.knockout.method === 'prorrogacao') {
    return { ok: false, message: `${regulation.discipline} não termina empatado aqui: informe o placar final já com a prorrogação.` };
  }
  return { ok: true, scoreA, scoreB, periods, needsTiebreak };
}

/** Quantas linhas de set a folha mostra: só as que ainda podem ser jogadas. */
export function visibleSetRows(regulation: Regulation, periods: SheetPeriod[]) {
  if (regulation.completion.mode !== 'sets') return 0;
  const { setsToWin } = regulation.completion;
  let setsA = 0;
  let setsB = 0;
  let rows = 0;
  for (const item of periods) {
    rows += 1;
    const target = setTarget(regulation, rows);
    const high = Math.max(item.scoreA, item.scoreB);
    if (!Number.isFinite(item.scoreA) || !Number.isFinite(item.scoreB) || high < target) break;
    if (item.scoreA > item.scoreB) setsA += 1; else setsB += 1;
    if (setsA >= setsToWin || setsB >= setsToWin) return rows;
  }
  return Math.min(setsToWin * 2 - 1, Math.max(setsToWin, rows + (rows && (setsA + setsB === rows) ? 1 : 0)));
}
