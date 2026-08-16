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
      // Os atalhos apontam para rotas finais. `/public/matches` ainda existe e
      // ainda redireciona, para endereço antigo compartilhado por aí continuar
      // funcionando — mas um atalho da tela inicial não deve gastar uma
      // navegação inteira para chegar onde já poderia abrir.
      { name: 'Modalidades', short_name: 'Modalidades', url: '/public/tournaments', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Equipes', short_name: 'Equipes', url: '/public/teams', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
