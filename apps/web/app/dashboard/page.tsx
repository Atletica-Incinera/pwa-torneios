'use client';

import Link from 'next/link';
import { Radio, Shield, Trophy, Users } from 'lucide-react';
import { AppShell, SectionTitle } from '../components/AppShell';
import { StatefulMatchCard } from '../components/StatefulMatchCard';
import { athletes, matches, teams, tournaments } from '../lib/repositories/catalog-repository';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

export default function DashboardPage() {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const editionTournaments = tournaments.filter((item) => item.editionId === activeEdition?.id);
  const editionMatches = matches.filter((item) => item.editionId === activeEdition?.id);
  const createdTeams = Object.values(state.teams).filter((item) => item.created).length;
  const createdAthletes = Object.values(state.athletes).filter((item) => item.created).length;
  const createdTournaments = Object.values(state.tournaments).filter((item) => item.created && item.editionId === activeEdition?.id).length;
  const liveMatches = editionMatches.filter((item) => (state.matches[item.id]?.status ?? item.status) === 'Ao vivo').length + Object.values(state.matches).filter((item) => item.created && item.editionId === activeEdition?.id && item.status === 'Ao vivo').length;
  const drafts = editionTournaments.filter((item) => (state.tournaments[item.id]?.status ?? item.status) === 'Rascunho').length + Object.values(state.tournaments).filter((item) => item.created && item.editionId === activeEdition?.id && item.status === 'Rascunho').length;
  const createdMatches = Object.entries(state.matches).filter(([, item]) => item.created && item.editionId === activeEdition?.id).map(([id, item]) => ({ id, editionId: item.editionId, time: item.time ?? '--:--', date: item.date ?? 'A definir', discipline: item.discipline ?? state.preferences.selectedDiscipline, entryA: item.entryA ?? 'Equipe A', logoA: item.logoA ?? '', entryB: item.entryB ?? 'Equipe B', logoB: item.logoB ?? '', scoreA: item.scoreA ?? null, scoreB: item.scoreB ?? null, venue: item.venue ?? 'A definir', phase: item.phase ?? 'Fase atual', status: item.status ?? 'Agendada' }));
  const nextMatch = [...editionMatches, ...createdMatches].find((item) => (state.matches[item.id]?.status ?? item.status) === 'Agendada') ?? editionMatches[0];
  const stats = [
    { label: 'Equipes', value: String(teams.length + createdTeams), meta: 'Atléticas inscritas', icon: Shield, tone: 'blue', href: '/teams' },
    { label: 'Atletas', value: String(athletes.length + createdAthletes), meta: 'Cadastros ativos', icon: Users, tone: 'pink', href: '/athletes' },
    { label: 'Modalidades', value: String(editionTournaments.length + createdTournaments), meta: `${drafts} em configuração`, icon: Trophy, tone: 'orange', href: '/tournaments' },
    { label: 'Jogos ao vivo', value: String(liveMatches), meta: liveMatches ? 'Agora' : 'Nenhum agora', icon: Radio, tone: 'blue', href: `/matches?modalidade=${encodeURIComponent(state.preferences.selectedDiscipline)}` },
  ] as const;
  return <AppShell active="home" eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="O INTERENG CHEGOU!" subtitle="Visão geral da edição ativa"><section className="stats-grid" aria-label="Resumo da edição">{stats.map(({ label, value, meta, icon: Icon, tone, href }) => <Link className={`stat-card stat-${tone}`} key={label} href={href}><div className="stat-icon"><Icon size={24} /></div><strong>{value}</strong><span>{label}</span><small>{meta}</small></Link>)}</section>{nextMatch ? <section className="section-block"><SectionTitle eyebrow="AGENDA" title="PRÓXIMO CONFRONTO" href={`/matches?modalidade=${encodeURIComponent(nextMatch.discipline)}`} linkLabel="Agenda" /><StatefulMatchCard href={`/matches/${nextMatch.id}`} match={nextMatch} /></section> : null}</AppShell>;
}
