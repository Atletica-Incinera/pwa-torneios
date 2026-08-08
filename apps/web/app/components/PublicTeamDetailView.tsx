'use client';

import Link from 'next/link';
import { PublicAppShell } from './PublicAppShell';
import { EmptyState, SectionTitle } from './AppShell';
import { TeamManager } from './TeamManager';
import { TeamRosterManager } from './TeamRosterManager';
import { useFrontendState } from '../lib/frontend-state';

type TeamBase = { id: string; name: string; athletes: number; tone: string; initial: string; logo: string };
type AthleteBase = { id: string; name: string; modalities: readonly string[] };
export function PublicTeamDetailView({ id, initial, existingAthletes, disciplines }: { id: string; initial?: TeamBase; existingAthletes: AthleteBase[]; disciplines: string[] }) {
  const { state } = useFrontendState(); const stored = state.teams[id];
  const team = initial ? { ...initial, name: stored?.name ?? initial.name, athletes: stored?.athletes ?? initial.athletes, initial: stored?.initials?.[0] ?? initial.initial, logo: stored?.logo ?? initial.logo, tone: stored?.tone ?? initial.tone } : stored?.created ? { id, name: stored.name ?? 'Equipe', athletes: stored.athletes ?? 0, initial: stored.initials?.[0] ?? 'E', logo: stored.logo ?? '', tone: stored.tone ?? 'blue' } : null;
  if (!team || stored?.archived) return <PublicAppShell active="teams" eyebrow="EQUIPES" title="INDISPONÍVEL" subtitle="Equipe não publicada"><EmptyState title="SEM DADOS" copy="Esta equipe não está disponível na edição." /></PublicAppShell>;
  return <PublicAppShell active="teams" eyebrow="EQUIPE PARTICIPANTE" title={team.name} subtitle="Modalidades e elencos da InterEng 2026"><Link href="/public/teams" className="public-back-link">‹ EQUIPES</Link><TeamManager team={team} readOnly /><section className="section-block team-modalities-section"><SectionTitle eyebrow="MODALIDADES" title="ELENCOS" /><TeamRosterManager teamId={id} existingAthletes={existingAthletes} disciplines={disciplines} readOnly /></section></PublicAppShell>;
}
