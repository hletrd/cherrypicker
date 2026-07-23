/**
 * Comprehensive UI/UX review spec for CherryPicker
 * Tests: accessibility, responsive layout, navigation, interaction flows,
 * error states, dark mode, CSP compliance, SEO, performance signals
 */
const { expect, test } = require('@playwright/test');

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/cherrypicker/';
const FIXTURE = require('path').join(__dirname, 'fixtures', 'regression-upload.csv');

async function waitForComponentHydration(readyLocator) {
  await expect(readyLocator).toBeAttached();
  const island = readyLocator.locator('xpath=ancestor::astro-island[1]');
  await expect(island).toHaveCount(1);
  await expect(island).not.toHaveAttribute('ssr');
}

async function waitForChildIslandsHydrated(container) {
  await expect(container).toBeVisible();
  await expect(container.locator('astro-island')).not.toHaveCount(0);
  await expect(container.locator('astro-island[ssr]')).toHaveCount(0);
}

async function waitForCardCatalog(page) {
  const root = page.getByTestId('card-grid-root');
  await waitForComponentHydration(root);
  await expect(root).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('card-grid-page')).toBeVisible();
  await expect(page.getByTestId('card-grid-filtered-count')).toHaveText(
    /^[1-9]\d*개 카드$/,
  );
}

async function submitAndOpenDashboard(page) {
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  const dashboardAction = page.getByRole('button', { name: '대시보드 보기' });
  await expect(dashboardAction).toBeVisible({ timeout: 30_000 });
  await expect(dashboardAction).toBeFocused();
  await dashboardAction.click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

async function readFilteredCardCount(page) {
  const text = await page.getByTestId('card-grid-filtered-count').innerText();
  const match = text.match(/^([\d,]+)개 카드$/);
  expect(match, `Unexpected card-count copy: ${text}`).toBeTruthy();
  return Number(match[1].replaceAll(',', ''));
}

async function observePostSettleRuntimeWindow(page, proofName) {
  await test.step(`observe post-settle runtime window: ${proofName}`, async () => {
    const marker = `[e2e-post-settle:${proofName}]`;
    const markerObserved = page.waitForEvent('console', {
      predicate: (message) =>
        message.type() === 'debug' && message.text() === marker,
    });

    await page.evaluate((message) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => console.debug(message));
      });
    }, marker);

    const observation = await markerObserved;
    expect(
      observation.text(),
      `${proofName}: post-settle frame sentinel was not observed`,
    ).toBe(marker);
  });
}

function expectNoUnexpectedRuntimeErrors(errors, proofName) {
  const realErrors = errors.filter(
    (error) =>
      !error.includes('Content Security Policy') &&
      !error.includes('astro-island'),
  );
  expect(
    realErrors,
    `${proofName}: unexpected runtime errors:\n${realErrors.join('\n')}`,
  ).toEqual([]);
}

// The real cycle-6 D6-01 root cause was a runtime type mismatch in
// parsePreviousSpending (C7-E01). With that fix in place, parallel describe
// mode is safe — the upload pipeline no longer hangs under concurrency.
// We DO NOT use serial at file level because in Playwright a single
// failure in serial mode stops every subsequent test in the file, which
// prevents downstream diagnosis of unrelated failures.
test.describe.configure({ mode: 'parallel' });
// CSP now includes 'unsafe-inline' for script-src, so Playwright should
// enforce it and surface any real CSP violations in production.

// ─── Home Page ───

test.describe('Home page', () => {
  test('has correct title and meta', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/홈 \| CherryPicker/);
    const desc = await page.getAttribute('meta[name="description"]', 'content');
    expect(desc).toBeTruthy();
    expect(desc.length).toBeGreaterThan(10);
  });

  test('has lang="ko" on html element', async ({ page }) => {
    await page.goto(BASE);
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBe('ko');
  });

  test('hero section renders with stats', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    // Check stat numbers visible (use text matching since class selectors are fragile)
    await expect(page.getByText('카드', { exact: false }).first()).toBeVisible({ timeout: 5000 });
    // Check "카드" label exists
    await expect(page.getByText('카드', { exact: false }).first()).toBeVisible();
  });

  test('file dropzone renders and is interactive', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await expect(page.getByText('카드 명세서를 끌어다 놓으세요')).toBeVisible();
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('step indicator shows 4 steps', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    // Steps: 파일 선택, 카드사 선택, 분석 중, 완료
    await expect(page.getByText('파일 선택').first()).toBeVisible();
    await expect(page.getByText('카드사 선택')).toBeVisible();
    await expect(page.getByText('분석 중')).toBeVisible();
    await expect(page.getByText('완료')).toBeVisible();
  });

  test('how-it-works section renders 3 steps', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText('이렇게 써요')).toBeVisible();
    await expect(page.locator('h3', { hasText: '명세서 업로드' }).first()).toBeVisible();
    await expect(page.locator('h3', { hasText: '자동 분석' }).first()).toBeVisible();
    await expect(page.locator('h3', { hasText: '최적 카드 추천' }).first()).toBeVisible();
  });

  test('feature cards render', async ({ page }) => {
    await page.goto(BASE);
    // Use testids scoped to the feature-card section so these assertions
    // don't collide with the how-it-works step headings (which share the
    // same Korean copy) — D6-02 / C7E-03.
    await expect(page.getByTestId('feature-card-analysis')).toBeVisible();
    await expect(page.getByTestId('feature-card-recommend')).toBeVisible();
    await expect(page.getByTestId('feature-card-savings')).toBeVisible();
  });
});

// ─── Navigation ───

test.describe('Navigation', () => {
  test('desktop nav links are present and active state works', async ({ page }) => {
    await page.goto(BASE);
    // Desktop nav visible on md+
    const homeLink = page.locator('nav >> text=홈').first();
    await expect(homeLink).toBeVisible();
  });

  test('can navigate to all pages via nav', async ({ page }) => {
    await page.goto(BASE);

    await page.locator('nav >> text=카드 목록').first().click();
    await expect(page).toHaveURL(/\/cards/);
    await expect(page).toHaveTitle(/카드 목록/);

    await page.locator('nav >> text=대시보드').first().click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.locator('nav >> text=추천 결과').first().click();
    await expect(page).toHaveURL(/\/results/);

    await page.locator('nav >> text=홈').first().click();
    await expect(page).toHaveURL(/\/cherrypicker\/?$/);
  });

  test('mobile menu button exists and menu toggles', async ({ page }) => {
    await page.goto(BASE);
    // Mobile menu button exists (visible on small screens, but always in DOM)
    const menuBtn = page.locator('#mobile-menu-btn');
    await expect(menuBtn).toBeAttached();
    // Mobile menu starts hidden
    const mobileMenu = page.locator('#mobile-menu');
    expect(await mobileMenu.getAttribute('class')).toContain('hidden');
  });

  test('footer renders with card stats and links', async ({ page }) => {
    await page.goto(BASE);
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText('카드 수록')).toBeVisible();
    // Regex matches both the brand heading and the "© 2026 CherryPicker"
    // copyright line; .first() picks the brand heading (C7E-bucket-A).
    await expect(footer.getByText(/CherryPicker/).first()).toBeVisible();
  });
});

// ─── Dark Mode ───

test.describe('Dark mode', () => {
  test('theme toggle button exists on desktop', async ({ page }) => {
    await page.goto(BASE);
    const toggle = page.locator('#theme-toggle');
    await expect(toggle).toBeAttached();
  });

  test('clicking toggle switches dark mode class', async ({ page }) => {
    await page.goto(BASE);
    const toggle = page.locator('#theme-toggle');
    const hasDarkInitially = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await expect(toggle).toHaveAttribute(
      'aria-pressed',
      String(hasDarkInitially),
    );
    await expect(toggle).toHaveAttribute(
      'aria-label',
      hasDarkInitially ? '밝은 테마로 전환' : '어두운 테마로 전환',
    );
    await toggle.click();
    const hasDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDarkAfter).toBe(!hasDarkInitially);
    await expect(toggle).toHaveAttribute('aria-pressed', String(hasDarkAfter));
    await expect(toggle).toHaveAttribute(
      'aria-label',
      hasDarkAfter ? '밝은 테마로 전환' : '어두운 테마로 전환',
    );
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
    ).toBe(hasDarkAfter ? 'dark' : 'light');
  });

  test('dark mode persists in localStorage', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('#theme-toggle').click();
    const theme = await page.evaluate(() => localStorage.getItem('cherrypicker:theme'));
    expect(theme).toBeTruthy();
  });
});

// ─── Upload Flow ───

test.describe('Upload flow', () => {
  test('file selection updates step indicator to step 2', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    // Step 2 should be active (카드사 선택)
    await expect(page.getByText('카드사를 고르면 더 정확해요')).toBeVisible();
  });

  test('bank selector shows all 24 banks + auto-detect', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await expect(page.getByText('자동 인식')).toBeVisible();
    await expect(page.getByText('현대카드')).toBeVisible();
    await expect(page.getByText('KB국민')).toBeVisible();
    await expect(page.getByText('삼성카드')).toBeVisible();
    // 우체국 is hidden behind 더보기 (top-8 pills rendered by default) — click
    // through before asserting its visibility (D6-02 tail / C7E-bucket-D).
    await page.getByRole('button', { name: /더보기/ }).click();
    await expect(page.getByText('우체국')).toBeVisible();
  });

  test('previous spending input exists with correct label', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await expect(page.getByText('전월 카드 이용액')).toBeVisible();
    const spinbutton = page.getByRole('spinbutton');
    await expect(spinbutton).toBeVisible();
  });

  test('uploading a valid file navigates to dashboard', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);
    await expect(page.getByRole('heading', { name: '내 지출 분석' })).toBeVisible();
  });

  test('adding invalid file shows error', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    // Create a fake .txt file
    const tmpFile = '/tmp/test-invalid.txt';
    require('fs').writeFileSync(tmpFile, 'not a statement');
    await page.locator('input[type="file"]').first().setInputFiles(tmpFile);
    await expect(
      page.getByTestId('upload-error-banner').getByRole('listitem'),
    ).toHaveText(
      /^CSV\/TSV, Excel, PDF, JSON, OFX\/QFX, HTML 파일만 지원합니다 \(제외됨: test-invalid\.txt\)$/,
    );
  });

  test('can remove individual files from upload list', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    // Should see file listed
    await expect(page.getByText('regression-upload.csv')).toBeVisible();
    // Click remove
    await page.getByRole('button', {
      name: 'regression-upload.csv 제거',
      exact: true,
    }).click();
    // Should go back to empty state
    await expect(page.getByText('카드 명세서를 끌어다 놓으세요')).toBeVisible();
  });
});

// ─── Dashboard ───

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);
  });

  test('shows spending summary cards', async ({ page }) => {
    // `.first()` on each label in case a downstream component echoes the
    // same copy inside the dashboard (e.g. 월간 총혜택률 appears in the
    // card-summary header AND in the per-card row sub-text) (C7E-bucket-A).
    await expect(page.getByText('최근 월 지출').first()).toBeVisible();
    await expect(page.getByText('거래 건수').first()).toBeVisible();
    await expect(page.getByText('분석 기간').first()).toBeVisible();
    await expect(page.getByText('최다 지출 카테고리').first()).toBeVisible();
    await expect(
      page.getByText('월간 총혜택률 (연회비 차감 전)').first(),
    ).toBeVisible();
  });

  test('shows category breakdown with bars', async ({ page }) => {
    // `.first()` — "항목별 지출" could match the heading AND a sub-heading
    // in SpendingSummary or OptimalCardMap on some states (C7E-bucket-A).
    await expect(page.getByText('항목별 지출').first()).toBeVisible();
    // CategoryBreakdown uses a custom div layout (not <tr>/[role="row"]);
    // verify the category label row via the per-assignment category name
    // that appears in OptimalCardMap (which IS rendered on the dashboard
    // under the '항목별 추천 카드' heading) (C7E-bucket-A).
    await expect(page.getByText('공과금').first()).toBeVisible();
  });

  test('shows savings comparison', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: '연회비 차감 전 월간 총혜택 비교',
        exact: true,
      }),
    ).toBeVisible();
    // "체리피킹" / "카드 한 장" render both as bar labels and card headers
    // inside SavingsComparison.svelte; use .first() to resolve ambiguity
    // (C7E-bucket-A).
    await expect(page.getByText('체리피킹').first()).toBeVisible();
    await expect(page.getByText('카드 한 장').first()).toBeVisible();
  });

  test('shows transaction review section', async ({ page }) => {
    await expect(page.getByText('거래 내역 확인')).toBeVisible();
  });

  test('transaction review can expand and show table', async ({ page }) => {
    await page.getByTestId('tx-review-toggle').click();
    const table = page.getByTestId('tx-review-panel').getByRole('table');
    await expect(
      table.getByRole('columnheader', { name: '가맹점', exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: '금액', exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: '분류', exact: true }),
    ).toBeVisible();
  });

  test('transaction category dropdown has options', async ({ page }) => {
    await page.getByText('거래 내역 확인').click();
    // Find a select dropdown
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    // Check that it has meaningful options
    const optionCount = await select.locator('option').count();
    expect(optionCount).toBeGreaterThan(5);
  });

  test('filtered edits hand focus forward and keep the transaction scroller keyboard-reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    await page.waitForFunction(() =>
      Boolean(document.querySelector('astro-island:not([ssr])'),
    ));
    await page.getByLabel('파일 선택', { exact: true }).setInputFiles({
      name: 'focus-handoff.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          '날짜,가맹점,금액',
          '2026-04-01,완전히알수없는가맹점xyz가,10000',
          '2026-04-02,완전히알수없는가맹점xyz나,20000',
        ].join('\n'),
      ),
    });
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);
    await page.getByTestId('tx-review-toggle').click();

    const panel = page.getByTestId('tx-review-panel');
    await panel.getByLabel('미분류만 보기').check();
    const categorySelects = panel.locator('[data-tx-category-select]');
    await expect(categorySelects).toHaveCount(2);

    const scrollRegion = page.getByTestId('tx-review-scroll-region');
    await scrollRegion.focus();
    await expect(scrollRegion).toBeFocused();
    const initialScroll = await scrollRegion.evaluate((element) => ({
      left: element.scrollLeft,
      overflow: element.scrollWidth - element.clientWidth,
    }));
    expect(initialScroll.overflow).toBeGreaterThan(0);
    await scrollRegion.press('ArrowRight');
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(initialScroll.left);

    const firstSelect = categorySelects.first();
    await firstSelect.focus();
    await firstSelect.selectOption('dining');
    await expect(categorySelects).toHaveCount(1);
    await expect(categorySelects.first()).toBeFocused();

    await categorySelects.first().selectOption('dining');
    await expect(categorySelects).toHaveCount(0);
    await expect(page.getByTestId('tx-apply-edits')).toBeFocused();
  });

  test('optimal card map shows assignments', async ({ page }) => {
    await expect(page.getByText('항목별 추천 카드')).toBeVisible();
  });

  test('session warning banner is present', async ({ page }) => {
    // Warning about data being lost on tab close
    await expect(page.getByText(/탭을 닫으면/)).toBeVisible();
  });

  test('navigating to results works', async ({ page }) => {
    await page.getByRole('link', { name: '추천 결과 보기' }).click();
    await page.waitForURL('**/results', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '카드 추천 결과' })).toBeVisible();
  });
});

// ─── Results Page ───

test.describe('Results page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);
    await page.getByRole('link', { name: '추천 결과 보기' }).click();
    await page.waitForURL('**/results', { timeout: 15_000 });
  });

  test('shows three summary stat cards', async ({ page }) => {
    await expect(page.locator('#stat-total-spending')).toContainText('원');
    await expect(page.locator('#stat-total-savings')).toContainText('원');
    await expect(page.locator('#stat-cards-needed')).toContainText('장');
  });

  test('savings comparison shows bar chart', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: '연회비 차감 전 월간 총혜택 비교',
        exact: true,
      }),
    ).toBeVisible();
    // "체리피킹" matches both the bar label and the card header (C7E-bucket-A).
    await expect(page.getByText('체리피킹').first()).toBeVisible();
  });

  test('optimal card map shows category assignments', async ({ page }) => {
    await expect(page.getByText('항목별 추천 카드')).toBeVisible();
  });

  test('action buttons are present', async ({ page }) => {
    await expect(page.getByRole('link', { name: '리포트 보기' })).toBeVisible();
    await expect(page.getByRole('button', { name: /인쇄/ })).toBeVisible();
    await expect(page.getByRole('link', { name: '다시 분석하기' })).toBeVisible();
  });

  test('navigating to report works', async ({ page }) => {
    await page.getByRole('link', { name: '리포트 보기' }).click();
    await page.waitForURL('**/report', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '분석 리포트' })).toBeVisible();
  });
});

// ─── Report Page ───

test.describe('Report page', () => {
  test('shows empty state when no data', async ({ page }) => {
    await page.goto(BASE + 'report');
    // The report page renders the empty copy in BOTH the visible empty-state
    // container AND the hidden data container (which holds a placeholder
    // "아직 분석 결과가 없어요" until the store has data). Scope to the
    // visible container explicitly (C7E-bucket-A).
    await expect(page.locator('#report-empty-state').getByText('아직 분석 결과가 없어요')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#report-data-content')).toBeHidden();
    await expect(page.locator('#report-print-action')).toBeHidden();
    await expect(page.locator('#report-print-action')).toBeDisabled();
  });

  test('shows populated state after analysis', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);
    await page.goto(BASE + 'report');
    await page.waitForLoadState('networkidle');
    // Report should load from sessionStorage
    const content = page.locator('#report-data-content');
    await expect(content).toBeVisible();
    await expect(page.locator('#report-print-action')).toBeVisible();
    await expect(page.locator('#report-print-action')).toBeEnabled();
  });

  test('empty report print action is inert', async ({ page }) => {
    await page.addInitScript(() => {
      window.__uiReviewPrintCalls = 0;
      window.print = () => {
        window.__uiReviewPrintCalls += 1;
      };
    });
    await page.goto(BASE + 'report');
    const printAction = page.locator('#report-print-action');
    await expect(printAction).toBeHidden();
    await expect(printAction).toBeDisabled();
    await printAction.evaluate((element) => element.click());
    expect(await page.evaluate(() => window.__uiReviewPrintCalls)).toBe(0);
    await expect(page.locator('html')).not.toHaveClass(/print-mode/);
  });
});

// ─── Cards Page ───

test.describe('Cards page', () => {
  test('renders card grid with search and filters', async ({ page }) => {
    await page.goto(BASE + 'cards');
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await expect(page.getByRole('heading', { name: '카드 목록' })).toBeVisible();
    // Search input
    await expect(page.getByPlaceholder('카드 이름으로 검색')).toBeVisible();
    const typeFilters = page.getByRole('group', {
      name: '카드 종류',
      exact: true,
    });
    await expect(
      typeFilters.getByRole('button', { name: '전체', exact: true }),
    ).toBeVisible();
    await expect(
      typeFilters.getByRole('button', { name: '신용카드', exact: true }),
    ).toBeVisible();
    await expect(
      typeFilters.getByRole('button', { name: '체크카드', exact: true }),
    ).toBeVisible();
  });

  test('card grid loads cards from JSON', async ({ page }) => {
    await page.goto(BASE + 'cards');
    await waitForCardCatalog(page);
    const visibleCards = page.getByTestId('card-grid-card');
    const filteredCount = await readFilteredCardCount(page);
    expect(filteredCount).toBeGreaterThan(12);
    await expect(visibleCards).toHaveCount(12);
  });

  test('search filters cards', async ({ page }) => {
    await page.goto(BASE + 'cards');
    await waitForCardCatalog(page);
    const baseline = await readFilteredCardCount(page);
    expect(baseline).toBeGreaterThan(1);

    const searchInput = page.getByPlaceholder('카드 이름으로 검색');
    await searchInput.fill('픽E');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('search'))
      .toBe('픽E');
    await expect(page.getByTestId('card-grid-filtered-count')).toHaveText(
      '1개 카드',
    );
    const filtered = await readFilteredCardCount(page);
    expect(filtered).toBeLessThan(baseline);
    await expect(page.getByTestId('card-grid-card')).toHaveCount(1);
    await expect(page.getByTestId('card-grid-card-name')).toHaveText('픽E');
  });

  test('bottom pagination moves focus and context to the new result page', async ({
    page,
  }) => {
    await page.goto(BASE + 'cards');
    await waitForCardCatalog(page);

    const bottomPager = page.getByRole('navigation', {
      name: '카드 목록 하단 페이지',
      exact: true,
    });
    await bottomPager.getByRole('button', { name: '다음 페이지' }).click();

    const resultPage = page.getByTestId('card-grid-page');
    await expect(resultPage).toBeFocused();
    await expect(resultPage).toHaveAttribute(
      'aria-label',
      '카드 검색 결과 2페이지',
    );
    await expect
      .poll(() => new URL(page.url()).searchParams.get('page'))
      .toBe('2');
  });

  test('discontinued cards stay labeled and same-issuer navigation preserves its filter', async ({
    page,
  }) => {
    await page.goto(BASE + 'cards');
    await waitForCardCatalog(page);
    await page.getByLabel('카드 검색', { exact: true }).fill('GOAT BC');

    const card = page.getByTestId('card-grid-card').filter({
      has: page.getByText('GOAT BC 바로카드', { exact: true }),
    });
    await expect(card.getByTestId('card-discontinued-badge')).toHaveText(
      '단종 · 신규 발급 불가',
    );
    await card.click();
    await expect(
      page.getByTestId('card-detail-discontinued-badge'),
    ).toHaveText('단종 · 신규 발급 불가');

    await page.getByTestId('same-issuer-cards').click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('issuer'))
      .toBe('bc');
    await expect(page).not.toHaveURL(/#card=bc-goat$/);
  });

  test('clicking a card opens detail view', async ({ page }) => {
    await page.goto(BASE + 'cards');
    await waitForCardCatalog(page);

    const firstCard = page.getByTestId('card-grid-card').first();
    await expect(firstCard).toBeVisible();
    const cardId = await firstCard.getAttribute('data-card-id');
    const cardName = await firstCard.getByTestId('card-grid-card-name').innerText();
    const cardType = await firstCard.getByTestId('card-type-badge').innerText();
    expect(cardId).toBeTruthy();

    await firstCard.click();
    await expect(page).toHaveURL(`${BASE}cards#card=${cardId}`);
    const heading = page.getByTestId('card-detail-heading');
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(heading).toHaveText(cardName);
    await expect(page.getByTestId('card-detail-type-badge')).toHaveText(
      `${cardType}카드`,
    );
    await expect(heading.locator('..')).toContainText('국내 연회비');
    await expect(page.getByText('목록으로').first()).toBeVisible();
  });
});

// ─── Empty States ───

test.describe('Empty states', () => {
  test('dashboard empty state shows CTA', async ({ page }) => {
    await page.goto(BASE + 'dashboard');
    // On the empty dashboard, all Svelte islands live inside a hidden
    // container and never hydrate until VisibilityToggle unhides them —
    // so waitForFunction(astro-island:not([ssr])) would time out (C7E-B1).
    // Multiple components render their own empty-state copy — assert on
    // the visible empty-state container on the page wrapper directly via
    // its id #dashboard-empty-state (C7E-bucket-A).
    await expect(page.locator('#dashboard-empty-state')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#dashboard-empty-state')).toContainText('아직 분석 결과가 없어요');
  });

  test('results empty state shows CTA', async ({ page }) => {
    await page.goto(BASE + 'results');
    const emptyState = page.locator('#results-empty-state');
    await expect(emptyState).toBeVisible({ timeout: 10_000 });
    await expect(emptyState).toContainText('아직 분석 결과가 없어요');
    await expect(page.locator('#results-data-content')).toBeHidden();
    await expect(
      emptyState.getByRole('link', { name: '명세서 올리러 가기' }),
    ).toBeVisible();
  });
});

// ─── Accessibility ───

test.describe('Accessibility', () => {
  test('all images have alt text or aria-hidden', async ({ page }) => {
    await page.goto(BASE);
    const imgs = await page.locator('img').all();
    for (const img of imgs) {
      const alt = await img.getAttribute('alt');
      const ariaHidden = await img.getAttribute('aria-hidden');
      expect(alt !== null || ariaHidden === 'true', `Image missing alt: ${await img.getAttribute('src')}`).toBeTruthy();
    }
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.getByLabel('파일 선택', { exact: true }).setInputFiles(FIXTURE);
    await expect(
      page.getByLabel('전월 카드 이용액', { exact: true }),
    ).toBeVisible();

    await page.goto(BASE + 'cards');
    await expect(page.getByLabel('카드 검색', { exact: true })).toBeVisible();
    await expect(page.getByLabel('정렬', { exact: true })).toBeVisible();
  });

  test('buttons have accessible names', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      expect(
        (text && text.trim().length > 0) || ariaLabel || title,
        `Button has no accessible name`
      ).toBeTruthy();
    }
  });

  test('theme toggle has aria-label', async ({ page }) => {
    await page.goto(BASE);
    const toggle = page.locator('#theme-toggle');
    const ariaLabel = await toggle.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('select dropdowns are keyboard accessible', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);
    // Expand transaction review
    await page.getByText('거래 내역 확인').click();
    // Select should be focusable
    const select = page.locator('select').first();
    await select.focus();
    await expect(select).toBeFocused();
  });
});

// ─── Responsive Layout ───

test.describe('Responsive layout', () => {
  test('mobile viewport shows mobile nav button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    const menuBtn = page.locator('#mobile-menu-btn');
    await expect(menuBtn).toBeVisible();
  });

  test('mobile viewport hides desktop nav', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    const desktopNav = page.locator('nav .hidden.md\\:flex');
    // Should be hidden on mobile
    expect(await desktopNav.isVisible()).toBe(false);
  });

  test('mobile menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    const menuBtn = page.locator('#mobile-menu-btn');
    await menuBtn.click();
    const mobileMenu = page.locator('#mobile-menu');
    await expect(mobileMenu).toBeVisible();
    // Click a link
    await mobileMenu.locator('a[href*="cards"]').click();
    await expect(page).toHaveURL(/\/cards/);
  });

  test('dashboard grid adapts on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);
    // Spending summary should stack vertically on mobile
    const gridItems = page.locator('.grid-cols-2');
    await expect(gridItems.first()).toBeVisible();
  });
});

// ─── CSP & Console Errors ───

test.describe('CSP and runtime errors', () => {
  test('home stays error-free through the post-settle runtime window', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(BASE);
    const uploadRegion = page.getByRole('region', {
      name: '카드 명세서 업로드',
    });
    await expect(uploadRegion).toBeVisible();
    await waitForComponentHydration(uploadRegion);
    await expect(uploadRegion.locator('input[type="file"]')).toBeEnabled();
    await observePostSettleRuntimeWindow(page, 'home upload readiness');
    expectNoUnexpectedRuntimeErrors(errors, 'home post-settle proof');
  });

  test('dashboard stays error-free through the post-settle runtime window', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);
    const dashboardContent = page.locator('#dashboard-data-content');
    await expect(dashboardContent).toBeVisible();
    await expect(page.locator('#dashboard-empty-state')).toBeHidden();
    await expect(page.locator('#dashboard-status')).toHaveText(
      /^(?:분석이 끝났어요|분석 완료 — 확인할 항목 있음)$/,
    );
    await waitForChildIslandsHydrated(dashboardContent);
    await expect(
      dashboardContent.getByText('최근 월 지출').first(),
    ).toBeVisible();
    await observePostSettleRuntimeWindow(page, 'dashboard data readiness');
    expectNoUnexpectedRuntimeErrors(errors, 'dashboard post-settle proof');
  });
});

// ─── Session Persistence ───

test.describe('Session persistence', () => {
  test('analysis results persist in sessionStorage', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);

    const persisted = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('cherrypicker:analysis') || 'null')
    );
    expect(persisted).not.toBeNull();
    expect(persisted.optimization).toBeTruthy();
    expect(persisted.optimization.assignments.length).toBeGreaterThan(0);
  });

  test('results page loads from sessionStorage after navigation', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);

    // Navigate directly to results
    await page.goto(BASE + 'results');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#stat-total-spending')).toContainText('원');
  });
});

// ─── Data Integrity ───

test.describe('Data integrity', () => {
  test('total reward equals sum of card results', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);

    const data = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('cherrypicker:analysis') || 'null')
    );
    expect(data.optimization.totalReward).toBe(
      data.optimization.cardResults.reduce((sum, cr) => sum + cr.totalReward, 0)
    );
  });

  test('total spending equals sum of assignments', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await submitAndOpenDashboard(page);

    const data = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('cherrypicker:analysis') || 'null')
    );
    expect(data.optimization.totalSpending).toBe(
      data.optimization.assignments.reduce((sum, a) => sum + a.spending, 0)
    );
  });
});
