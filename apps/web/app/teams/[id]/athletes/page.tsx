import { redirect } from 'next/navigation';

/** O elenco vive na tela da equipe; esta rota só existe para a migalha funcionar. */
export default async function TeamAthletesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/teams/${id}`);
}
