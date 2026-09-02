import type { Metadata } from 'next';
import { OverallStandings } from '../../../components/OverallStandings';
import { PublicAppShell } from '../../../components/PublicAppShell';

export const metadata: Metadata = {
  title: 'Classificação geral',
  description: 'Veja a classificação geral e a pontuação oficial das equipes no InterEng Pernambuco.',
  alternates: { canonical: '/intereng/public/standings/general' },
  openGraph: {
    title: 'Classificação geral do InterEng Pernambuco',
    description: 'Veja a classificação geral e a pontuação oficial das equipes no InterEng Pernambuco.',
    url: '/intereng/public/standings/general',
  },
};

export default function PublicOverallStandingsPage() {
  return <PublicAppShell active="disciplines" eyebrow="TODAS AS MODALIDADES" title="CLASSIFICAÇÃO GERAL" subtitle="Ranking oficial das equipes na edição"><OverallStandings readOnly /></PublicAppShell>;
}
