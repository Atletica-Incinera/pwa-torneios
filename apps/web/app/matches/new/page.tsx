import { AppShell } from '../../components/AppShell';
import { MatchCreationForm } from '../../components/MatchCreationForm';

type NewMatchPageProps = { searchParams?: Promise<{ modalidade?: string }> };

export default async function NewMatchPage({ searchParams }: NewMatchPageProps) {
  const params = await searchParams;
  return <AppShell active="matches" eyebrow="AGENDA DA EDIÇÃO" title="NOVO JOGO" subtitle="Selecione a modalidade e defina o confronto"><MatchCreationForm requestedDiscipline={params?.modalidade ?? ''} /></AppShell>;
}
