import { PublicTeamDetailView } from '../../../components/PublicTeamDetailView';
import { athletes, disciplines, teams } from '../../../lib/mock-data';
export default async function PublicTeamDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const team = teams.find((item) => item.id === id); const teamAthletes = athletes.filter((item) => item.teamId === id).map((item) => ({ ...item })); return <PublicTeamDetailView id={id} initial={team} existingAthletes={teamAthletes} disciplines={disciplines.map((item) => item.name)} />; }
