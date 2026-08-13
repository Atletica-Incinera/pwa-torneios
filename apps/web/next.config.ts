import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `NEXT_PUBLIC_DATA_SOURCE` é embutido na compilação, então cada origem de
  // dados precisa da sua build. Separar a pasta deixa as duas conviverem: a
  // suíte local não derruba a do HTTP nem o contrário.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // O navegador acessa o servidor por localhost, loopback ou pelo IP da rede
  // local. O Next bloqueia esses hosts nos assets internos do dev server sem
  // esta lista, retornando 403 para os chunks e para o HMR.
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.*.*'],
  turbopack: {
    // A raiz do workspace, não a do app: com o lockfile na raiz, o Turbopack
    // inferiria um diretório diferente do que o npm usa e avisaria a cada
    // compilação.
    root: path.resolve(__dirname, '..', '..'),
  },
  experimental: {
    // A persistência do Turbopack pode ficar extremamente lenta no Windows
    // durante a compactação do cache. O cache em memória continua ativo.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
