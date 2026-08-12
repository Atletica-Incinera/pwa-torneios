import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/** Build do app apontando para a API: `NEXT_PUBLIC_*` é embutido na compilação. */
const build = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'build'], {
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    NEXT_DIST_DIR: '.next-http',
    NEXT_PUBLIC_DATA_SOURCE: 'http',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3201',
  },
});
process.exitCode = await new Promise((exit) => build.on('exit', (code) => exit(code ?? 1)));
