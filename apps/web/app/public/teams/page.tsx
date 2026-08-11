'use client';

import { PublicAppShell } from '../../components/PublicAppShell';
import { PublicTeamList } from '../../components/PublicTeamList';
import { useFrontendState } from '../../lib/repositories/browser-repository';
import { listTeams } from '../../lib/edition-catalog';

export default function PublicTeamsPage() {
  const { state } = useFrontendState();
  const teams = listTeams(state);
  return (
    <PublicAppShell active="teams" eyebrow="ATLÉTICAS" title="EQUIPES" subtitle={`${teams.length} equipes na edição`}>
      <PublicTeamList teams={teams} />
    </PublicAppShell>
  );
}
