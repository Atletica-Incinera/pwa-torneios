'use client';

import { PublicAppShell } from './PublicAppShell';
import { EmptyState, SectionTitle } from './AppShell';
import { TeamManager } from './TeamManager';
import { TeamRosterManager } from './TeamRosterManager';
import { TeamPerformance } from './TeamPerformance';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { findTeam, listDisciplines } from '../lib/edition-catalog';

export function PublicTeamDetailView({ id }: { id: string }) {
  const { state } = useFrontendState();
  const team = findTeam(state, id);
  const disciplines = listDisciplines(state, getActiveEdition(state)?.id).filter((item) => item.enabled).map((item) => item.name);
  if (!team || team.archived) return <PublicAppShell active="teams" eyebrow="EQUIPES" title="INDISPONÍVEL" subtitle="Equipe não publicada"><EmptyState title="SEM DADOS" copy="Esta equipe não está disponível na edição." /></PublicAppShell>;
  return <PublicAppShell active="teams" eyebrow="EQUIPE PARTICIPANTE" title={team.name} subtitle="Modalidades, classificação e elencos da InterEng 2026"><TeamManager team={team} readOnly /><TeamPerformance teamId={id} teamName={team.name} publicView /><section className="section-block team-modalities-section"><SectionTitle eyebrow="MODALIDADES" title="ELENCOS" /><TeamRosterManager teamId={id} disciplines={disciplines} readOnly /></section></PublicAppShell>;
}
