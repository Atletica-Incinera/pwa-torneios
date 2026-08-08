import { Suspense } from 'react';
import { MatchesHub } from '../components/MatchesHub';

export default function PublicLivePage() {
  return <Suspense fallback={<main className="global-state-screen"><span className="loading-mark">26</span><div className="loading-line" /><p>Carregando placares...</p></main>}><MatchesHub area="public" mode="live" /></Suspense>;
}
