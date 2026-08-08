import { AthleteDetailView } from '../../components/AthleteDetailView';
import { athletes, teams } from '../../lib/mock-data';
export default async function AthleteDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const athlete = athletes.find((item) => item.id === id); const team = athlete ? teams.find((item) => item.id === athlete.teamId) : undefined; return <AthleteDetailView id={id} initial={athlete} initialTeamName={team?.name} />; }
