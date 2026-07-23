import { defineConfig } from '@playwright/test';
import { resolveE2ERuntime } from './scripts/e2e-runtime.js';

const { host, port, baseURL } = resolveE2ERuntime();

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/ui-ux-screenshots.spec.js',
  outputDir: './test-results/playwright-regression',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'line',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.04,
    },
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `cd apps/web && bunx astro preview --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
