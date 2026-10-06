import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/public',
    name: 'Copa Halterada',
    short_name: 'Halterada',
    description: 'Gestão e acompanhamento da Copa Halterada',
    start_url: '/public',
    scope: '/',
    display: 'standalone',
    background_color: '#0A105A',
    theme_color: '#0A105A',
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
