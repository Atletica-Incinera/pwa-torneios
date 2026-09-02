import type { MetadataRoute } from 'next';
import { appPath } from './lib/base-path';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: appPath('/public'),
    name: 'InterEng Pernambuco 2026',
    short_name: 'InterEng',
    description: 'Gestão e acompanhamento das edições do InterEng',
    start_url: appPath('/public'),
    scope: appPath('/'),
    display: 'standalone',
    background_color: '#022734',
    theme_color: '#022734',
    orientation: 'portrait',
    lang: 'pt-BR',
    categories: ['sports', 'entertainment'],
    icons: [
      { src: appPath('/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: appPath('/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: appPath('/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Jogos ao vivo', short_name: 'Ao vivo', url: appPath('/public'), icons: [{ src: appPath('/icon-192.png'), sizes: '192x192', type: 'image/png' }] },
      { name: 'Agenda', short_name: 'Agenda', url: appPath('/public/tournaments'), icons: [{ src: appPath('/icon-192.png'), sizes: '192x192', type: 'image/png' }] },
      { name: 'Equipes', short_name: 'Equipes', url: appPath('/public/teams'), icons: [{ src: appPath('/icon-192.png'), sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
