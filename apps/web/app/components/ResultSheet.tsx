'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, UserX } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useUi } from './UiProvider';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { listMatches, type MatchView } from '../lib/edition-catalog';
import { resolveRegulation } from '../lib/regulation';
import { checkSheet, visibleSetRows, type SheetPeriod } from '../lib/match-result';
import { isEliminationPhase, walkoverScores } from '../lib/match-lifecycle';
import { isLive, matchStatus } from '../lib/status';
import { formatMatchDateLabel } from '../lib/date-utils';

type Mode = 'score' | 'walkover';
type Cell = { a: string; b: string };

const toNumber = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));
const toPeriods = (cells: Cell[]): SheetPeriod[] => cells.map((cell) => ({ scoreA: toNumber(cell.a), scoreB: toNumber(cell.b) }));

/**
 * Folha de resultado: o jogo entra pela súmula em segundos.
 *
 * No vôlei, uma linha por set (o 3º só aparece em 1 × 1); nos esportes por
 * tempo, o placar final, com as parciais por tempo opcionais. Empate que o
 * regulamento não admite pede o desempate ali mesmo. A outra aba resolve o
 * W.O. em dois toques, com o placar do regulamento.
 */
export function ResultSheet({ match }: { match: MatchView }) {
  const router = useRouter();
  const { state, dispatch } = useFrontendState();
  const { session } = useFrontendSession();
  const { confirm } = useUi();
  const operation = state.matches[match.id] ?? {};
  const regulation = useMemo(() => resolveRegulation(match.discipline, state.disciplines[match.discipline], operation.rules), [match.discipline, operation.rules, state.disciplines]);
  const isSets = regulation.completion.mode === 'sets';
  const knockout = match.id.includes('-advanced-') || isEliminationPhase(match.phase);
  const [mode, setMode] = useState<Mode>('score');
  const [cells, setCells] = useState<Cell[]>(() => Array.from({ length: isSets ? 3 : regulation.base.periodCount }, () => ({ a: '', b: '' })));
  const [finalA, setFinalA] = useState('');
  const [finalB, setFinalB] = useState('');
  const [byPeriod, setByPeriod] = useState(false);
  const [tiebreakA, setTiebreakA] = useState('');
  const [tiebreakB, setTiebreakB] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allowed = canManageDiscipline(session, match.discipline);
  const pending = match.status === matchStatus.scheduled || match.status === matchStatus.postponed || (isLive(match.status) && !(operation.events?.length));
  const sidesDefined = !match.aDefinirA && !match.aDefinirB;

  const setRows = isSets ? visibleSetRows(regulation, toPeriods(cells)) : 0;
  const periods = isSets ? toPeriods(cells.slice(0, setRows)) : byPeriod ? toPeriods(cells) : [];
  const check = checkSheet(regulation, { periods, scoreA: isSets ? undefined : toNumber(finalA), scoreB: isSets ? undefined : toNumber(finalB), knockout });
  const typed = isSets ? cells.slice(0, setRows).some((cell) => cell.a !== '' || cell.b !== '') : finalA !== '' || finalB !== '';

  // Próximo jogo da mesma modalidade ainda sem resultado: "Salvar e próximo"
  // percorre a pilha de súmulas sem voltar à agenda a cada jogo.
  const next = useMemo(() => listMatches(state)
    .filter((item) => item.id !== match.id && item.discipline === match.discipline && item.status === matchStatus.scheduled && !item.aDefinirA && !item.aDefinirB)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0], [match.discipline, match.id, state]);

  function updateCell(index: number, side: 'a' | 'b', value: string) {
    const clean = value.replace(/\D/g, '').slice(0, 3);
    setCells((current) => current.map((cell, position) => position === index ? { ...cell, [side]: clean } : cell));
    setError('');
  }

  async function save(event: FormEvent, goNext = false) {
    event.preventDefault();
    if (submitting) return;
    if (!check.ok) { setError(check.message); return; }
    let tiebreak;
    if (check.needsTiebreak) {
      const a = toNumber(tiebreakA);
      const b = toNumber(tiebreakB);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) { setError(`Empate não vale aqui: informe ${regulation.knockout.label.toLocaleLowerCase('pt-BR')} com vencedor.`); return; }
      const winner = a > b ? match.entryA : match.entryB;
      tiebreak = { method: regulation.knockout.method, label: regulation.knockout.label, scoreA: a, scoreB: b, winner, reason: `${winner} venceu ${regulation.knockout.label.toLocaleLowerCase('pt-BR')} por ${Math.max(a, b)} × ${Math.min(a, b)}`, decidedBy: session?.name ?? 'Mesa', at: new Date().toISOString() };
    }
    setSubmitting(true);
    const detail = isSets ? check.periods.map((item) => `${item.scoreA}-${item.scoreB}`).join(' · ') : `${check.scoreA} × ${check.scoreB}`;
    const saved = await dispatch({
      type: 'match/recordResult',
      payload: { id: match.id, scoreA: check.scoreA, scoreB: check.scoreB, periods: check.periods.length ? check.periods : undefined, tiebreak },
      audit: { action: 'Resultado lançado pela súmula', entity: `${match.entryA} × ${match.entryB}`, after: detail },
    });
    setSubmitting(false);
    if (!saved.ok) { setError(saved.error ?? 'Não foi possível lançar o resultado.'); return; }
    router.push(goNext && next ? `/matches/${next.id}/resultado` : `/matches/${match.id}`);
  }

  async function walkover(absent: 'home' | 'away') {
    if (submitting) return;
    const winnerSide = absent === 'home' ? 'away' : 'home';
    const winner = winnerSide === 'home' ? match.entryA : match.entryB;
    const loser = absent === 'home' ? match.entryA : match.entryB;
    const scores = walkoverScores(regulation, winnerSide);
    if (!(await confirm({ title: `W.O. para ${winner}?`, message: `${loser} não compareceu. Resultado oficial: ${match.entryA} ${scores.scoreA} × ${scores.scoreB} ${match.entryB}, pelo regulamento.`, confirmLabel: 'Confirmar W.O.', danger: true }))) return;
    setSubmitting(true);
    const saved = await dispatch({
      type: 'match/update',
      payload: { id: match.id, patch: { status: 'W.O.', walkoverWinner: winner, reason: `Ausência de ${loser}`, ...scores }, cascade: true },
      audit: { action: 'W.O. registrado', entity: `${match.entryA} × ${match.entryB}`, after: `${winner} vence por W.O.`, reason: `Ausência de ${loser}` },
    });
    setSubmitting(false);
    if (saved.ok) router.push(`/matches/${match.id}`);
    else setError(saved.error ?? 'Não foi possível registrar o W.O.');
  }

  if (!allowed) return <div className="info-banner"><p>Seu perfil não pode lançar resultados de {match.discipline}.</p></div>;
  if (!sidesDefined) return <div className="info-banner"><p>Os dois lados deste jogo ainda não estão definidos. Defina os participantes antes de lançar o resultado.</p><Link href={`/matches/${match.id}/manage`} className="secondary-button">Definir participantes</Link></div>;
  if (!pending) return <div className="info-banner"><p>Este jogo já tem resultado ou lances registrados. Para corrigir o placar, use a retificação.</p><Link href={`/matches/${match.id}/manage`} className="secondary-button">Retificar resultado</Link></div>;

  return <section className="result-sheet">
    <p className="result-sheet-context">{match.stage} · {formatMatchDateLabel(match.date)} · {match.time} · {match.venue}</p>
    <div className="segmented-control" role="tablist" aria-label="Tipo de resultado">
      <button type="button" role="tab" aria-selected={mode === 'score'} className={mode === 'score' ? 'active' : ''} onClick={() => setMode('score')}><ClipboardCheck size={16} aria-hidden="true" />Placar</button>
      <button type="button" role="tab" aria-selected={mode === 'walkover'} className={mode === 'walkover' ? 'active' : ''} onClick={() => setMode('walkover')}><UserX size={16} aria-hidden="true" />W.O.</button>
    </div>
    {mode === 'walkover' ? <div className="result-walkover">
      <p>Quem <strong>não compareceu</strong>? A outra equipe vence por {regulation.walkover.winnerScore} × {regulation.walkover.loserScore}, como manda o regulamento.</p>
      <button type="button" className="secondary-button" disabled={submitting} onClick={() => void walkover('home')}>{match.entryA} faltou</button>
      <button type="button" className="secondary-button" disabled={submitting} onClick={() => void walkover('away')}>{match.entryB} faltou</button>
      {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
    </div> : <form className="entity-form result-sheet-form" onSubmit={(event) => void save(event)} noValidate>
      <div className="result-sheet-head" aria-hidden="true"><span>{match.entryA}</span><span /><span>{match.entryB}</span></div>
      {isSets ? cells.slice(0, setRows).map((cell, index) => <div className="result-sheet-row" key={index}>
        <input inputMode="numeric" aria-label={`${index + 1}º set, ${match.entryA}`} value={cell.a} onChange={(event) => updateCell(index, 'a', event.target.value)} autoFocus={index === 0} />
        <small>{index + 1}º set</small>
        <input inputMode="numeric" aria-label={`${index + 1}º set, ${match.entryB}`} value={cell.b} onChange={(event) => updateCell(index, 'b', event.target.value)} />
      </div>) : <>
        <div className="result-sheet-row result-sheet-final">
          <input inputMode="numeric" aria-label={`Placar final, ${match.entryA}`} value={finalA} onChange={(event) => { setFinalA(event.target.value.replace(/\D/g, '').slice(0, 3)); setError(''); }} autoFocus />
          <small>Final</small>
          <input inputMode="numeric" aria-label={`Placar final, ${match.entryB}`} value={finalB} onChange={(event) => { setFinalB(event.target.value.replace(/\D/g, '').slice(0, 3)); setError(''); }} />
        </div>
        <label className="checkbox-field result-sheet-toggle"><input type="checkbox" checked={byPeriod} onChange={(event) => setByPeriod(event.target.checked)} /><span>Informar por {regulation.base.periodLabel.toLocaleLowerCase('pt-BR')} (opcional)</span></label>
        {byPeriod ? cells.map((cell, index) => <div className="result-sheet-row" key={index}>
          <input inputMode="numeric" aria-label={`${index + 1}º ${regulation.base.periodLabel}, ${match.entryA}`} value={cell.a} onChange={(event) => updateCell(index, 'a', event.target.value)} />
          <small>{index + 1}º {regulation.base.periodLabel.toLocaleLowerCase('pt-BR')}</small>
          <input inputMode="numeric" aria-label={`${index + 1}º ${regulation.base.periodLabel}, ${match.entryB}`} value={cell.b} onChange={(event) => updateCell(index, 'b', event.target.value)} />
        </div>) : null}
      </>}
      {check.ok && check.needsTiebreak ? <fieldset className="result-sheet-tiebreak">
        <legend>{regulation.knockout.label} — empate não vale nesta partida</legend>
        <div className="result-sheet-row">
          <input inputMode="numeric" aria-label={`${regulation.knockout.label}, ${match.entryA}`} value={tiebreakA} onChange={(event) => setTiebreakA(event.target.value.replace(/\D/g, '').slice(0, 2))} />
          <small>{regulation.knockout.label}</small>
          <input inputMode="numeric" aria-label={`${regulation.knockout.label}, ${match.entryB}`} value={tiebreakB} onChange={(event) => setTiebreakB(event.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>
      </fieldset> : null}
      {typed && !check.ok ? <p className="form-hint" role="status">{check.message}</p> : null}
      {check.ok ? <p className="result-sheet-summary" role="status">{check.scoreA > check.scoreB ? `${match.entryA} vence` : check.scoreB > check.scoreA ? `${match.entryB} vence` : check.needsTiebreak ? 'Empate: decide no desempate' : 'Empate'} · {check.scoreA} × {check.scoreB}{isSets ? ` em sets (${check.periods.map((item) => `${item.scoreA}-${item.scoreB}`).join(', ')})` : ''}</p> : null}
      {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
      <div className="form-actions">
        <Link href={`/matches/${match.id}`} className="secondary-button">Cancelar</Link>
        {next ? <button type="button" className="secondary-button" disabled={submitting || !check.ok} onClick={(event) => void save(event as unknown as FormEvent, true)}>Salvar e próximo</button> : null}
        <button type="submit" className="primary-button" disabled={submitting || !check.ok}>{submitting ? 'Salvando…' : 'Salvar resultado'}</button>
      </div>
    </form>}
  </section>;
}
