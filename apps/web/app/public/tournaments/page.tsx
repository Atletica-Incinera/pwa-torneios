import type { Metadata } from 'next';
import { PublicTournamentsPage } from '../../components/PublicTournamentsPage';

export const metadata: Metadata = {
  title: 'Modalidades e resultados',
  description: 'Acompanhe modalidades, fases, tabelas e resultados do InterEng Pernambuco.',
  alternates: { canonical: '/intereng/public/tournaments' },
  openGraph: {
    title: 'Modalidades e resultados do InterEng Pernambuco',
    description: 'Acompanhe modalidades, fases, tabelas e resultados do InterEng Pernambuco.',
    url: '/intereng/public/tournaments',
  },
};

export default PublicTournamentsPage;
