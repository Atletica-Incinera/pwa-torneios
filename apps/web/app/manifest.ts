import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/public',
    name: 'InterEng Pernambuco 2026',
    short_name: 'InterEng',
    description: 'Gestão e acompanhamento das edições do InterEng',
    start_url: '/public',
    scope: '/',
    display: 'standalone',
    background_color: '#022734',
    theme_color: '#022734',
    orientation: 'portrait',
    lang: 'pt-BR',
    categories: ['sports', 'entertainment'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Jogos ao vivo', short_name: 'Ao vivo', url: '/public', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Agenda', short_name: 'Agenda', url: '/public/matches', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Equipes', short_name: 'Equipes', url: '/public/teams', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
