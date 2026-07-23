import { defineConfig } from '@playwright/test';
import { resolveE2ERuntime } from './scripts/e2e-runtime.js';

const { host, port, baseURL } = resolveE2ERuntime();

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/ui-ux-screenshots.spec.js',
  outputDir: './test-results/playwright-screenshots',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `cd apps/web && bunx astro preview --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
