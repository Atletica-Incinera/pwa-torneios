import type { Metadata } from 'next';
import { PublicTournamentsPage } from '../../components/PublicTournamentsPage';

export const metadata: Metadata = {
  title: 'Modalidades e resultados',
  description: 'Acompanhe modalidades, fases, tabelas e resultados da Copa Halterada.',
  alternates: { canonical: '/intereng/public/tournaments' },
  openGraph: {
    title: 'Modalidades e resultados da Copa Halterada',
    description: 'Acompanhe modalidades, fases, tabelas e resultados da Copa Halterada.',
    url: '/intereng/public/tournaments',
  },
};

export default PublicTournamentsPage;
