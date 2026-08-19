'use client';

import { AppShell, EmptyState, SectionTitle } from './AppShell';
import { TeamManager } from './TeamManager';
import { TeamRosterManager } from './TeamRosterManager';
import { TeamPerformance } from './TeamPerformance';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { findTeam, listDisciplines } from '../lib/edition-catalog';

export function TeamDetailView({ id }: { id: string }) {
  const { state } = useFrontendState();
  const team = findTeam(state, id);
  const disciplines = listDisciplines(state, getActiveEdition(state)?.id).filter((item) => item.enabled).map((item) => item.name);
  if (!team) return <AppShell active="teams" eyebrow="EQUIPE" title="CARREGANDO" subtitle="Buscando dados locais"><EmptyState title="EQUIPE NÃO ENCONTRADA" copy="Volte à lista e selecione uma equipe cadastrada." /></AppShell>;
  return <AppShell active="teams" eyebrow="EQUIPE PARTICIPANTE" title={team.name.toUpperCase()} subtitle="Modalidades, classificação e elencos da InterEng 2026" actionHref={`/teams/${id}/athletes/new`} actionLabel={`Cadastrar atleta em ${team.name}`} actionShortLabel="Cadastrar atleta"><TeamManager team={team} /><TeamPerformance teamId={id} teamName={team.name} /><section className="section-block team-modalities-section"><SectionTitle eyebrow="MODALIDADES" title="ELENCOS" /><TeamRosterManager teamId={id} disciplines={disciplines} /></section></AppShell>;
}
