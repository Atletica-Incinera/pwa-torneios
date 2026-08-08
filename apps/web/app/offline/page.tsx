import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return <main id="app-main" className="global-state-screen offline-screen"><span className="loading-mark error-mark"><WifiOff size={34} /></span><h1>SEM CONEXÃO</h1><p>Não foi possível abrir uma página nova. Volte ao conteúdo que já foi carregado ou tente novamente quando a conexão retornar.</p><Link href="/public" className="primary-button">Voltar ao app</Link></main>;
}
