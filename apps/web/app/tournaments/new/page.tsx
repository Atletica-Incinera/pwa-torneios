import { Suspense } from 'react';
import { CategoryCreationForm } from '../../components/CategoryCreationForm';
import { LoadingScreen } from '../../components/LoadingScreen';

export default function NewCategoryPage() {
  return <Suspense fallback={<LoadingScreen message="Carregando modalidades..." />}><CategoryCreationForm /></Suspense>;
}
