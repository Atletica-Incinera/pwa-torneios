import { TeamDetailView } from '../../components/TeamDetailView';
import { athletes, disciplines, teams } from '../../lib/repositories/catalog-repository';

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = teams.find((item) => item.id === id);
  const teamAthletes = athletes.filter((athlete) => athlete.teamId === id).map((athlete) => ({ ...athlete }));
  return <TeamDetailView id={id} initialTeam={team} existingAthletes={teamAthletes} disciplines={disciplines.map((discipline) => discipline.name)} />;
}
