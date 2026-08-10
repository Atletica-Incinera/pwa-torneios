import { DisciplineDetailView } from '../../components/DisciplineDetailView';
import { disciplines } from '../../lib/repositories/catalog-repository';

export default async function DisciplineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const discipline = disciplines.find((item) => item.name.toLocaleLowerCase('pt-BR') === decodeURIComponent(id).toLocaleLowerCase('pt-BR'));
  return <DisciplineDetailView id={id} initial={discipline} index={discipline ? disciplines.indexOf(discipline) : disciplines.length} />;
}
