import { Suspense } from 'react';
import { PublicCompetitionView } from '../../components/PublicCompetitionView';

export default function PublicStandingsPage() {
  return <Suspense fallback={<main className="global-state-screen"><span className="loading-mark">26</span><div className="loading-line" /><p>Carregando classificação...</p></main>}><PublicCompetitionView view="standings" /></Suspense>;
}
