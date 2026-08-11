import { TeamAthleteForm } from '../../../../components/TeamAthleteForm';

export default async function NewTeamAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamAthleteForm teamId={id} />;
}
