import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicTeamDetailView } from '../../../components/PublicTeamDetailView';
import { StructuredData } from '../../../components/StructuredData';
import { loadPublicSnapshot } from '../../../lib/public-snapshot';

const BASE_URL = 'https://incinera.cin.ufpe.br/intereng/public/teams';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const state = await loadPublicSnapshot();
  const team = state.teams[id];
  if (!team || team.archived) return {};
  const name = team.name ?? team.initials ?? 'Equipe';
  const description = `Modalidades, classificação e elenco de ${name} no InterEng Pernambuco.`;
  const canonical = `/intereng/public/teams/${encodeURIComponent(id)}`;
  return {
    title: name,
    description,
    alternates: { canonical },
    openGraph: { title: `${name} | InterEng Pernambuco`, description, url: canonical },
  };
}

export default async function PublicTeamDetailPage({ params }: PageProps) {
  const { id } = await params;
  const state = await loadPublicSnapshot();
  const team = state.teams[id];
  if (!team || team.archived) notFound();
  const name = team.name ?? team.initials ?? 'Equipe';
  return <>
    <StructuredData value={{
      '@context': 'https://schema.org',
      '@type': 'SportsTeam',
      name,
      url: `${BASE_URL}/${encodeURIComponent(id)}`,
      logo: team.logo,
      memberOf: { '@type': 'SportsOrganization', name: 'InterEng Pernambuco' },
    }} />
    <PublicTeamDetailView id={id} />
  </>;
}
