import { Suspense } from 'react';
import { MatchesHub } from '../components/MatchesHub';
import { LoadingScreen } from '../components/LoadingScreen';

export default function MatchesPage() {
  return <Suspense fallback={<LoadingScreen message="Carregando agenda..." />}><MatchesHub /></Suspense>;
}
