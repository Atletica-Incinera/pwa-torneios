import { PublicTeamDetailView } from '../../../components/PublicTeamDetailView';
export default async function PublicTeamDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PublicTeamDetailView id={id} />; }
