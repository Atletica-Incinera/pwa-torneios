import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { resolveTarget } from './e2e-target.mjs';

/** Sobe o alvo (mock ou nada) e o app compilado em modo `http`, e roda a suíte. */
const target = resolveTarget();
const require = createRequire(import.meta.url);
const children = [];

function start(command, args, env) {
  const child = spawn(process.execPath, [command, ...args], { stdio: 'inherit', windowsHide: true, env: { ...process.env, ...env } });
  children.push(child);
  return child;
}
function stop() { for (const child of children) child.kill(); children.length = 0; }

/**
 * O `exports` do Playwright não expõe `cli.js`, então resolver o subcaminho
 * direto falha. O `package.json` é exportado — e o diretório dele é o ponto de
 * partida honesto, que sobrevive ao dia em que as dependências forem elevadas
 * para a raiz de um workspace.
 */
function playwrightCli() {
  return resolve(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
}
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });

/**
 * Espera o endereço responder **2xx**, e conta o que viu.
 *
 * Aceitar qualquer coisa abaixo de 500 dava por no ar uma API que respondia
 * `404` — que é justamente o caso a pegar: rota de saúde renomeada, prefixo de
 * versão errado no endereço, ou outro serviço atendendo naquela porta. Nos três
 * o servidor responde, e nos três a suíte inteira fica vermelha depois.
 *
 * O último status volta junto porque "respondeu 404" e "não respondeu nada"
 * pedem conserto diferente.
 */
async function waitFor(url, attempts = 60) {
  let status = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return { up: true, status: response.status }; status = response.status; } catch { status = null; }
    await new Promise((wait) => setTimeout(wait, 500));
  }
  return { up: false, status };
}

/** O que o operador precisa ler antes do "suba a API": o que veio da porta. */
function lastAnswer(status) {
  return status === null ? 'não respondeu' : `respondeu ${status}`;
}

try {
  if (target.startsMock) {
    start(resolve('tests/mock-api/server.ts'), [], { MOCK_API_PORT: String(new URL(target.apiUrl).port || 80) });
  }
  start(require.resolve('next/dist/bin/next'), ['start', '-p', String(target.appPort)], { NEXT_DIST_DIR: target.distDir });

  // Contra a API real, uma checagem curta: se ela não estiver de pé, dizer isso
  // vale mais que deixar oito cenários vermelhos sem causa aparente.
  const health = `${target.apiUrl}${target.healthPath}`;
  const api = await waitFor(health, target.startsMock ? 60 : 10);
  if (!api.up) {
    throw new Error(target.startsMock
      ? `A API de mentira ${lastAnswer(api.status)} em ${health}.`
      : `A API real ${lastAnswer(api.status)} em ${health}, e a checagem exige 2xx. Suba-a antes (docker compose -f docker-compose.yml -f docker-compose.api.yml up), confira o endereço em NEXT_PUBLIC_API_URL e que o gancho de reset está habilitado (ENABLE_TEST_ENDPOINTS).`);
  }
  const app = await waitFor(`http://127.0.0.1:${target.appPort}/`);
  if (!app.up) throw new Error(`O app em modo http ${lastAnswer(app.status)} em http://127.0.0.1:${target.appPort}/.`);

  const runner = spawn(process.execPath, [playwrightCli(), 'test', '--config', 'playwright.http.config.ts', ...process.argv.slice(2)], {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, E2E_API: target.name, E2E_API_URL: target.apiUrl, E2E_APP_PORT: String(target.appPort) },
  });
  process.exitCode = await new Promise((exit) => runner.on('exit', (code) => exit(code ?? 1)));
  stop();
} catch (error) {
  console.error(error);
  stop();
  process.exitCode = 1;
}
