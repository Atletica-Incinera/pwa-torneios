import type { MetadataRoute } from 'next';
import { loadPublicSnapshot } from './lib/public-snapshot';
import { isPublicMatch, isPublicTournamentStatus } from './lib/publication';

const BASE_URL = 'https://incinera.cin.ufpe.br/intereng';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const state = await loadPublicSnapshot();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/public`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/public/tournaments`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/public/teams`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/public/standings/general`, changeFrequency: 'daily', priority: 0.8 },
  ];
  const tournaments: MetadataRoute.Sitemap = Object.entries(state.tournaments)
    .filter(([, tournament]) => isPublicTournamentStatus(tournament.status))
    .map(([id]) => ({
      url: `${BASE_URL}/public/tournaments/${encodeURIComponent(id)}`,
      changeFrequency: 'daily',
      priority: 0.7,
    }));
  const teams: MetadataRoute.Sitemap = Object.entries(state.teams)
    .filter(([, team]) => !team.archived)
    .map(([id]) => ({
      url: `${BASE_URL}/public/teams/${encodeURIComponent(id)}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));
  const matches: MetadataRoute.Sitemap = Object.entries(state.matches)
    .filter(([, match]) => isPublicMatch(state, match))
    .map(([id]) => ({
      url: `${BASE_URL}/public/matches/${encodeURIComponent(id)}`,
      changeFrequency: 'hourly',
      priority: 0.6,
    }));

  return [...staticPages, ...tournaments, ...teams, ...matches];
}
