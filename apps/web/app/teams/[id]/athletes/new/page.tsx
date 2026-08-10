import { AppShell } from '../../../../components/AppShell';
import { TeamAthleteForm } from '../../../../components/TeamAthleteForm';
import { disciplines, teams } from '../../../../lib/repositories/catalog-repository';

export default async function NewTeamAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = teams.find((item) => item.id === id);
  return <AppShell active="teams" eyebrow={(team?.name ?? 'EQUIPE').toUpperCase()} title="NOVO ATLETA" subtitle="Cadastro vinculado à equipe selecionada"><TeamAthleteForm teamId={id} teamName={team?.name ?? 'Equipe cadastrada'} initialAthletes={team?.athletes ?? 0} disciplines={disciplines.map((discipline) => discipline.name)} /></AppShell>;
}
