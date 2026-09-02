import type { Metadata } from 'next';
import { PublicLiveView } from '../components/PublicLiveView';

export const metadata: Metadata = {
  title: 'Jogos ao vivo',
  description: 'Acompanhe jogos ao vivo, placares e destaques do InterEng Pernambuco.',
  alternates: { canonical: '/intereng/public' },
  openGraph: {
    title: 'InterEng Pernambuco — Jogos ao vivo',
    description: 'Acompanhe jogos ao vivo, placares e destaques do InterEng Pernambuco.',
    url: '/intereng/public',
  },
};

export default function PublicLivePage() {
  return <PublicLiveView />;
}
