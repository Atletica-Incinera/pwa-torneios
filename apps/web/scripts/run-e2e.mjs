import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const port = 3101;
const server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { stdio: 'inherit', windowsHide: true });
let stopped = false;
function stop() { if (stopped) return; stopped = true; server.kill(); }
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/`); if (response.ok) { ready = true; break; } } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  if (!ready) throw new Error('O servidor de teste não iniciou na porta 3101.');
  const runner = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true, env: { ...process.env, E2E_EXTERNAL_SERVER: '1' } });
  const code = await new Promise((resolveExit) => runner.on('exit', (value) => resolveExit(value ?? 1)));
  stop();
  process.exitCode = code;
} catch (error) {
  console.error(error);
  stop();
  process.exitCode = 1;
}
