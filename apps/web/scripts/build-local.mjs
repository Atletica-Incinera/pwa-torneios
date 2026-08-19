import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Build do app com os dados no navegador, que é o que a suíte e2e local exercita.
 *
 * `NEXT_PUBLIC_DATA_SOURCE` é embutido na compilação e o padrão de
 * `resolveDataSource` é `http`: sem declarar `local` aqui, a build que a suíte
 * local usa saía apontando para uma API que não existe naquele contexto, e todo
 * teste que precisa entrar no app parava em "Falha na requisição (404)".
 */
const build = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'build'], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, NEXT_PUBLIC_DATA_SOURCE: 'local' },
});
process.exitCode = await new Promise((exit) => build.on('exit', (code) => exit(code ?? 1)));
