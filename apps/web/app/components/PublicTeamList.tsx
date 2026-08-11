import { TeamCard } from './TeamCard';
import type { TeamView } from '../lib/edition-catalog';

export function PublicTeamList({ teams }: { teams: TeamView[] }) {
  return <section className="team-list" aria-label="Equipes participantes">{teams.map((team) => <TeamCard team={team} href={`/public/teams/${team.id}`} publicView key={team.id} />)}</section>;
}
