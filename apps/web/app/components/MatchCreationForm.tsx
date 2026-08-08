'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFrontendState } from '../lib/frontend-state';

type TournamentContext = { id: string; discipline: string; name: string; phase: string };
export function MatchCreationForm({ disciplines, participants, tournaments, cancelDiscipline }: { disciplines: string[]; participants: string[]; tournaments: TournamentContext[]; cancelDiscipline: string }) {
  const router = useRouter();
  const { state, commit } = useFrontendState();
  const [discipline, setDiscipline] = useState('');
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [venue, setVenue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const managedTournaments = useMemo(() => {
    const seeded = tournaments.map((item) => ({ ...item, phase: state.tournaments[item.id]?.phases[0]?.name ?? item.phase }));
    const created = Object.entries(state.tournaments).filter(([, item]) => item.created && item.status !== 'Rascunho').map(([id, item]) => ({ id, discipline: item.discipline ?? '', name: item.name ?? 'Torneio', phase: item.phases[0]?.name ?? 'Fase atual' }));
    return [...seeded, ...created];
  }, [state.tournaments, tournaments]);
  const availableDisciplines = useMemo(() => [...new Set([...disciplines, ...managedTournaments.map((item) => item.discipline)])].filter(Boolean), [disciplines, managedTournaments]);
  const tournament = useMemo(() => managedTournaments.find((item) => item.discipline === discipline), [discipline, managedTournaments]);
  const eligibleParticipants = tournament && state.tournaments[tournament.id]?.participants.length ? state.tournaments[tournament.id].participants : participants;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!discipline || !teamA || !teamB || !dateTime || !venue.trim()) {
      setError('Selecione a modalidade e preencha todos os dados do jogo.');
      return;
    }
    if (teamA === teamB) {
      setError('Selecione equipes diferentes para o confronto.');
      return;
    }
    setSubmitting(true);
    const id = `match-${Date.now()}`;
    const [date, time] = dateTime.split('T');
    commit((current) => ({ ...current, matches: { ...current.matches, [id]: { created: true, discipline, entryA: teamA, entryB: teamB, logoA: '', logoB: '', date, time, venue: venue.trim(), phase: tournament?.phase ?? 'Fase atual', status: 'Agendada' } } }), { action: 'Partida agendada', entity: `${teamA} × ${teamB}`, after: `${discipline} · ${dateTime}` });
    router.push(`/matches?modalidade=${encodeURIComponent(discipline)}&created=1`);
    router.refresh();
  }

  return (
    <form className="entity-form" onSubmit={submit} noValidate>
      <div className="form-contract-note"><Info size={18} /><p>{tournament ? <><strong>{tournament.name}</strong> • fase atual: {tournament.phase}.</> : 'Selecione a modalidade para identificar o torneio e a fase atual.'}</p></div>
      <label><span>Modalidade</span><select value={discipline} onChange={(event) => { setDiscipline(event.target.value); setTeamA(''); setTeamB(''); setError(''); }} required><option value="" disabled>Selecione a modalidade</option>{availableDisciplines.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Equipe A</span><select value={teamA} onChange={(event) => { setTeamA(event.target.value); setError(''); }} required><option value="" disabled>Selecione</option>{eligibleParticipants.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Equipe B</span><select value={teamB} onChange={(event) => { setTeamB(event.target.value); setError(''); }} required><option value="" disabled>Selecione</option>{eligibleParticipants.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Data e hora</span><input type="datetime-local" value={dateTime} onChange={(event) => { setDateTime(event.target.value); setError(''); }} required /></label>
      <label><span>Local</span><input value={venue} onChange={(event) => { setVenue(event.target.value); setError(''); }} placeholder="Ex.: Ginásio CIn" required /></label>
      {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
      <div className="form-actions"><Link href={`/matches?modalidade=${encodeURIComponent(cancelDiscipline)}`} className="secondary-button">Cancelar</Link><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Agendando…' : 'Agendar jogo'}</button></div>
    </form>
  );
}
