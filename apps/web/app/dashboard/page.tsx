'use client';

import Link from 'next/link';
import { Radio, Shield, Trophy, Users } from 'lucide-react';
import { AppShell, SectionTitle } from '../components/AppShell';
import { MatchCard } from '../components/MatchCard';
import { NoCompetitionsYet } from '../components/NoCompetitionsYet';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { listCategories, listDisciplines, listMatches, listTeams } from '../lib/edition-catalog';
import { isLive, matchStatus, tournamentStatus } from '../lib/status';
import { canManageEdition, isSuperAdmin, useFrontendSession } from '../lib/frontend-session';

export default function DashboardPage() {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  if (state.competitions.length === 0) {
    return <AppShell active="home" eyebrow="INTERENG" title="O INTERENG CHEGOU!" subtitle="Comece cadastrando a primeira competição">
      <NoCompetitionsYet canCreate={isSuperAdmin(session)} />
    </AppShell>;
  }
  const categories = listCategories(state, activeEdition?.id);
  const disciplines = listDisciplines(state, activeEdition?.id).filter((item) => item.enabled);
  const editionMatches = listMatches(state, activeEdition?.id);
  const teamList = listTeams(state);
  // Os contadores saem do catálogo unificado: equipe arquivada e atleta
  // removido deixam de contar, como já acontece nas telas de origem.
  const athleteCount = teamList.reduce((total, team) => total + team.athletes, 0);
  const liveMatches = editionMatches.filter((item) => isLive(item.status)).length;
  const drafts = categories.filter((item) => item.status === tournamentStatus.draft).length;
  const nextMatch = editionMatches.find((item) => item.status === matchStatus.scheduled) ?? editionMatches[0];
  // O painel não oferece porta fechada: a consulta global de atletas é da
  // edição inteira, e o gestor de modalidade não entra nela.
  const stats = [
    { label: 'Equipes', value: String(teamList.length), meta: 'Atléticas ativas', icon: Shield, tone: 'blue', href: '/teams' },
    ...(canManageEdition(session) ? [{ label: 'Atletas', value: String(athleteCount), meta: 'Elencos das equipes', icon: Users, tone: 'pink', href: '/athletes' }] : []),
    { label: 'Categorias', value: String(categories.length), meta: `${disciplines.length} modalidades · ${drafts} em rascunho`, icon: Trophy, tone: 'orange', href: '/disciplines' },
    { label: 'Jogos ao vivo', value: String(liveMatches), meta: liveMatches ? 'Agora' : 'Nenhum agora', icon: Radio, tone: 'blue', href: `/matches?modalidade=${encodeURIComponent(state.preferences.selectedDiscipline)}` },
  ];
  return <AppShell active="home" eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="O INTERENG CHEGOU!" subtitle="Visão geral da edição ativa"><section className="stats-grid" aria-label="Resumo da edição">{stats.map(({ label, value, meta, icon: Icon, tone, href }) => <Link className={`stat-card stat-${tone}`} key={label} href={href}><div className="stat-icon"><Icon size={24} /></div><strong>{value}</strong><span>{label}</span><small>{meta}</small></Link>)}</section>{nextMatch ? <section className="section-block"><SectionTitle eyebrow="AGENDA" title="PRÓXIMO CONFRONTO" href={`/matches?modalidade=${encodeURIComponent(nextMatch.discipline)}`} linkLabel="Agenda" /><MatchCard href={`/matches/${nextMatch.id}`} match={nextMatch} /></section> : null}</AppShell>;
}
