import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/** Sobe a API de mentira e o app compilado em modo `http`, e roda a suíte. */
const apiPort = 3201;
const appPort = 3102;
const children = [];
function start(command, args, env) {
  const child = spawn(process.execPath, [command, ...args], { stdio: 'inherit', windowsHide: true, env: { ...process.env, ...env } });
  children.push(child);
  return child;
}
function stop() { for (const child of children) child.kill(); children.length = 0; }
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });

async function waitFor(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(url); if (response.status < 500) return true; } catch {}
    await new Promise((wait) => setTimeout(wait, 500));
  }
  return false;
}

try {
  start(resolve('tests/mock-api/server.ts'), [], { MOCK_API_PORT: String(apiPort) });
  start(resolve('node_modules/next/dist/bin/next'), ['start', '-p', String(appPort)], { NEXT_DIST_DIR: '.next-http' });

  if (!await waitFor(`http://127.0.0.1:${apiPort}/test/reset`)) throw new Error('A API de mentira não subiu.');
  if (!await waitFor(`http://127.0.0.1:${appPort}/`)) throw new Error('O app em modo http não subiu.');

  const runner = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.http.config.ts', ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });
  process.exitCode = await new Promise((exit) => runner.on('exit', (code) => exit(code ?? 1)));
  stop();
} catch (error) {
  console.error(error);
  stop();
  process.exitCode = 1;
}
