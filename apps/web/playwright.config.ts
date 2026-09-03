import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  expect: { timeout: 7_000, toHaveScreenshot: { maxDiffPixelRatio: 0.025, animations: 'disabled' } },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://127.0.0.1:3101', channel: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  // Este ramo só vale para quem chama a CLI do Playwright direto: `npm run
  // test:e2e` e o CI passam por `scripts/run-e2e.mjs`, que sobe o servidor
  // por conta própria e declara E2E_EXTERNAL_SERVER — ou seja, nada aqui é
  // exercitado pelo CI, e um erro nesta linha passa despercebido.
  //
  // E `next start`, não `.next/standalone/server.js`, apesar do aviso que o
  // próprio Next imprime aqui ('next start does not work with output:
  // standalone'). O aviso é genérico e engana neste repositório: a saída
  // standalone existe (o Dockerfile depende dela), mas o Next não copia
  // `.next/static` nem `public` para dentro dela — quem faz isso é o
  // Dockerfile, com dois COPY. Rodando o server.js daqui, o HTML vem 200 e
  // todo chunk e CSS devolve 404: um app sem estilo e sem JavaScript, no
  // qual quase todo teste falha por um motivo que não é o dele. Medido:
  // `/_next/static/chunks/*.js` e `*.css` → 404; com `next start` → 200.
  webServer: process.env.E2E_EXTERNAL_SERVER ? undefined : { command: 'node node_modules/next/dist/bin/next start -p 3101', url: 'http://127.0.0.1:3101', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
});
