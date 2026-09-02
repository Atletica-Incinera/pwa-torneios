import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Artilharia',
  description: 'Veja os maiores pontuadores de cada modalidade no InterEng Pernambuco.',
  alternates: { canonical: '/intereng/public/scorers' },
  openGraph: {
    title: 'Artilharia do InterEng Pernambuco',
    description: 'Veja os maiores pontuadores de cada modalidade no InterEng Pernambuco.',
    url: '/intereng/public/scorers',
  },
};

export default function PublicScorersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
