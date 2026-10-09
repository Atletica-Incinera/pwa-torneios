import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Artilharia',
  description: 'Veja os maiores pontuadores de cada modalidade na Copa Halterada.',
  alternates: { canonical: '/intereng/public/scorers' },
  openGraph: {
    title: 'Artilharia da Copa Halterada',
    description: 'Veja os maiores pontuadores de cada modalidade na Copa Halterada.',
    url: '/intereng/public/scorers',
  },
};

export default function PublicScorersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
