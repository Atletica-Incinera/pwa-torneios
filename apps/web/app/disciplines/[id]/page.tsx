import { DisciplineDetailView } from '../../components/DisciplineDetailView';

export default async function DisciplineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DisciplineDetailView id={id} />;
}
