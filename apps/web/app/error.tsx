'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="app-screen global-state-screen"><div className="loading-mark error-mark">!</div><h1>ALGO SAIU DO JOGO</h1><p>Não foi possível carregar esta tela.</p><button type="button" className="primary-button" onClick={reset}>Tentar novamente</button></main>; }
