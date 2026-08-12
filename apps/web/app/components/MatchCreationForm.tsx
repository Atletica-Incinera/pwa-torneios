'use client';

import Link from 'next/link';
import { Info, TriangleAlert } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { formatDisciplineRule, resolveDisciplineRule } from '../lib/discipline-rules';
import { describeCompletion, resolveRegulation } from '../lib/regulation';
import { collectScheduledMatches, findScheduleConflicts, isBlocking, scheduledDuration } from '../lib/scheduling-rules';
import { checkMatchEligibility, teamDirectory } from '../lib/eligibility';
import { createId } from '../lib/create-id';
import { findTeamByName, listCategories } from '../lib/edition-catalog';
import { tournamentStatus } from '../lib/status';

export function MatchCreationForm({ requestedDiscipline }: { requestedDiscipline: string }) {
  const router = useRouter();
  const { state, dispatch, setPreference } = useFrontendState();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const [discipline, setDiscipline] = useState(canManageDiscipline(session, requestedDiscipline) ? requestedDiscipline : '');
  const [tournamentId, setTournamentId] = useState('');
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [venue, setVenue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(teamA || teamB || dateTime || venue) && !submitting);

  // Só categorias publicadas entram na agenda: rascunho ainda não tem confronto.
  const managedTournaments = useMemo(() => listCategories(state, activeEdition?.id)
    .filter((item) => item.status !== tournamentStatus.draft)
    .map((item) => ({ id: item.id, discipline: item.discipline, name: item.name, phase: item.phase })), [activeEdition?.id, state]);

  const availableDisciplines = useMemo(() => [...new Set(managedTournaments.map((item) => item.discipline))].filter((item) => item && canManageDiscipline(session, item)), [managedTournaments, session]);
  const disciplineTournaments = managedTournaments.filter((item) => item.discipline === discipline);
  const effectiveTournamentId = disciplineTournaments.length === 1 ? disciplineTournaments[0].id : tournamentId;
  const tournament = disciplineTournaments.find((item) => item.id === effectiveTournamentId);
  const setup = tournament ? state.tournaments[tournament.id] : undefined;
  // A inscrição na categoria é a fonte da agenda assim que alguém configura a
  // disputa. Enquanto ela não foi configurada, valem as equipes da edição — do
  // contrário nenhuma partida poderia ser marcada numa disputa recém-criada.
  const notConfigured = !setup?.participants.length;
  const eligibleParticipants = useMemo(() => (notConfigured ? teamDirectory(state).map((team) => team.name) : setup!.participants), [notConfigured, setup, state]);
  const effectiveSetup = useMemo(() => ({ participants: eligibleParticipants }), [eligibleParticipants]);
  const disciplineRule = resolveDisciplineRule(discipline, state.disciplines[discipline]);
  const regulation = resolveRegulation(discipline, state.disciplines[discipline]);

  const [date, time] = dateTime.split('T');
  const conflicts = useMemo(() => {
    if (!activeEdition || !discipline || !date || !time || !venue.trim() || !teamA || !teamB) return [];
    return findScheduleConflicts(
      { date, time, venue: venue.trim(), discipline, entryA: teamA, entryB: teamB, durationMinutes: scheduledDuration(regulation) },
      collectScheduledMatches(state, activeEdition.id),
      { window: { start: activeEdition.start, end: activeEdition.end } },
    );
  }, [activeEdition, date, discipline, regulation, state, teamA, teamB, time, venue]);
  const eligibility = useMemo(() => (teamA && teamB ? checkMatchEligibility(state, regulation, effectiveSetup, teamA, teamB) : { ok: true, blocking: [], warnings: [] }), [effectiveSetup, regulation, state, teamA, teamB]);
  const blockingConflicts = conflicts.filter(isBlocking);
  const advisoryConflicts = conflicts.filter((conflict) => !isBlocking(conflict));

  function changeDiscipline(value: string) {
    setDiscipline(value);
    setTournamentId('');
    setTeamA('');
    setTeamB('');
    setError('');
    void setPreference({ selectedDiscipline: value });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!activeEdition || !discipline || !tournament || !teamA || !teamB || !dateTime || !venue.trim()) { setError('Selecione modalidade, categoria e preencha todos os dados do jogo.'); return; }
    if (teamA === teamB) { setError('Selecione equipes diferentes para o confronto.'); return; }
    if (!eligibility.ok) { setError(eligibility.blocking[0]); return; }
    if (blockingConflicts.length) { setError(blockingConflicts[0].message); return; }

    const logoFor = (team: string) => findTeamByName(state, team)?.logo ?? '';
    setSubmitting(true);
    const id = createId('match');
    const saved = await dispatch({
      type: 'match/schedule',
      payload: {
        id,
        match: {
          created: true, editionId: activeEdition.id, tournamentId: tournament.id, discipline,
          entryA: teamA, entryB: teamB, logoA: logoFor(teamA), logoB: logoFor(teamB),
          date, time, venue: venue.trim(), phase: tournament.phase, status: 'Agendada',
          scoreA: null, scoreB: null, rules: disciplineRule,
          currentPeriod: 1, events: [], clockSeconds: 0, paused: true, periodScoreA: 0, periodScoreB: 0, periodResults: [],
        },
      },
      audit: {
        action: 'Partida agendada',
        entity: `${teamA} × ${teamB}`,
        after: `${discipline} · ${formatDisciplineRule(disciplineRule)} · ${dateTime} · ${venue.trim()}`,
        // O alerta aceito vai sozinho para a auditoria: o operador não precisa redigitá-lo.
        reason: advisoryConflicts.length ? advisoryConflicts.map((item) => item.message).join(' ') : undefined,
      },
    });
    if (saved.ok) { router.push(`/matches?modalidade=${encodeURIComponent(discipline)}&created=1`); router.refresh(); } else setSubmitting(false);
  }

  const contractNote = tournament
    ? <><strong>{tournament.name}</strong> · fase atual: {tournament.phase}.<br /><span>{describeCompletion(regulation)} · ação de placar: {regulation.scoring.map((item) => `${item.label} (${item.points})`).join(', ')}.</span></>
    : 'Selecione a modalidade e a categoria para carregar fase, participantes e regras do jogo.';

  return (
    <form className="entity-form" onSubmit={(event) => void submit(event)} noValidate>
      <div className="form-contract-note"><Info size={18} /><p>{contractNote}</p></div>
      <label><span>Modalidade</span><select value={discipline} onChange={(event) => changeDiscipline(event.target.value)} required><option value="" disabled>Selecione a modalidade</option>{availableDisciplines.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Categoria / chave do InterEng</span><select value={effectiveTournamentId} onChange={(event) => { setTournamentId(event.target.value); setTeamA(''); setTeamB(''); setError(''); }} required disabled={!discipline}><option value="" disabled>Selecione a categoria</option>{disciplineTournaments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      {tournament && notConfigured ? <p className="form-hint">Esta categoria ainda não tem participantes definidos, então todas as equipes da edição aparecem. <Link href={`/tournaments/${tournament.id}?aba=regras#participants`}>Inscreva os participantes</Link> para restringir a agenda.</p> : null}
      <label><span>Equipe A</span><select value={teamA} onChange={(event) => { setTeamA(event.target.value); setError(''); }} required disabled={!tournament || !eligibleParticipants.length}><option value="" disabled>Selecione</option>{eligibleParticipants.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Equipe B</span><select value={teamB} onChange={(event) => { setTeamB(event.target.value); setError(''); }} required disabled={!tournament || !eligibleParticipants.length}><option value="" disabled>Selecione</option>{eligibleParticipants.filter((item) => item !== teamA).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Data e hora</span><input type="datetime-local" value={dateTime} onChange={(event) => { setDateTime(event.target.value); setError(''); }} required /></label>
      <label><span>Local</span><input value={venue} onChange={(event) => { setVenue(event.target.value); setError(''); }} placeholder="Ex.: Ginásio CIn" required /></label>
      {eligibility.blocking.length ? <ul className="form-feedback form-feedback-error" role="alert">{eligibility.blocking.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      {blockingConflicts.length ? <ul className="form-feedback form-feedback-error" role="alert">{blockingConflicts.map((item) => <li key={`${item.code}-${item.matchId ?? ''}`}>{item.message}</li>)}</ul> : null}
      {eligibility.warnings.length ? <div className="info-banner" role="status"><TriangleAlert size={18} /><div><strong>Elenco incompleto</strong><ul>{eligibility.warnings.map((item) => <li key={item}>{item}</li>)}</ul><p>O jogo pode ser agendado; ajuste o elenco antes da partida.</p></div></div> : null}
      {advisoryConflicts.length ? <div className="info-banner" role="status"><TriangleAlert size={18} /><div><strong>Alerta de agenda</strong><ul>{advisoryConflicts.map((item) => <li key={`${item.code}-${item.matchId ?? ''}`}>{item.message}</li>)}</ul><p>O alerta fica registrado na auditoria ao confirmar.</p></div></div> : null}
      {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
      <div className="form-actions">
        <Link href={`/matches?modalidade=${encodeURIComponent(discipline || requestedDiscipline)}`} className="secondary-button">Cancelar</Link>
        <button type="submit" className="primary-button" disabled={submitting || !tournament || !eligibility.ok || blockingConflicts.length > 0}>{submitting ? 'Agendando…' : 'Agendar jogo'}</button>
      </div>
    </form>
  );
}
