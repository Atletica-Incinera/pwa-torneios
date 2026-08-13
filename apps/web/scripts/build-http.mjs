import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolveTarget } from './e2e-target.mjs';

/** Build do app apontando para a API: `NEXT_PUBLIC_*` é embutido na compilação. */
const target = resolveTarget();
const next = createRequire(import.meta.url).resolve('next/dist/bin/next');

console.log(`build em modo http contra o alvo ${target.name}: ${target.apiUrl}`);
const build = spawn(process.execPath, [next, 'build'], {
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    NEXT_DIST_DIR: target.distDir,
    NEXT_PUBLIC_DATA_SOURCE: 'http',
    NEXT_PUBLIC_API_URL: target.apiUrl,
    NEXT_PUBLIC_REALTIME: process.env.NEXT_PUBLIC_REALTIME ?? 'sse',
  },
});
process.exitCode = await new Promise((exit) => build.on('exit', (code) => exit(code ?? 1)));
