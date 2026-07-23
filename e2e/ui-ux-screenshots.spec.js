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

async function waitForHydration(page) {
  await page.waitForFunction(() => {
    const islands = [...document.querySelectorAll('astro-island')];
    return islands.length > 0 && islands.every((island) => !island.hasAttribute('ssr'));
  });
}

// Screenshot-only stabilization: wait for web fonts and two rendered frames
// after the page-specific visible condition has passed.
async function waitForScreenshotReady(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

async function openHome(page) {
  await page.goto(BASE);
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: 'CherryPicker' })).toBeVisible();
}

async function analyzeFixture(page) {
  await openHome(page);
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await expect(page.getByRole('button', { name: /^분석 시작/ })).toBeVisible();
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(page.locator('#dashboard-data-content')).toBeVisible();
  await expect(page.getByRole('heading', { name: '지출 요약' })).toBeVisible();
}

test('capture home page light', async ({ page }) => {
  await openHome(page);
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/home-light.png`, fullPage: true });
});

test('capture home page dark', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('cherrypicker:theme', 'dark'); });
  await page.reload();
  await waitForHydration(page);
  await expect(page.locator('html')).toHaveClass(/dark/);
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/home-dark.png`, fullPage: true });
});

test('capture home mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openHome(page);
  await expect(page.locator('#mobile-menu-btn')).toBeVisible();
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/home-mobile.png`, fullPage: true });
});

test('capture upload with file selected', async ({ page }) => {
  await openHome(page);
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await expect(page.getByRole('button', { name: /^분석 시작/ })).toBeVisible();
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/home-file-selected.png`, fullPage: true });
});

test('capture dashboard with data', async ({ page }) => {
  await analyzeFixture(page);
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/dashboard-light.png`, fullPage: true });
});

test('capture dashboard with transaction review expanded', async ({ page }) => {
  await analyzeFixture(page);
  // Expand transaction review
  const btn = page.locator('button').filter({ hasText: '거래 내역 확인' }).first();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/dashboard-tx-review.png`, fullPage: true });
});

test('capture results page', async ({ page }) => {
  await analyzeFixture(page);
  await page.goto(BASE + 'results');
  await expect(page.locator('#results-data-content')).toBeVisible();
  await expect(page.getByRole('heading', { name: '카드 추천 결과' })).toBeVisible();
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/results-light.png`, fullPage: true });
});

test('capture report page with data', async ({ page }) => {
  await analyzeFixture(page);
  await page.goto(BASE + 'report');
  await expect(page.locator('#report-data-content')).toBeVisible();
  await expect(page.getByRole('heading', { name: '분석 리포트' })).toBeVisible();
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/report-with-data.png`, fullPage: true });
});

test('capture report page empty', async ({ page }) => {
  await page.goto(BASE + 'report');
  await waitForHydration(page);
  await expect(page.locator('#report-empty-state')).toBeVisible();
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/report-empty.png`, fullPage: true });
});

test('capture cards page', async ({ page }) => {
  await page.goto(BASE + 'cards');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: '카드 목록' })).toBeVisible();
  await expect(page.getByLabel('카드 검색')).toBeVisible();
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/cards-light.png`, fullPage: true });
});

test('capture dashboard mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await analyzeFixture(page);
  await expect(page.locator('#mobile-menu-btn')).toBeVisible();
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/dashboard-mobile.png`, fullPage: true });
});

test('capture dark mode dashboard', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('cherrypicker:theme', 'dark'); });
  await page.reload();
  await waitForHydration(page);
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(page.locator('#dashboard-data-content')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/dashboard-dark.png`, fullPage: true });
});

test('capture mobile menu open', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openHome(page);
  await page.locator('#mobile-menu-btn').click();
  await expect(page.locator('#mobile-menu-btn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await waitForScreenshotReady(page);
  await page.screenshot({ path: `${OUT}/mobile-menu-open.png`, fullPage: true });
});
