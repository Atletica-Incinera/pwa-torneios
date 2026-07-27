import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
