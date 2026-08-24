import { redirect } from 'next/navigation';

/**
 * Rota raiz — redireciona automaticamente para a area publica.
 * O login administrativo esta em /login.
 */
export default function RootPage() {
  redirect('/public');
}
