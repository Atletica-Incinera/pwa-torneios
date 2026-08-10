'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { teams as teamCatalog } from '../lib/repositories/catalog-repository';
import { formatDisciplineRule, resolveDisciplineRule } from '../lib/discipline-rules';

type TournamentContext = { id: string; editionId?: string; discipline: string; name: string; phase: string };
export function MatchCreationForm({ disciplines, participants, tournaments, cancelDiscipline }: { disciplines: string[]; participants: string[]; tournaments: TournamentContext[]; cancelDiscipline: string }) {
  const router = useRouter(); const { state, commit } = useFrontendState(); const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const [discipline, setDiscipline] = useState(canManageDiscipline(session, cancelDiscipline) ? cancelDiscipline : ''); const [tournamentId, setTournamentId] = useState(''); const [teamA, setTeamA] = useState(''); const [teamB, setTeamB] = useState(''); const [dateTime, setDateTime] = useState(''); const [venue, setVenue] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(teamA || teamB || dateTime || venue) && !submitting);
  const managedTournaments = useMemo(() => { const seeded = tournaments.filter((item) => !item.editionId || item.editionId === activeEdition?.id).map((item) => ({ ...item, phase: state.tournaments[item.id]?.phases[0]?.name ?? item.phase })); const created = Object.entries(state.tournaments).filter(([, item]) => item.created && item.editionId === activeEdition?.id && item.status !== 'Rascunho').map(([id, item]) => ({ id, editionId: item.editionId, discipline: item.discipline ?? '', name: item.name ?? 'Categoria', phase: item.phases[0]?.name ?? 'Fase atual' })); return [...seeded, ...created]; }, [activeEdition?.id, state.tournaments, tournaments]);
  const availableDisciplines = useMemo(() => [...new Set([...disciplines, ...managedTournaments.map((item) => item.discipline)])].filter((item) => item && canManageDiscipline(session, item)), [disciplines, managedTournaments, session]);
  const disciplineTournaments = managedTournaments.filter((item) => item.discipline === discipline);
  const effectiveTournamentId = disciplineTournaments.length === 1 ? disciplineTournaments[0].id : tournamentId;
  const tournament = disciplineTournaments.find((item) => item.id === effectiveTournamentId);
  const eligibleParticipants = tournament && state.tournaments[tournament.id]?.participants.length ? state.tournaments[tournament.id].participants : participants;
  const disciplineRule = resolveDisciplineRule(discipline, state.disciplines[discipline]);

  function changeDiscipline(value: string) { setDiscipline(value); setTournamentId(''); setTeamA(''); setTeamB(''); setError(''); commit((current) => ({ ...current, preferences: { ...current.preferences, selectedDiscipline: value } })); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!activeEdition || !discipline || !tournament || !teamA || !teamB || !dateTime || !venue.trim()) { setError('Selecione modalidade, categoria e preencha todos os dados do jogo.'); return; }
    if (teamA === teamB) { setError('Selecione equipes diferentes para o confronto.'); return; }
    const [date, time] = dateTime.split('T');
    const editionMatches = Object.values(state.matches).filter((item) => item.editionId === activeEdition.id && item.status !== 'Cancelada');
    const duplicate = editionMatches.some((item) => item.date === date && item.time === time && ((item.entryA === teamA && item.entryB === teamB) || (item.entryA === teamB && item.entryB === teamA)));
    if (duplicate) { setError('Este confronto já está agendado nesse horário.'); return; }
    const teamConflict = editionMatches.some((item) => item.date === date && item.time === time && [item.entryA, item.entryB].some((team) => team === teamA || team === teamB));
    if (teamConflict) { setError('Uma das equipes já possui outra partida nesse horário.'); return; }
    const logoFor = (team: string) => teamCatalog.find((item) => item.name === team)?.logo ?? Object.values(state.teams).find((item) => item.name === team)?.logo ?? '';
    setSubmitting(true);
    const id = `match-${Date.now()}`;
    const saved = commit((current) => ({ ...current, matches: { ...current.matches, [id]: { created: true, editionId: activeEdition.id, tournamentId: tournament.id, discipline, entryA: teamA, entryB: teamB, logoA: logoFor(teamA), logoB: logoFor(teamB), date, time, venue: venue.trim(), phase: tournament.phase, status: 'Agendada', scoreA: null, scoreB: null, rules: disciplineRule, currentPeriod: 1, events: [], clockSeconds: 0, paused: true } } }), { action: 'Partida agendada', entity: `${teamA} × ${teamB}`, after: `${discipline} · ${formatDisciplineRule(disciplineRule)} · ${dateTime}` });
    if (saved) { router.push(`/matches?modalidade=${encodeURIComponent(discipline)}&created=1`); router.refresh(); } else setSubmitting(false);
  }

  return <form className="entity-form" onSubmit={submit} noValidate><div className="form-contract-note"><Info size={18} /><p>{tournament ? <><strong>{tournament.name}</strong> · fase atual: {tournament.phase}.<br /><span>Regra aplicada: {formatDisciplineRule(disciplineRule)} · ação de placar: {disciplineRule.scoringEvent}.</span></> : 'Selecione a modalidade e a categoria para carregar fase, participantes e regras do jogo.'}</p></div><label><span>Modalidade</span><select value={discipline} onChange={(event) => changeDiscipline(event.target.value)} required><option value="" disabled>Selecione a modalidade</option>{availableDisciplines.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Categoria / chave do InterEng</span><select value={effectiveTournamentId} onChange={(event) => { setTournamentId(event.target.value); setTeamA(''); setTeamB(''); setError(''); }} required disabled={!discipline}><option value="" disabled>Selecione a categoria</option>{disciplineTournaments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Equipe A</span><select value={teamA} onChange={(event) => { setTeamA(event.target.value); setError(''); }} required disabled={!tournament}><option value="" disabled>Selecione</option>{eligibleParticipants.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Equipe B</span><select value={teamB} onChange={(event) => { setTeamB(event.target.value); setError(''); }} required disabled={!tournament}><option value="" disabled>Selecione</option>{eligibleParticipants.filter((item) => item !== teamA).map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Data e hora</span><input type="datetime-local" value={dateTime} onChange={(event) => { setDateTime(event.target.value); setError(''); }} required /></label><label><span>Local</span><input value={venue} onChange={(event) => { setVenue(event.target.value); setError(''); }} placeholder="Ex.: Ginásio CIn" required /></label>{error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}<div className="form-actions"><Link href={`/matches?modalidade=${encodeURIComponent(cancelDiscipline)}`} className="secondary-button">Cancelar</Link><button type="submit" className="primary-button" disabled={submitting || !tournament}>{submitting ? 'Agendando…' : 'Agendar jogo'}</button></div></form>;
}
