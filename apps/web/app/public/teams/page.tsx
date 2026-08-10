import { PublicAppShell } from '../../components/PublicAppShell';
import { PublicTeamList } from '../../components/PublicTeamList';
import { teams } from '../../lib/repositories/catalog-repository';

export default function PublicTeamsPage() {
  return (
    <PublicAppShell active="teams" eyebrow="ATLÉTICAS" title="EQUIPES" subtitle={`${teams.length} equipes na edição`}>
      <PublicTeamList teams={teams} />
    </PublicAppShell>
  );
}
