import { redirect } from 'next/navigation';

/** As categorias agora são acessadas por dentro da modalidade. */
export default function LegacyTournamentsPage() {
  redirect('/disciplines');
}
