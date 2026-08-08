'use client';

import Link from 'next/link';
import { CalendarClock, Radio, Shield, Trophy, UserRound, Users } from 'lucide-react';
import { AppShell, SectionTitle } from '../components/AppShell';
import { StatefulMatchCard } from '../components/StatefulMatchCard';
import { athletes, matches, teams, tournaments } from '../lib/mock-data';
import { useFrontendState } from '../lib/frontend-state';

export default function DashboardPage() {
  const { state } = useFrontendState();
  const createdTeams = Object.values(state.teams).filter((item) => item.created).length;
  const createdAthletes = Object.values(state.athletes).filter((item) => item.created).length;
  const createdTournaments = Object.values(state.tournaments).filter((item) => item.created).length;
  const liveMatches = matches.filter((item) => (state.matches[item.id]?.status ?? item.status) === 'Ao vivo').length + Object.values(state.matches).filter((item) => item.created && item.status === 'Ao vivo').length;
  const drafts = tournaments.filter((item) => (state.tournaments[item.id]?.status ?? item.status) === 'Rascunho').length + Object.values(state.tournaments).filter((item) => item.created && item.status === 'Rascunho').length;
  const scheduled = matches.filter((item) => (state.matches[item.id]?.status ?? item.status) === 'Agendada').length + Object.values(state.matches).filter((item) => item.created && item.status === 'Agendada').length;
  const nextMatch = matches.find((item) => (state.matches[item.id]?.status ?? item.status) === 'Agendada') ?? matches[0];
  const stats = [
    { label: 'Equipes', value: String(teams.length + createdTeams), meta: 'Atléticas inscritas', icon: Shield, tone: 'blue', href: '/teams' },
    { label: 'Atletas', value: String(athletes.length + createdAthletes), meta: 'Cadastros ativos', icon: Users, tone: 'pink', href: '/athletes' },
    { label: 'Torneios', value: String(tournaments.length + createdTournaments), meta: `${drafts} em rascunho`, icon: Trophy, tone: 'orange', href: '/tournaments' },
    { label: 'Jogos ao vivo', value: String(liveMatches), meta: liveMatches ? 'Agora' : 'Nenhum agora', icon: Radio, tone: 'blue', href: '/matches?modalidade=Futsal' },
  ] as const;
  const pendingActions = [
    { href: '/tournaments', label: `${drafts} torneio(s) em configuração`, meta: 'Finalize fases e participantes', icon: Trophy },
    { href: '/teams', label: 'Revisar elencos por equipe', meta: 'Cadastre atletas exclusivamente nas equipes', icon: UserRound },
    { href: '/matches?modalidade=Futsal', label: `${scheduled} partida(s) agendada(s)`, meta: 'Revise horário e local', icon: CalendarClock },
  ];
  return <AppShell active="home" eyebrow="INTERENG 2026" title="O INTERENG CHEGOU!" subtitle="Visão geral da competição"><section className="stats-grid" aria-label="Resumo da competição">{stats.map(({ label, value, meta, icon: Icon, tone, href }) => <Link className={`stat-card stat-${tone}`} key={label} href={href}><div className="stat-icon"><Icon size={24} /></div><strong>{value}</strong><span>{label}</span><small>{meta}</small></Link>)}</section><section className="section-block"><SectionTitle eyebrow="PRÓXIMO JOGO" title="HOJE EM QUADRA" href={`/matches?modalidade=${encodeURIComponent(nextMatch.discipline)}`} linkLabel="Agenda" /><StatefulMatchCard href={`/matches/${nextMatch.id}`} match={nextMatch} /></section><section className="section-block compact-list"><SectionTitle eyebrow="GESTÃO" title="PENDÊNCIAS" /><div className="module-list">{pendingActions.map(({ href, label, meta, icon: Icon }) => <Link href={href} key={label}><span><Icon size={21} /></span><div><strong>{label}</strong><small>{meta}</small></div><b>›</b></Link>)}</div></section></AppShell>;
}
