import { AppShell } from '../components/AppShell';
import { DisciplineSelector } from '../components/DisciplineSelector';
import { MatchSchedule } from '../components/MatchSchedule';
import { matches } from '../lib/mock-data';

type MatchesPageProps = {
  searchParams?: Promise<{ modalidade?: string }>;
};

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const params = await searchParams;
  const disciplines = [...new Set(matches.map((match) => match.discipline))];
  const requestedDiscipline = params?.modalidade ?? '';
  const selectedDiscipline = disciplines.includes(requestedDiscipline as (typeof disciplines)[number]) ? requestedDiscipline : disciplines[0];
  const filteredMatches = matches.filter((match) => match.discipline === selectedDiscipline);

  return (
    <AppShell active="matches" eyebrow={`AGENDA · ${selectedDiscipline.toUpperCase()}`} title="JOGOS" subtitle={`Jogos e resultados somente de ${selectedDiscipline}`} actionHref={`/matches/new?modalidade=${encodeURIComponent(selectedDiscipline)}`} actionLabel={`Agendar jogo de ${selectedDiscipline}`}>
      <DisciplineSelector options={disciplines} />
      <MatchSchedule matches={filteredMatches} discipline={selectedDiscipline} />
    </AppShell>
  );
}
