import { TournamentManageView } from '../../../components/TournamentManageView';
import { teams, tournaments } from '../../../lib/repositories/catalog-repository';
export default async function TournamentManagePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <TournamentManageView id={id} initial={tournaments.find((item) => item.id === id)} teamNames={teams.map((team) => team.name)} />; }
