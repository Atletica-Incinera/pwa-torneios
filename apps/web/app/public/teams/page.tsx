import type { Metadata } from 'next';
import { PublicTeamsPage } from '../../components/PublicTeamsPage';

export const metadata: Metadata = {
  title: 'Equipes',
  description: 'Conheça as equipes participantes e seus elencos no InterEng Pernambuco.',
  alternates: { canonical: '/intereng/public/teams' },
  openGraph: {
    title: 'Equipes do InterEng Pernambuco',
    description: 'Conheça as equipes participantes e seus elencos no InterEng Pernambuco.',
    url: '/intereng/public/teams',
  },
};

export default PublicTeamsPage;
