import { Suspense } from 'react';
import { CategoryDetailView } from '../../components/CategoryDetailView';
import { LoadingScreen } from '../../components/LoadingScreen';

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<LoadingScreen message="Carregando categoria..." />}><CategoryDetailView id={id} /></Suspense>;
}
