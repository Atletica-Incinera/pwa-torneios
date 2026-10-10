import type { Metadata } from 'next';
import { PublicLiveView } from '../components/PublicLiveView';

export const metadata: Metadata = {
  title: 'Jogos ao vivo',
  description: 'Acompanhe jogos ao vivo, placares e destaques da Copa Halterada.',
  alternates: { canonical: '/intereng/public' },
  openGraph: {
    title: 'Copa Halterada — Jogos ao vivo',
    description: 'Acompanhe jogos ao vivo, placares e destaques da Copa Halterada.',
    url: '/intereng/public',
  },
};

export default function PublicLivePage() {
  return <PublicLiveView />;
}
