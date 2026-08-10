import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O navegador acessa o servidor por localhost, loopback ou pelo IP da rede
  // local. O Next bloqueia esses hosts nos assets internos do dev server sem
  // esta lista, retornando 403 para os chunks e para o HMR.
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.*.*'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // A persistência do Turbopack pode ficar extremamente lenta no Windows
    // durante a compactação do cache. O cache em memória continua ativo.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
