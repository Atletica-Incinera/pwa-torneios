import { AppShell } from '../../components/AppShell';
import { MatchCreationForm } from '../../components/MatchCreationForm';
import { standings, tournaments } from '../../lib/repositories/catalog-repository';

type NewMatchPageProps = { searchParams?: Promise<{ modalidade?: string }> };

export default async function NewMatchPage({ searchParams }: NewMatchPageProps) {
  const params = await searchParams;
  const activeTournaments = tournaments.filter((item) => item.status !== 'Rascunho');
  const disciplines = [...new Set(activeTournaments.map((item) => item.discipline))];
  const requested = params?.modalidade ?? '';
  const cancelDiscipline = disciplines.includes(requested as (typeof disciplines)[number]) ? requested : disciplines[0];
  return <AppShell active="matches" eyebrow="AGENDA DA EDIÇÃO" title="NOVO JOGO" subtitle="Selecione a modalidade e defina o confronto"><MatchCreationForm disciplines={disciplines} participants={standings.map((entry) => entry.name)} tournaments={activeTournaments.map((item) => ({ id: item.id, discipline: item.discipline, name: item.name, phase: item.phase }))} cancelDiscipline={cancelDiscipline} /></AppShell>;
}
