import { defineConfig, devices } from '@playwright/test';

/**
 * A suíte do modo `http`: o app compilado contra a API. Contra o mock por
 * padrão (`test:e2e:http`, sem servidor) ou contra a API real
 * (`test:e2e:api`). Roda em série e com um worker só porque o estado é do
 * servidor, e não de cada aba.
 */
const appPort = process.env.E2E_APP_PORT ?? '3102';
export default defineConfig({
  testDir: './tests/e2e-http',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${appPort}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
});
