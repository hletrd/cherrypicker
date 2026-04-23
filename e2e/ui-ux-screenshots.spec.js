/**
 * Screenshot capture for UI/UX review — captures all pages in both themes
 */
const { expect, test } = require('@playwright/test');
const path = require('path');

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/cherrypicker/';
const FIXTURE = path.join(__dirname, 'fixtures', 'regression-upload.csv');
const OUT = path.join(__dirname, '..', 'test-results', 'ui-screenshots');

test.describe.configure({ mode: 'default' });
// CSP now includes 'unsafe-inline' for script-src; enforce real CSP.

test('capture home page light', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/home-light.png`, fullPage: true });
});

test('capture home page dark', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('cherrypicker:theme', 'dark'); });
  await page.reload();
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/home-dark.png`, fullPage: true });
});

test('capture home mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/home-mobile.png`, fullPage: true });
});

test('capture upload with file selected', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/home-file-selected.png`, fullPage: true });
});

test('capture dashboard with data', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/dashboard-light.png`, fullPage: true });
});

test('capture dashboard with transaction review expanded', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await page.waitForTimeout(1000);
  // Expand transaction review
  const btn = page.locator('button').filter({ hasText: '거래 내역 확인' }).first();
  await btn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/dashboard-tx-review.png`, fullPage: true });
});

test('capture results page', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await page.goto(BASE + 'results');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/results-light.png`, fullPage: true });
});

test('capture report page with data', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await page.goto(BASE + 'report');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/report-with-data.png`, fullPage: true });
});

test('capture report page empty', async ({ page }) => {
  await page.goto(BASE + 'report');
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/report-empty.png`, fullPage: true });
});

test('capture cards page', async ({ page }) => {
  await page.goto(BASE + 'cards');
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/cards-light.png`, fullPage: true });
});

test('capture dashboard mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/dashboard-mobile.png`, fullPage: true });
});

test('capture dark mode dashboard', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('cherrypicker:theme', 'dark'); });
  await page.reload();
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/dashboard-dark.png`, fullPage: true });
});

test('capture mobile menu open', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.locator('#mobile-menu-btn').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/mobile-menu-open.png`, fullPage: true });
});
