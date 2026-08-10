'use client';

import { AppShell, EmptyState, SectionTitle } from './AppShell';
import { TeamManager } from './TeamManager';
import { TeamRosterManager } from './TeamRosterManager';
import { TeamPerformance } from './TeamPerformance';
import { useFrontendState } from '../lib/repositories/browser-repository';

type TeamBase = { id: string; name: string; athletes: number; tone: string; initial: string; logo: string };
type AthleteBase = { id: string; name: string; modalities: readonly string[] };

export function TeamDetailView({ id, initialTeam, existingAthletes, disciplines }: { id: string; initialTeam?: TeamBase; existingAthletes: AthleteBase[]; disciplines: string[] }) {
  const { state } = useFrontendState();
  const stored = state.teams[id];
  const team = initialTeam ? { ...initialTeam, name: stored?.name ?? initialTeam.name, athletes: stored?.athletes ?? initialTeam.athletes, initial: stored?.initials?.[0] ?? initialTeam.initial, logo: stored?.logo ?? initialTeam.logo, tone: stored?.tone ?? initialTeam.tone } : stored?.created ? { id, name: stored.name ?? 'Equipe', athletes: stored.athletes ?? 0, initial: stored.initials?.[0] ?? 'E', logo: stored.logo ?? '', tone: stored.tone ?? 'blue' } : null;
  if (!team) return <AppShell active="teams" eyebrow="EQUIPE" title="CARREGANDO" subtitle="Buscando dados locais"><EmptyState title="EQUIPE NÃO ENCONTRADA" copy="Volte à lista e selecione uma equipe cadastrada." /></AppShell>;
  return <AppShell active="teams" eyebrow="EQUIPE PARTICIPANTE" title={team.name.toUpperCase()} subtitle="Modalidades, classificação e elencos da InterEng 2026" actionHref={`/teams/${id}/athletes/new`} actionLabel={`Cadastrar atleta em ${team.name}`}><TeamManager team={team} /><TeamPerformance teamId={id} teamName={team.name} /><section className="section-block team-modalities-section"><SectionTitle eyebrow="MODALIDADES" title="ELENCOS" /><TeamRosterManager teamId={id} existingAthletes={existingAthletes} disciplines={disciplines} /></section></AppShell>;
}
