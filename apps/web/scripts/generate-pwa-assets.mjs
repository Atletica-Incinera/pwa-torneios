import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
// `@playwright/test` reexporta o `chromium`, e é o único pacote do Playwright
// que este projeto declara. Pedir `playwright` direto funcionava só por ele
// estar aninhado como dependência transitiva, e abriria espaço para as duas
// versões divergirem — o binário do navegador é baixado pela versão instalada,
// não pela importada.
import { chromium } from '@playwright/test';
import { screenshotCaptures, splashDevices, splashFile } from '../app/lib/pwa-assets.ts';

/**
 * Gera as imagens que a ficha de instalação e o iOS pedem: as capturas do
 * manifesto e as telas de abertura.
 *
 * Usa o Chromium que o Playwright já instalou — nenhuma biblioteca de imagem
 * entra no projeto por causa disto. A tabela de aparelhos e de capturas mora em
 * `app/lib/pwa-assets.ts`, que é a mesma que o manifesto e o `<head>` leem.
 *
 * **Escreve apenas em `public/`.** As bases de regressão visual vivem em
 * `tests/e2e/navigation.spec.ts-snapshots/` e são outro mecanismo: aquilo prova
 * que a tela não mudou, isto é material do produto. Regenerar um nunca deve
 * tocar o outro.
 *
 *   npm run build && npm run pwa:assets
 */
const require = createRequire(import.meta.url);

const port = 3105;
const background = '#022734';

const browser = await chromium.launch();
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port)], { stdio: 'inherit', windowsHide: true });

try {
  await waitForServer();
  await writeSplashScreens();
  await writeScreenshots();
} finally {
  await browser.close();
  server.kill();
}

async function writeSplashScreens() {
  const icon = readFileSync(resolve('public/icon-512.png')).toString('base64');
  const dir = resolve('public/splash');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  for (const device of splashDevices) {
    const page = await browser.newPage({ viewport: { width: device.width, height: device.height }, deviceScaleFactor: device.scale });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      html, body { margin: 0; height: 100%; }
      body { background: ${background}; display: grid; place-items: center; }
      img { width: 38%; max-width: 320px; }
    </style><img src="data:image/png;base64,${icon}" alt="">`);
    await page.screenshot({ path: resolve('public', splashFile(device).slice(1)) });
    await page.close();
    console.log(`abertura ${splashFile(device)}  ${device.name}`);
  }

  writeFileSync(resolve(dir, 'LEIA-ME.md'), [
    '# Telas de abertura do iOS',
    '',
    'Geradas por `npm run pwa:assets`. Não edite à mão: os nomes de arquivo e as',
    'consultas de mídia do `<head>` saem da mesma tabela, em',
    '`app/lib/pwa-assets.ts`.',
    '',
    'O iOS escolhe por consulta de mídia exata e não tem fallback — aparelho que',
    'não bater com nenhuma linha abre com tela branca.',
    '',
  ].join('\n'));
}

async function writeScreenshots() {
  const dir = resolve('public/screenshots');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  for (const capture of screenshotCaptures) {
    const page = await browser.newPage({ viewport: { width: capture.width, height: capture.height }, deviceScaleFactor: capture.scale });
    await page.goto(`http://127.0.0.1:${port}${capture.path}`, { waitUntil: 'networkidle' });
    // A cortina de carregamento some quando o estado hidrata. Capturar antes
    // disso publicaria uma tela vazia na ficha de instalação.
    await page.waitForSelector('main', { state: 'visible' });
    await page.screenshot({ path: resolve(dir, capture.file) });
    await page.close();
    console.log(`captura  /screenshots/${capture.file}`);
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/`); if (response.ok) return; } catch { /* ainda subindo */ }
    await new Promise((wait) => setTimeout(wait, 500));
  }
  throw new Error(`O app compilado não subiu na porta ${port}. Rode \`npm run build\` antes.`);
}
