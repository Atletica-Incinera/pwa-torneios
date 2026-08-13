import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * A suíte `http` contra a API real.
 *
 * A variável é definida aqui, em JavaScript, e não no script do package.json:
 * `E2E_API=real npm run ...` não funciona em PowerShell nem no cmd, e a equipe
 * desenvolve no Windows.
 */
const env = { ...process.env, E2E_API: 'real' };

function run(script, args = []) {
  return new Promise((exit) => {
    const child = spawn(process.execPath, [resolve(script), ...args], { stdio: 'inherit', windowsHide: true, env });
    child.on('exit', (code) => exit(code ?? 1));
  });
}

const built = await run('scripts/build-http.mjs');
process.exitCode = built === 0 ? await run('scripts/run-e2e-http.mjs', process.argv.slice(2)) : built;
