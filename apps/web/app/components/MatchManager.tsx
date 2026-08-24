'use client';

import { FormEvent, useMemo, useState } from 'react';
import { PencilLine, TriangleAlert } from 'lucide-react';
import { getActiveEdition, MatchCorrectionState, useFrontendState } from '../lib/repositories/browser-repository';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { useUi } from './UiProvider';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { canCorrectResult, matchTransitions, statusRequirements, walkoverScores, type MatchStatus } from '../lib/match-lifecycle';
import { isTerminalMatch } from '../lib/status';
import { resolveRegulation } from '../lib/regulation';
import { collectScheduledMatches, findScheduleConflicts, isBlocking, scheduledDuration } from '../lib/scheduling-rules';
import { analyzeCorrectionImpact } from '../lib/tournament-progression';
import { createId } from '../lib/create-id';

type MatchBase = { id: string; discipline: string; entryA: string; entryB: string; date: string; time: string; venue: string; status: string };

export function MatchManager({ match }: { match: MatchBase }) {
  const { state, dispatch } = useFrontendState();
  const { confirm, prompt, toast } = useUi();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const override = state.matches[match.id] ?? {};
  const currentStatus = (override.status ?? match.status) as MatchStatus;
  const regulation = resolveRegulation(match.discipline, state.disciplines[match.discipline], override.rules);
  const initial = useMemo(() => ({
    date: override.date ?? match.date,
    time: override.time ?? match.time,
    venue: override.venue ?? match.venue,
    status: currentStatus,
    reason: override.reason ?? '',
    walkoverWinner: override.walkoverWinner ?? '',
  }), [currentStatus, match.date, match.time, match.venue, override.date, override.reason, override.time, override.venue, override.walkoverWinner]);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [correction, setCorrection] = useState({ scoreA: String(override.scoreA ?? 0), scoreB: String(override.scoreB ?? 0), reason: '' });

  const requirement = statusRequirements[draft.status];
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const allowed = canManageDiscipline(session, match.discipline);
  const locked = isTerminalMatch(currentStatus);
  const options = matchTransitions[currentStatus] ?? [currentStatus];
  useUnsavedChanges(dirty && !submitting);

  const conflicts = useMemo(() => {
    if (!activeEdition || !draft.date || !draft.time || draft.venue.trim().length < 2) return [];
    return findScheduleConflicts(
      { id: match.id, date: draft.date, time: draft.time, venue: draft.venue.trim(), discipline: match.discipline, entryA: match.entryA, entryB: match.entryB, durationMinutes: scheduledDuration(regulation) },
      collectScheduledMatches(state, activeEdition.id),
      { window: { start: activeEdition.start, end: activeEdition.end } },
    );
  }, [activeEdition, draft.date, draft.time, draft.venue, match.discipline, match.entryA, match.entryB, match.id, regulation, state]);
  const blockingConflicts = conflicts.filter(isBlocking);
  const impact = useMemo(() => analyzeCorrectionImpact(state, match.id), [match.id, state]);

  function update(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!allowed || locked || submitting || !dirty) return;
    if (!draft.date || !draft.time || draft.venue.trim().length < 2) { setError('Preencha data, horário e local.'); return; }
    if (requirement.reason && draft.reason.trim().length < 5) { setError('Descreva o motivo da alteração excepcional.'); return; }
    if (requirement.winner && !draft.walkoverWinner) { setError('Informe qual equipe vence o W.O.'); return; }
    if (requirement.reschedule && draft.date === initial.date && draft.time === initial.time) { setError('Adiar exige uma nova data ou horário para a partida.'); return; }
    if (blockingConflicts.length) { setError(blockingConflicts[0].message); return; }
    if (draft.status !== currentStatus && !(await confirm({
      title: `Mudar para ${draft.status}?`,
      message: requirement.consequence,
      confirmLabel: 'Confirmar',
      danger: ['Cancelada', 'W.O.'].includes(draft.status),
    }))) return;

    setSubmitting(true);
    const walkover = draft.status === 'W.O.' ? walkoverScores(regulation, draft.walkoverWinner === match.entryA ? 'home' : 'away') : null;
    const saved = await dispatch({
      type: 'match/update',
      payload: {
        id: match.id,
        patch: {
          date: draft.date,
          time: draft.time,
          venue: draft.venue.trim(),
          status: draft.status,
          reason: requirement.reason ? draft.reason.trim() : undefined,
          walkoverWinner: draft.status === 'W.O.' ? draft.walkoverWinner : undefined,
          ...(walkover ?? {}),
        },
        // O W.O. define resultado oficial, então o chaveamento avança com ele.
        cascade: Boolean(walkover),
      },
      audit: {
        action: 'Partida alterada',
        entity: `${match.entryA} × ${match.entryB}`,
        before: `${currentStatus} · ${initial.date} ${initial.time} · ${initial.venue}`,
        after: `${draft.status} · ${draft.date} ${draft.time} · ${draft.venue.trim()}${walkover ? ` · ${draft.walkoverWinner} vence por W.O.` : ''}`,
        reason: requirement.reason ? draft.reason.trim() : undefined,
      },
    });
    setSubmitting(false);
    if (!saved.ok) setError('Não foi possível salvar as alterações.');
  }

  async function applyCorrection(event: FormEvent) {
    event.preventDefault();
    if (!allowed || !canCorrectResult(currentStatus)) return;
    const scoreA = Number(correction.scoreA);
    const scoreB = Number(correction.scoreB);
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) { toast('Informe um placar válido.', 'error'); return; }
    if (scoreA === (override.scoreA ?? 0) && scoreB === (override.scoreB ?? 0)) { toast('O placar informado é igual ao atual.', 'error'); return; }
    if (impact.blocked.length) { toast(`Anule antes as partidas já operadas que dependem deste resultado (${impact.blocked.length}).`, 'error'); return; }

    const reason = await prompt({
      title: 'Corrigir resultado encerrado encerrado?',
      message: impact.downstream.length
        ? `${impact.downstream.length} confronto(s) gerado(s) a partir deste resultado serão refeitos, e a classificação será recalculada.`
        : 'A classificação da modalidade será recalculada com o novo placar.',
      label: 'Motivo da retificação',
      placeholder: 'Ex.: erro de digitação conferido na súmula',
      confirmLabel: 'Retificar resultado',
      minLength: 5,
      danger: true,
    });
    if (!reason) return;

    const entry: MatchCorrectionState = { id: createId('correction'), at: new Date().toISOString(), actor: session?.name ?? 'Usuário do app', reason, before: `${override.scoreA ?? 0} × ${override.scoreB ?? 0}`, after: `${scoreA} × ${scoreB}` };
    await dispatch({
      type: 'match/correctResult',
      payload: { id: match.id, scoreA, scoreB, correction: entry },
      audit: { action: 'Resultado retificado', entity: `${match.entryA} × ${match.entryB}`, before: entry.before, after: entry.after, reason },
    });
    setCorrection((current) => ({ ...current, reason: '' }));
  }

  if (!allowed) return <div className="info-banner"><p>Seu perfil não pode editar partidas de {match.discipline}.</p></div>;

  return <>
    <form className="entity-form" onSubmit={save} noValidate>
      <div className="form-contract-note"><p>{locked ? `Esta partida está em estado final (${currentStatus}). Use a retificação de resultado para corrigir o placar.` : requirement.consequence}</p></div>
      <label><span>Data</span><input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} required disabled={locked} /></label>
      <label><span>Horário</span><input type="time" value={draft.time} onChange={(event) => update('time', event.target.value)} required disabled={locked} /></label>
      <label><span>Local</span><input value={draft.venue} onChange={(event) => update('venue', event.target.value)} required disabled={locked} /></label>
      <label><span>Estado da partida</span><select value={draft.status} onChange={(event) => update('status', event.target.value)} disabled={locked}>{options.map((status) => <option key={status}>{status}</option>)}</select></label>
      {requirement.winner ? <label><span>Equipe vencedora do W.O.</span><select value={draft.walkoverWinner} onChange={(event) => update('walkoverWinner', event.target.value)} required disabled={locked}><option value="" disabled>Selecione</option><option>{match.entryA}</option><option>{match.entryB}</option></select><small>Placar regulamentar aplicado: {regulation.walkover.winnerScore} × {regulation.walkover.loserScore}.</small></label> : null}
      {requirement.reason ? <label><span>Motivo</span><input value={draft.reason} onChange={(event) => update('reason', event.target.value)} placeholder="Informe o motivo registrado na auditoria" required disabled={locked} /></label> : null}
      {requirement.reschedule ? <p className="form-hint">Adiar exige uma nova data ou horário: a partida volta ao calendário e sai dos resultados oficiais.</p> : null}
      {conflicts.length ? <ul className={`form-feedback ${blockingConflicts.length ? 'form-feedback-error' : ''}`} role={blockingConflicts.length ? 'alert' : 'status'}>{conflicts.map((item) => <li key={`${item.code}-${item.matchId ?? ''}`}>{item.message}</li>)}</ul> : null}
      {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
      <div className="form-actions"><button type="submit" className="primary-button" disabled={!dirty || submitting || locked || blockingConflicts.length > 0}>{submitting ? 'Salvando…' : 'Salvar alterações'}</button></div>
    </form>

    {canCorrectResult(currentStatus) ? (
      <form className="entity-form correction-form" onSubmit={applyCorrection} noValidate>
        <div className="section-title-row"><div><p className="eyebrow orange">RETIFICAÇÃO</p><h2>CORRIGIR RESULTADO</h2></div><PencilLine size={20} /></div>
        <p className="form-hint">Placar oficial atual: {override.scoreA ?? 0} × {override.scoreB ?? 0}. Toda correção exige motivo, fica registrada na auditoria e recalcula a classificação.</p>
        {impact.blocked.length ? <div className="info-banner" role="alert"><TriangleAlert size={18} /><div><strong>Confrontos seguintes já operados</strong><p>{impact.blocked.join(', ')}. Anule essas partidas antes de retificar este resultado.</p></div></div> : null}
        {impact.downstream.length ? <div className="info-banner" role="status"><TriangleAlert size={18} /><div><strong>Fases impactadas</strong><p>{impact.downstream.length} confronto(s) ainda não iniciado(s) serão refeitos: {impact.downstream.join(', ')}.</p></div></div> : null}
        <div className="rule-fields two-columns">
          <label><span>{match.entryA}</span><input type="number" min="0" value={correction.scoreA} onChange={(event) => setCorrection({ ...correction, scoreA: event.target.value })} /></label>
          <label><span>{match.entryB}</span><input type="number" min="0" value={correction.scoreB} onChange={(event) => setCorrection({ ...correction, scoreB: event.target.value })} /></label>
        </div>
        <div className="form-actions"><button type="submit" className="secondary-button" disabled={impact.blocked.length > 0}>Retificar resultado</button></div>
        {override.corrections?.length ? <ul className="correction-history">{override.corrections.map((item) => <li key={item.id}><strong>{item.before} → {item.after}</strong><span>{item.reason} · {item.actor}</span></li>)}</ul> : null}
      </form>
    ) : null}
  </>;
}
