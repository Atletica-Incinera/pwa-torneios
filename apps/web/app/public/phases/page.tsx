import { Suspense } from 'react';
import { PublicCompetitionView } from '../../components/PublicCompetitionView';

export default function PublicPhasesPage() {
  return <Suspense fallback={<main className="global-state-screen"><span className="loading-mark">26</span><div className="loading-line" /><p>Carregando fases...</p></main>}><PublicCompetitionView view="phases" /></Suspense>;
}
