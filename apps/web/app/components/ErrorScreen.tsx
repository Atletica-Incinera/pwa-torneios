'use client';

import { CloudOff } from 'lucide-react';

/**
 * Falha ao carregar a edição.
 *
 * O app depende de conexão para mostrar tudo em tempo real: quando o snapshot
 * não chega, a tela diz isso e oferece nova tentativa em vez de ficar girando.
 */
export function ErrorScreen({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  return (
    <main className="app-screen global-state-screen" role="alert">
      <CloudOff size={44} />
      <h1>DADOS INDISPONÍVEIS</h1>
      <p>{message ?? 'Não foi possível carregar a edição.'}</p>
      <button type="button" className="primary-button" onClick={onRetry}>Tentar novamente</button>
    </main>
  );
}
