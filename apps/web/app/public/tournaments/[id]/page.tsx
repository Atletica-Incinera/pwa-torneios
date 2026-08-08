import { PublicTournamentDetailView } from '../../../components/PublicTournamentDetailView';
import { matches, tournaments } from '../../../lib/mock-data';
export default async function PublicTournamentDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const tournament = tournaments.find((item) => item.id === id); return <PublicTournamentDetailView id={id} initial={tournament} matches={matches} index={tournament ? tournaments.indexOf(tournament) : tournaments.length} />; }
