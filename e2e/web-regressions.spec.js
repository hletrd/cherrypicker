const path = require('node:path');
const { expect, test } = require('@playwright/test');

const uploadFixture = path.join(__dirname, 'fixtures', 'regression-upload.csv');
const homeUrl = 'http://127.0.0.1:4173/cherrypicker/';

test.describe.configure({ mode: 'serial' });

// CSP now includes 'unsafe-inline' for script-src, so Playwright should
// enforce it and surface any real CSP violations in production.

test('browser flow classifies regression merchants and renders dashboard/results/report', async ({
  page,
}) => {
  const pageErrors = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  await page.goto(homeUrl);
  await expect(page).toHaveTitle(/홈 \| CherryPicker/);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));

  await page.locator('input[type="file"]').first().setInputFiles(uploadFixture);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();

  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: '내 지출 분석' })).toBeVisible();
  await expect(page.getByText('공과금').first()).toBeVisible();
  await expect(page.getByText('오프라인쇼핑').first()).toBeVisible();

  const dashboardPersisted = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('cherrypicker:analysis') || 'null'),
  );

  expect(dashboardPersisted).not.toBeNull();
  expect(
    dashboardPersisted.optimization.assignments.some(
      (assignment) => assignment.category === 'utilities',
    ),
  ).toBe(true);
  expect(
    dashboardPersisted.optimization.assignments.some(
      (assignment) => assignment.category === 'offline_shopping',
    ),
  ).toBe(true);

  await page.getByRole('link', { name: '추천 결과 보기' }).click();
  await page.waitForURL('**/results', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '카드 추천 결과' })).toBeVisible();
  await expect(page.locator('#stat-total-spending')).toContainText('원');
  await expect(page.locator('#stat-total-savings')).toContainText('원');
  await expect(page.locator('#stat-cards-needed')).toContainText('장');

  const persisted = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('cherrypicker:analysis') || 'null'),
  );

  expect(persisted).not.toBeNull();
  expect(persisted.optimization.totalReward).toBe(
    persisted.optimization.cardResults.reduce(
      (sum, cardResult) => sum + cardResult.totalReward,
      0,
    ),
  );
  expect(persisted.optimization.totalSpending).toBe(
    persisted.optimization.assignments.reduce((sum, assignment) => sum + assignment.spending, 0),
  );

  await page.getByRole('link', { name: '리포트 보기' }).click();
  await page.waitForURL('**/report', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '분석 리포트' })).toBeVisible();
  await expect(page.locator('#report-data-content')).toContainText('분석 요약');
  await expect(page.locator('#report-data-content')).toContainText('추천 카드 조합');
  await expect(page.locator('#report-data-content')).not.toContainText('아직 분석 결과가 없어요');

  expect(pageErrors).toEqual([]);
});
