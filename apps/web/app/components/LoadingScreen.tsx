/** Tela de carregamento padrão — antes copiada em seis arquivos. */
export function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="app-screen global-state-screen" aria-busy="true">
      <span className="loading-mark">26</span>
      <div className="loading-line" />
      <p>{message}</p>
    </main>
  );
}
