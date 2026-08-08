import { DisciplineSelector } from '../../components/DisciplineSelector';
import { PublicMatchCollection } from '../../components/PublicMatchCollection';
import { PublicAppShell } from '../../components/PublicAppShell';
import { matches } from '../../lib/mock-data';

type PublicMatchesPageProps = {
  searchParams?: Promise<{ modalidade?: string }>;
};

export default async function PublicMatchesPage({ searchParams }: PublicMatchesPageProps) {
  const params = await searchParams;
  const disciplines = [...new Set(matches.map((match) => match.discipline))];
  const requestedDiscipline = params?.modalidade ?? '';
  const selectedDiscipline = disciplines.includes(requestedDiscipline as (typeof disciplines)[number]) ? requestedDiscipline : disciplines[0];

  return (
    <PublicAppShell active="matches" eyebrow={`AGENDA · ${selectedDiscipline.toUpperCase()}`} title="PRÓXIMOS" subtitle={`Partidas confirmadas de ${selectedDiscipline}`}>
      <DisciplineSelector options={disciplines} />
      <PublicMatchCollection matches={matches} discipline={selectedDiscipline} mode="upcoming" />
    </PublicAppShell>
  );
}
