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
import { collectScheduledMatches, findScheduleConflicts, scheduledDuration } from '../lib/scheduling-rules';
import { analyzeCorrectionImpact } from '../lib/tournament-progression';
import { createId } from '../lib/create-id';
import { resolveMatchDate } from '../lib/date-utils';

type MatchBase = { id: string; discipline: string; entryA: string; entryB: string; date: string; time: string; venue: string; status: string; aDefinirA?: boolean; aDefinirB?: boolean; tournamentId?: string };

export function MatchManager({ match }: { match: MatchBase }) {
  const { state, dispatch } = useFrontendState();
  const { confirm, prompt, toast } = useUi();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const override = state.matches[match.id] ?? {};
  const currentStatus = (override.status ?? match.status) as MatchStatus;
  const regulation = resolveRegulation(match.discipline, state.disciplines[match.discipline], override.rules);
  const rawDate = override.date ?? match.date;

  /*
   * Lado que ainda e um rotulo, e que so uma pessoa sabe resolver.
   *
   * O mata-mata o app resolve sozinho, lendo a classificacao. Ja o grupo de
   * tres jogado como mini-chave -- "VORAZ x PERDEDOR J3", que a planilha traz
   * dentro da fase de grupos -- nao segue regra nenhuma que o app conheca.
   *
   * Sem esta tela esses jogos ficam impossiveis de operar: a mesa nao abre
   * partida sem os dois participantes. E como a geracao do mata-mata exige
   * TODOS os jogos da fase de grupos encerrados, a chave da categoria inteira
   * nunca seria montada. Sao doze jogos assim no InterEng 2026, travando
   * quatro chaveamentos.
   */
  const aDefinirA = Boolean(override.aDefinirA ?? match.aDefinirA);
  const aDefinirB = Boolean(override.aDefinirB ?? match.aDefinirB);
  const temLadoADefinir = aDefinirA || aDefinirB;
  const tournamentId = override.tournamentId ?? match.tournamentId;
  const inscritas = useMemo(() => {
    const categoria = tournamentId ? state.tournaments[tournamentId] : undefined;
    return categoria?.participants ?? [];
  }, [state.tournaments, tournamentId]);
  const [definindo, setDefinindo] = useState({ entryA: '', entryB: '' });
  const [definindoErro, setDefinindoErro] = useState('');
  const [definindoEnviando, setDefinindoEnviando] = useState(false);

  async function definirParticipantes(evento: FormEvent) {
    evento.preventDefault();
    const patch: Record<string, string> = {};
    if (aDefinirA && definindo.entryA) patch.entryA = definindo.entryA;
    if (aDefinirB && definindo.entryB) patch.entryB = definindo.entryB;
    if (!Object.keys(patch).length) {
      setDefinindoErro('Escolha a equipe do lado que ainda está a definir.');
      return;
    }
    const outroLado = aDefinirA && !aDefinirB ? match.entryB : !aDefinirA && aDefinirB ? match.entryA : '';
    if (outroLado && Object.values(patch).includes(outroLado)) {
      setDefinindoErro('Os participantes devem ser diferentes.');
      return;
    }
    if (patch.entryA && patch.entryA === patch.entryB) {
      setDefinindoErro('Os participantes devem ser diferentes.');
      return;
    }
    setDefinindoEnviando(true);
    setDefinindoErro('');
    try {
      await dispatch({
        type: 'match/update',
        payload: { id: match.id, patch },
        audit: {
          action: 'Participante definido',
          entity: `${match.entryA} × ${match.entryB}`,
          after: Object.values(patch).join(' e '),
        },
      });
      toast('Participante definido. A partida já pode ser operada.', 'success');
    } catch (falha) {
      setDefinindoErro(falha instanceof Error ? falha.message : 'Não foi possível definir o participante.');
    } finally {
      setDefinindoEnviando(false);
    }
  }

  const initial = useMemo(() => ({
    entryA: override.entryA ?? match.entryA,
    entryB: override.entryB ?? match.entryB,
    date: rawDate ? resolveMatchDate(rawDate) : '',
    time: override.time ?? match.time,
    venue: override.venue ?? match.venue,
    status: currentStatus,
    reason: override.reason ?? '',
    walkoverWinner: override.walkoverWinner ?? '',
  }), [currentStatus, rawDate, match.time, match.venue, match.entryA, match.entryB, override.date, override.reason, override.time, override.venue, override.walkoverWinner, override.entryA, override.entryB]);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [correction, setCorrection] = useState({ scoreA: String(override.scoreA ?? 0), scoreB: String(override.scoreB ?? 0), reason: '' });

  const requirement = statusRequirements[draft.status];
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const allowed = canManageDiscipline(session, match.discipline);
  const locked = isTerminalMatch(currentStatus);
  const isScheduled = currentStatus === 'Agendada';
  const canEditOpponents = isScheduled;
  const options = matchTransitions[currentStatus] ?? [currentStatus];
  useUnsavedChanges(dirty && !submitting);

  const conflicts = useMemo(() => {
    if (!activeEdition || !draft.date || !draft.time || draft.venue.trim().length < 2) return [];
    return findScheduleConflicts(
      { id: match.id, date: draft.date, time: draft.time, venue: draft.venue.trim(), discipline: match.discipline, entryA: draft.entryA, entryB: draft.entryB, durationMinutes: scheduledDuration(regulation) },
      collectScheduledMatches(state, activeEdition.id),
      { window: { start: activeEdition.start, end: activeEdition.end } },
    );
  }, [activeEdition, draft.date, draft.time, draft.venue, match.discipline, draft.entryA, draft.entryB, match.id, regulation, state]);
  const impact = useMemo(() => analyzeCorrectionImpact(state, match.id), [match.id, state]);

  function update(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!allowed || locked || submitting || !dirty) return;
    const mudouAdversarios = draft.entryA !== initial.entryA || draft.entryB !== initial.entryB;
    if (mudouAdversarios && !canEditOpponents) { setError('Os adversários só podem ser alterados em partidas agendadas.'); return; }
    if (mudouAdversarios && (!draft.entryA || !draft.entryB)) { setError('Informe as duas equipes da partida.'); return; }
    if (mudouAdversarios && draft.entryA === draft.entryB) { setError('Os participantes devem ser equipes diferentes.'); return; }
    if (!draft.date || !draft.time || draft.venue.trim().length < 2) { setError('Preencha data, horário e local.'); return; }
    if (requirement.reason && draft.reason.trim().length < 5) { setError('Descreva o motivo da alteração excepcional.'); return; }
    if (requirement.winner && !draft.walkoverWinner) { setError('Informe qual equipe vence o W.O.'); return; }
    if (requirement.reschedule && draft.date === initial.date && draft.time === initial.time) { setError('Adiar exige uma nova data ou horário para a partida.'); return; }

    let motivoAdversarios = '';

    if (mudouAdversarios) {
      const resposta = await prompt({
        title: 'Alterar adversários do confronto?',
        message: `Os participantes serão alterados de "${initial.entryA} × ${initial.entryB}" para "${draft.entryA} × ${draft.entryB}". Toda alteração de confronto gerado exige justificativa e fica registrada na auditoria.`,
        label: 'Justificativa da alteração',
        placeholder: 'Ex.: ajuste presencial determinado pela comissão organizadora',
        confirmLabel: 'Confirmar alteração',
        minLength: 5,
        danger: true,
      });
      if (!resposta) return;
      motivoAdversarios = resposta.trim();
    }

    if (draft.status !== currentStatus && !(await confirm({
      title: `Mudar para ${draft.status}?`,
      message: requirement.consequence,
      confirmLabel: 'Confirmar',
      danger: ['Cancelada', 'W.O.'].includes(draft.status),
    }))) return;

    setSubmitting(true);
    const walkover = draft.status === 'W.O.' ? walkoverScores(regulation, draft.walkoverWinner === draft.entryA ? 'home' : 'away') : null;
    const finalReason = motivoAdversarios || (requirement.reason ? draft.reason.trim() : undefined);

    const saved = await dispatch({
      type: 'match/update',
      payload: {
        id: match.id,
        patch: {
          ...(canEditOpponents ? { entryA: draft.entryA, entryB: draft.entryB } : {}),
          date: draft.date,
          time: draft.time,
          venue: draft.venue.trim(),
          status: draft.status,
          reason: finalReason,
          walkoverWinner: draft.status === 'W.O.' ? draft.walkoverWinner : undefined,
          ...(walkover ?? {}),
        },
        // O W.O. define resultado oficial, então o chaveamento avança com ele.
        cascade: Boolean(walkover),
      },
      audit: {
        action: mudouAdversarios ? 'Adversários alterados' : 'Partida alterada',
        entity: `${initial.entryA} × ${initial.entryB}`,
        before: `${initial.entryA} × ${initial.entryB} · ${currentStatus} · ${initial.date} ${initial.time} · ${initial.venue}`,
        after: `${draft.entryA} × ${draft.entryB} · ${draft.status} · ${draft.date} ${draft.time} · ${draft.venue.trim()}${walkover ? ` · ${draft.walkoverWinner} vence por W.O.` : ''}`,
        reason: finalReason,
      },
    });
    setSubmitting(false);
    if (!saved.ok) setError('Não foi possível salvar as alterações.');
    else if (mudouAdversarios) toast('Adversários alterados com sucesso.', 'success');
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
      title: 'Corrigir resultado encerrado?',
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
    {temLadoADefinir && isScheduled ? <form className="entity-form definir-participante" onSubmit={definirParticipantes} noValidate>
      <div className="form-contract-note"><p>
        Esta partida depende de um resultado anterior, e por isso ainda não pode ser
        operada. Diga quem joga para liberá-la — a mesa só abre o placar com os dois
        participantes definidos.
      </p></div>
      {aDefinirA ? <label><span>Quem é &ldquo;{match.entryA}&rdquo;</span><select value={definindo.entryA} onChange={(event) => { setDefinindo((atual) => ({ ...atual, entryA: event.target.value })); setDefinindoErro(''); }}><option value="">Selecione a equipe</option>{inscritas.map((equipe) => <option key={equipe}>{equipe}</option>)}</select></label> : null}
      {aDefinirB ? <label><span>Quem é &ldquo;{match.entryB}&rdquo;</span><select value={definindo.entryB} onChange={(event) => { setDefinindo((atual) => ({ ...atual, entryB: event.target.value })); setDefinindoErro(''); }}><option value="">Selecione a equipe</option>{inscritas.map((equipe) => <option key={equipe}>{equipe}</option>)}</select></label> : null}
      {!inscritas.length ? <p className="form-hint">Nenhuma equipe inscrita nesta categoria: inscreva-as na aba Gestão da categoria.</p> : null}
      {definindoErro ? <p className="form-error" role="alert">{definindoErro}</p> : null}
      <div className="form-actions"><button type="submit" className="primary-button" disabled={definindoEnviando || !inscritas.length}>{definindoEnviando ? 'Definindo…' : 'Definir participante'}</button></div>
    </form> : null}
    <form className="entity-form" onSubmit={save} noValidate>
      <div className="form-contract-note">
        <p>
          {locked
            ? `Esta partida está em estado final (${currentStatus}). Use a retificação de resultado para corrigir o placar.`
            : !isScheduled
              ? `Partida em andamento (${currentStatus}). Os participantes só podem ser alterados antes do início do jogo.`
              : requirement.consequence}
        </p>
      </div>

      {canEditOpponents ? <div className="rule-fields two-columns">
        <label>
          <span>Equipe A {aDefinirA ? '(A definir)' : ''}</span>
          {inscritas.length > 0 ? (
            <select
              value={draft.entryA}
              onChange={(event) => update('entryA', event.target.value)}
              disabled={submitting}
            >
              <option value="" disabled>Selecione a equipe</option>
              {!inscritas.includes(draft.entryA) && draft.entryA ? (
                <option value={draft.entryA}>{draft.entryA}</option>
              ) : null}
              {inscritas.map((equipe) => (
                <option key={equipe} value={equipe}>{equipe}</option>
              ))}
            </select>
          ) : (
            <input
              value={draft.entryA}
              onChange={(event) => update('entryA', event.target.value)}
              disabled={submitting}
              required
            />
          )}
        </label>
        <label>
          <span>Equipe B {aDefinirB ? '(A definir)' : ''}</span>
          {inscritas.length > 0 ? (
            <select
              value={draft.entryB}
              onChange={(event) => update('entryB', event.target.value)}
              disabled={submitting}
            >
              <option value="" disabled>Selecione a equipe</option>
              {!inscritas.includes(draft.entryB) && draft.entryB ? (
                <option value={draft.entryB}>{draft.entryB}</option>
              ) : null}
              {inscritas.map((equipe) => (
                <option key={equipe} value={equipe}>{equipe}</option>
              ))}
            </select>
          ) : (
            <input
              value={draft.entryB}
              onChange={(event) => update('entryB', event.target.value)}
              disabled={submitting}
              required
            />
          )}
        </label>
      </div> : null}

      <label><span>Data</span><input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} required disabled={locked} /></label>
      <label><span>Horário</span><input type="time" value={draft.time} onChange={(event) => update('time', event.target.value)} required disabled={locked} /></label>
      <label><span>Local</span><input value={draft.venue} onChange={(event) => update('venue', event.target.value)} required disabled={locked} /></label>
      <label><span>Estado da partida</span><select value={draft.status} onChange={(event) => update('status', event.target.value)} disabled={locked}>{options.map((status) => <option key={status}>{status}</option>)}</select></label>
      {requirement.winner ? <label><span>Equipe vencedora do W.O.</span><select value={draft.walkoverWinner} onChange={(event) => update('walkoverWinner', event.target.value)} required disabled={locked}><option value="" disabled>Selecione</option><option>{draft.entryA}</option><option>{draft.entryB}</option></select><small>Placar regulamentar aplicado: {regulation.walkover.winnerScore} × {regulation.walkover.loserScore}.</small></label> : null}
      {requirement.reason ? <label><span>Motivo</span><input value={draft.reason} onChange={(event) => update('reason', event.target.value)} placeholder="Informe o motivo registrado na auditoria" required disabled={locked} /></label> : null}
      {requirement.reschedule ? <p className="form-hint">Adiar exige uma nova data ou horário: a partida volta ao calendário e sai dos resultados oficiais.</p> : null}
      {conflicts.length ? <ul className="form-feedback" role="status">{conflicts.map((item) => <li key={`${item.code}-${item.matchId ?? ''}`}>{item.message}</li>)}</ul> : null}
      {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
      <div className="form-actions"><button type="submit" className="primary-button" disabled={!dirty || submitting || locked}>{submitting ? 'Salvando…' : 'Salvar alterações'}</button></div>
    </form>

    {canCorrectResult(currentStatus) ? (
      <form className="entity-form correction-form" onSubmit={applyCorrection} noValidate>
        <div className="section-title-row"><div><p className="eyebrow orange">RETIFICAÇÃO</p><h2>CORRIGIR RESULTADO</h2></div><PencilLine size={20} /></div>
        <p className="form-hint">Placar oficial atual: {override.scoreA ?? 0} × {override.scoreB ?? 0}. Toda correção exige motivo, fica registrada na auditoria e recalcula a classificação.</p>
        {impact.blocked.length ? <div className="info-banner" role="alert"><TriangleAlert size={18} /><div><strong>Confrontos seguintes já operados</strong><p>{impact.blocked.join(', ')}. Anule essas partidas antes de retificar este resultado.</p></div></div> : null}
        {impact.downstream.length ? <div className="info-banner" role="status"><TriangleAlert size={18} /><div><strong>Fases impactadas</strong><p>{impact.downstream.length} confronto(s) ainda não iniciado(s) serão refeitos: {impact.downstream.join(', ')}.</p></div></div> : null}
        <div className="rule-fields two-columns">
          <label><span>{draft.entryA}</span><input type="number" min="0" value={correction.scoreA} onChange={(event) => setCorrection({ ...correction, scoreA: event.target.value })} /></label>
          <label><span>{draft.entryB}</span><input type="number" min="0" value={correction.scoreB} onChange={(event) => setCorrection({ ...correction, scoreB: event.target.value })} /></label>
        </div>
        <div className="form-actions"><button type="submit" className="secondary-button" disabled={impact.blocked.length > 0}>Retificar resultado</button></div>
        {override.corrections?.length ? <ul className="correction-history">{override.corrections.map((item) => <li key={item.id}><strong>{item.before} → {item.after}</strong><span>{item.reason} · {item.actor}</span></li>)}</ul> : null}
      </form>
    ) : null}
  </>;
}
