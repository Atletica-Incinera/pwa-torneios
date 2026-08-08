import { Suspense } from 'react';
import { MatchesHub } from '../components/MatchesHub';

export default function MatchesPage() {
  return <Suspense fallback={<main className="global-state-screen"><span className="loading-mark">26</span><div className="loading-line" /><p>Carregando agenda...</p></main>}><MatchesHub area="admin" /></Suspense>;
}
