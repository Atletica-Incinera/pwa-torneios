import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MatchRouteView } from '../../../components/MatchRouteView';
import { StructuredData } from '../../../components/StructuredData';
import { isPublicMatch } from '../../../lib/publication';
import { loadPublicSnapshot } from '../../../lib/public-snapshot';

const BASE_URL = 'https://incinera.cin.ufpe.br/intereng/public/matches';

type PageProps = { params: Promise<{ id: string }> };

function matchName(match: { entryA?: string; entryB?: string }) {
  return `${match.entryA ?? 'Equipe A'} x ${match.entryB ?? 'Equipe B'}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const state = await loadPublicSnapshot();
  const match = state.matches[id];
  if (!match || !isPublicMatch(state, match)) return {};
  const name = matchName(match);
  const score = match.scoreA != null && match.scoreB != null ? ` Placar: ${match.scoreA} a ${match.scoreB}.` : '';
  const description = `${name} pelo ${match.discipline ?? 'InterEng Pernambuco'}.${score}`;
  const canonical = `/intereng/public/matches/${encodeURIComponent(id)}`;
  return {
    title: name,
    description,
    alternates: { canonical },
    openGraph: { title: `${name} | InterEng Pernambuco`, description, url: canonical },
  };
}

export default async function PublicMatchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const state = await loadPublicSnapshot();
  const match = state.matches[id];
  if (!match || !isPublicMatch(state, match)) notFound();
  const startDate = match.date ? `${match.date}${match.time ? `T${match.time}:00-03:00` : ''}` : undefined;
  return <>
    <StructuredData value={{
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: matchName(match),
      startDate,
      eventStatus: match.status === 'Encerrada'
        ? 'https://schema.org/EventCompleted'
        : match.status === 'Cancelada'
          ? 'https://schema.org/EventCancelled'
          : 'https://schema.org/EventScheduled',
      location: match.venue ? { '@type': 'Place', name: match.venue } : undefined,
      homeTeam: { '@type': 'SportsTeam', name: match.entryA },
      awayTeam: { '@type': 'SportsTeam', name: match.entryB },
      url: `${BASE_URL}/${encodeURIComponent(id)}`,
      organizer: { '@type': 'SportsOrganization', name: 'InterEng Pernambuco' },
    }} />
    <MatchRouteView id={id} mode="public" />
  </>;
}
