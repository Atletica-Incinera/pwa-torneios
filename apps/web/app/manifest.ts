import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'InterEng Pernambuco 2026', short_name: 'InterEng', description: 'Gestão e acompanhamento dos Jogos de Engenharia de Pernambuco', start_url: '/public', display: 'standalone', background_color: '#002f3a', theme_color: '#002f3a', orientation: 'portrait', lang: 'pt-BR', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] };
}
