import { DisciplineSelector } from '../components/DisciplineSelector';
import { PublicMatchCollection } from '../components/PublicMatchCollection';
import { PublicAppShell } from '../components/PublicAppShell';
import { matches } from '../lib/mock-data';

type PublicLivePageProps = {
  searchParams?: Promise<{ modalidade?: string }>;
};

export default async function PublicLivePage({ searchParams }: PublicLivePageProps) {
  const params = await searchParams;
  const disciplines = [...new Set(matches.map((match) => match.discipline))];
  const requestedDiscipline = params?.modalidade ?? '';
  const selectedDiscipline = disciplines.includes(requestedDiscipline as (typeof disciplines)[number]) ? requestedDiscipline : disciplines[0];

  return (
    <PublicAppShell active="live" eyebrow={`AO VIVO · ${selectedDiscipline.toUpperCase()}`} title="AO VIVO" subtitle={`Placares oficiais somente de ${selectedDiscipline}`}>
      <DisciplineSelector options={disciplines} />
      <PublicMatchCollection matches={matches} discipline={selectedDiscipline} mode="live" />
    </PublicAppShell>
  );
}
