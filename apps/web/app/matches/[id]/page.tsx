import { MatchRouteView } from '../../components/MatchRouteView';
import { matches } from '../../lib/mock-data';
export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MatchRouteView id={id} initial={matches.find((item) => item.id === id)} mode="admin" />; }
