import { notFound } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { TournamentDetailTabs } from '../../components/TournamentDetailTabs';
import { standings, tournaments } from '../../lib/repositories/catalog-repository';

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = tournaments.find((item) => item.id === id);
  if (!tournament) notFound();

  return <AppShell active="tournaments" eyebrow={`${tournament.discipline.toUpperCase()} · INTERENG 2026`} title={tournament.name.toUpperCase()} subtitle={`${tournament.phase} · disputa da modalidade`}>
    <TournamentDetailTabs tournament={tournament} entries={standings} />
  </AppShell>;
}
