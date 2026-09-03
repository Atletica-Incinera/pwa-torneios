import type { MetadataRoute } from 'next';
import { basePath } from './lib/base-path.ts';

const SITE_URL = 'https://incinera.cin.ufpe.br';

export function construirRobots(prefixo: string): MetadataRoute.Robots {
  const com = (caminho: string) => `${prefixo}${caminho}`;
  return {
    rules: {
      userAgent: '*',
      allow: [com('/'), com('/public/')],
      disallow: [
        com('/athletes/'),
        com('/audit/'),
        com('/competitions/'),
        com('/dashboard/'),
        com('/disciplines/'),
        com('/login/'),
        com('/matches/'),
        com('/more/'),
        com('/profile/'),
        com('/staff/'),
        com('/standings/'),
        com('/teams/'),
        com('/tournaments/'),
      ],
    },
    sitemap: `${SITE_URL}${com('/sitemap.xml')}`,
    host: SITE_URL,
  };
}

export default function robots(): MetadataRoute.Robots {
  return construirRobots(basePath);
}
