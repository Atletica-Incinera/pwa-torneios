import { Suspense } from 'react';
import { PublicTournamentDetailView } from '../../../components/PublicTournamentDetailView';
import { LoadingScreen } from '../../../components/LoadingScreen';

export default async function PublicCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<LoadingScreen message="Carregando categoria..." />}><PublicTournamentDetailView id={id} /></Suspense>;
}
