/**
 * Para onde a suíte `http` aponta.
 *
 * `mock` é o padrão e roda em qualquer máquina, sem servidor: é o que garante
 * que o contrato continue verificável mesmo com a API fora do ar. `real` aponta
 * para a API de verdade, e existe para provar a integração.
 *
 * Duas pastas de build porque `NEXT_PUBLIC_*` é embutido na compilação — uma
 * imagem não serve os dois alvos, e alternar a variável não faria efeito.
 */
export function resolveTarget() {
  const real = process.env.E2E_API === 'real';
  return real
    ? {
      name: 'real',
      apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api/v1',
      distDir: '.next-api',
      appPort: 3103,
      /** A API real não sobe por aqui: quem a levanta é o compose ou você. */
      startsMock: false,
      healthPath: '/health',
    }
    : {
      name: 'mock',
      apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3201',
      distDir: '.next-http',
      appPort: 3102,
      startsMock: true,
      healthPath: '/test/reset',
    };
}
