import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PublicTournamentDetailView } from '../../../components/PublicTournamentDetailView';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { StructuredData } from '../../../components/StructuredData';
import { getActiveEdition } from '../../../lib/frontend-state';
import { isPublicTournamentStatus } from '../../../lib/publication';
import { loadPublicSnapshot } from '../../../lib/public-snapshot';

const BASE_URL = 'https://incinera.cin.ufpe.br/intereng/public/tournaments';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const state = await loadPublicSnapshot();
  const tournament = state.tournaments[id];
  if (!tournament || !isPublicTournamentStatus(tournament.status)) return {};
  const name = tournament.name ?? tournament.discipline ?? 'Modalidade';
  const description = `Tabela, fases, jogos e resultados de ${name} no InterEng Pernambuco.`;
  const canonical = `/intereng/public/tournaments/${encodeURIComponent(id)}`;
  return {
    title: name,
    description,
    alternates: { canonical },
    openGraph: { title: `${name} | InterEng Pernambuco`, description, url: canonical },
  };
}

export default async function PublicCategoryPage({ params }: PageProps) {
  const { id } = await params;
  const state = await loadPublicSnapshot();
  const tournament = state.tournaments[id];
  if (!tournament || !isPublicTournamentStatus(tournament.status)) notFound();
  const edition = getActiveEdition(state);
  const name = tournament.name ?? tournament.discipline ?? 'Modalidade';
  return <>
    <StructuredData value={{
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${name} — InterEng Pernambuco`,
      startDate: edition?.start,
      endDate: edition?.end,
      eventStatus: tournament.status === 'Encerrado'
        ? 'https://schema.org/EventCompleted'
        : 'https://schema.org/EventScheduled',
      url: `${BASE_URL}/${encodeURIComponent(id)}`,
      organizer: { '@type': 'SportsOrganization', name: 'InterEng Pernambuco' },
    }} />
    <Suspense fallback={<LoadingScreen message="Carregando categoria..." />}><PublicTournamentDetailView id={id} /></Suspense>
  </>;
}
