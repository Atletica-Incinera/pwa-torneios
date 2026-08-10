import { MatchRouteView } from '../../../components/MatchRouteView';
import { matches } from '../../../lib/repositories/catalog-repository';
export default async function MatchManagePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MatchRouteView id={id} initial={matches.find((item) => item.id === id)} mode="manage" />; }
