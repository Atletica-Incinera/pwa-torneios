import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 7_000, toHaveScreenshot: { maxDiffPixelRatio: 0.025, animations: 'disabled' } },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://127.0.0.1:3101', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.E2E_EXTERNAL_SERVER ? undefined : { command: 'node node_modules/next/dist/bin/next start -p 3101', url: 'http://127.0.0.1:3101', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
});
