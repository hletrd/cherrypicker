import { defineConfig } from '@playwright/test';

const host = '127.0.0.1';
const port = 4173;
const basePath = '/cherrypicker/';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'line',
  use: {
    baseURL: `http://${host}:${port}${basePath}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `cd apps/web && bunx astro preview --host ${host} --port ${port}`,
    url: `http://${host}:${port}${basePath}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
