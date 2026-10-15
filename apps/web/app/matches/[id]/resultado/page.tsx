import { MatchRouteView } from '../../../components/MatchRouteView';
export default async function MatchResultPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MatchRouteView id={id} mode="result" />; }
