import { permanentRedirect } from 'next/navigation';

/**
 * Rota raiz — redireciona automaticamente para a área pública.
 * O login administrativo está em /login.
 */
export default function RootPage() {
  permanentRedirect('/public');
}
