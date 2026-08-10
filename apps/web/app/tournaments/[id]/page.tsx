import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Brackets, CalendarClock, ListChecks } from 'lucide-react';
import { AppShell, SectionTitle, StatusBadge, TeamMark } from '../../components/AppShell';
import { TournamentResults } from '../../components/TournamentResults';
import { TournamentManageLink } from '../../components/TournamentManageLink';
import { standings, tournaments } from '../../lib/repositories/catalog-repository';

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = tournaments.find((item) => item.id === id);
  if (!tournament) notFound();

  return (
    <AppShell active="tournaments" eyebrow={`${tournament.discipline.toUpperCase()} • INTERENG 2026`} title={tournament.name.toUpperCase()} subtitle={`${tournament.phase} • disputa da modalidade`}>
      <section className="tournament-hero tournament-hero-single" id="overview"><div className="hero-score"><small>FASE ATUAL</small><strong>{tournament.phase.toUpperCase()}</strong><span>{tournament.entries} participantes</span></div></section>

      <section className="section-block tournament-results-first" id="results"><SectionTitle eyebrow="ACOMPANHAMENTO AO CHEGAR" title="CLASSIFICAÇÃO E FASES" /><TournamentResults tournamentId={tournament.id} discipline={tournament.discipline} fallbackParticipants={standings.map((entry) => entry.name)} /></section>

      <TournamentManageLink id={tournament.id} discipline={tournament.discipline} />
      <nav className="detail-tabs" aria-label="Seções da modalidade"><a href="#results">Classificação</a><a href="#phases">Fases</a><a href="#entries">Participantes</a><a href="#games">Jogos</a></nav>

      <section className="section-block" id="phases"><SectionTitle eyebrow="FORMATO" title="FASES E GRUPOS" /><div className="phase-timeline"><article><span>01</span><div><StatusBadge tone="blue">Concluída</StatusBadge><h3>Fase de grupos</h3><p>2 grupos • 4 participantes • avançam 2</p></div><ListChecks size={22} /></article><article><span>02</span><div><StatusBadge tone="orange">Atual</StatusBadge><h3>Mata-mata</h3><p>Semifinais e final • eliminação simples</p></div><Brackets size={22} /></article></div></section>

      <section className="section-block" id="entries"><SectionTitle eyebrow="PARTICIPANTES" title="INSCRITOS" /><div className="entry-grid">{standings.map((entry, index) => <div className="entry-chip" key={entry.name}><TeamMark initial={entry.name[0]} tone={index % 2 ? 'pink' : 'blue'} logo={entry.logo} small /><strong>{entry.name}</strong><span>Seed {index + 1}</span></div>)}</div></section>

      <section className="section-block" id="games"><SectionTitle eyebrow="AGENDA" title="JOGOS" /><Link href={`/matches?modalidade=${encodeURIComponent(tournament.discipline)}`} className="wide-action"><CalendarClock size={18} /> VER AGENDA DE {tournament.discipline.toUpperCase()} <span>›</span></Link></section>
    </AppShell>
  );
}
