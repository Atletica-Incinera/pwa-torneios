import type { Metadata } from 'next';
import { PublicMatchesHub } from '../../components/PublicMatchesHub';

// Sem título próprio a aba do navegador dizia só "Copa Halterada" aqui.
export const metadata: Metadata = {
  title: 'Jogos e resultados',
  description: 'Agenda e resultados de todas as modalidades da Copa Halterada.',
};

export default function PublicMatchesPage() {
  return <PublicMatchesHub />;
}
