import type { Metadata } from 'next';
import { PublicTeamsPage } from '../../components/PublicTeamsPage';

export const metadata: Metadata = {
  title: 'Equipes',
  description: 'Conheça as equipes participantes e seus elencos na Copa Halterada.',
  alternates: { canonical: '/intereng/public/teams' },
  openGraph: {
    title: 'Equipes da Copa Halterada',
    description: 'Conheça as equipes participantes e seus elencos na Copa Halterada.',
    url: '/intereng/public/teams',
  },
};

export default PublicTeamsPage;
