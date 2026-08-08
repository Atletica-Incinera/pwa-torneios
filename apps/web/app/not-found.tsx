import Link from 'next/link';
export default function NotFound() { return <main className="app-screen global-state-screen"><div className="loading-mark error-mark">404</div><h1>TELA NÃO ENCONTRADA</h1><p>Este endereço não faz parte da edição ativa.</p><Link href="/public" className="primary-button">Voltar ao app</Link></main>; }
