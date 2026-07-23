const path = require('node:path');
const { expect, test } = require('@playwright/test');

const uploadFixture = path.join(__dirname, 'fixtures', 'regression-upload.csv');
const homeUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/cherrypicker/';

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

test('a page-wide file drop owns the UI and cancels the old success countdown', async ({
  page,
}) => {
  await page.goto(homeUrl);
  await page.waitForFunction(() =>
    Boolean(document.querySelector('astro-island:not([ssr])')),
  );
  await page.clock.install();
  await page.evaluate(() => {
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
    const activeCountdowns = new Set();
    globalThis.__countdownTimerProbe = {
      scheduled: 0,
      cleared: 0,
      activeCountdowns,
    };
    globalThis.setTimeout = (handler, delay, ...args) => {
      const handle = nativeSetTimeout(handler, delay, ...args);
      if (delay === 1_200) {
        globalThis.__countdownTimerProbe.scheduled++;
        activeCountdowns.add(handle);
      }
      return handle;
    };
    globalThis.clearTimeout = (handle) => {
      if (activeCountdowns.delete(handle)) {
        globalThis.__countdownTimerProbe.cleared++;
      }
      nativeClearTimeout(handle);
    };
  });
  await page.locator('input[type="file"]').first().setInputFiles(uploadFixture);
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await expect(page.getByText(/^분석 완료/)).toBeVisible({
    timeout: 30_000,
  });
  expect(await page.evaluate(() => ({
    scheduled: globalThis.__countdownTimerProbe.scheduled,
    active: globalThis.__countdownTimerProbe.activeCountdowns.size,
  }))).toEqual({ scheduled: 1, active: 1 });

  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(
      [
        '날짜,가맹점,금액\n' +
        '2026-05-01,카운트다운 뒤 새 파일,70000\n',
      ],
      'countdown-replacement.csv',
      { type: 'text/csv' },
    ));
    document.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    }));
  });

  await expect(page.getByText('countdown-replacement.csv')).toBeVisible();
  await expect(page.getByText(/^분석 완료/)).not.toBeVisible();
  expect(await page.evaluate(() => ({
    cleared: globalThis.__countdownTimerProbe.cleared,
    active: globalThis.__countdownTimerProbe.activeCountdowns.size,
  }))).toEqual({ cleared: 1, active: 0 });

  // Cross the production 1.2-second deadline: the prior callback must remain
  // inert and the newly admitted file must still own the upload screen.
  await page.clock.fastForward(1_400);
  expect(new URL(page.url()).pathname).toBe(new URL(homeUrl).pathname);
  await expect(page.getByText('countdown-replacement.csv')).toBeVisible();
  await expect(page.getByRole('button', { name: /^분석 시작/ })).toBeVisible();
});

test('built app bounds persisted-state migration and recovers safely', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(homeUrl);
  await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
  await page.locator('input[type="file"]').first().setInputFiles(uploadFixture);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(page.locator('#dashboard-data-content')).toBeVisible();

  await page.evaluate(() => {
    const key = 'cherrypicker:analysis';
    const persisted = JSON.parse(sessionStorage.getItem(key));
    delete persisted._v;
    persisted.transactions = [{ id: '', date: 1 }];
    sessionStorage.setItem(key, JSON.stringify(persisted));
  });
  await page.reload();

  await expect(page.locator('#dashboard-data-content')).toBeVisible();
  await expect(page.getByText('거래 내역을 불러오지 못했어요. 다시 분석해 보세요.')).toBeVisible();

  await page.evaluate(() => {
    const key = 'cherrypicker:analysis';
    const persisted = JSON.parse(sessionStorage.getItem(key));
    persisted._v = 999;
    sessionStorage.setItem(key, JSON.stringify(persisted));
  });
  await page.reload();

  await expect(page.locator('#dashboard-empty-state')).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem('cherrypicker:analysis')),
  ).toBeNull();
  expect(pageErrors).toEqual([]);
});

test('skip link stays on each nested route and focuses the main landmark', async ({
  page,
}) => {
  for (const route of ['dashboard', 'cards', 'results', 'report']) {
    await page.goto(new URL(`${route}/`, homeUrl).toString());
    const skipLink = page.getByRole('link', {
      name: '본문으로 건너뛰기',
    });
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    const currentPath = new URL(page.url()).pathname;
    expect(await skipLink.getAttribute('href')).toBe(
      `${currentPath}#main-content`,
    );
    await skipLink.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator('main#main-content')).toBeFocused();
  }
});
