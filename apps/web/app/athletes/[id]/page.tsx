import { AthleteDetailView } from '../../components/AthleteDetailView';
export default async function AthleteDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AthleteDetailView id={id} />; }
