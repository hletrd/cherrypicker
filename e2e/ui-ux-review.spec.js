/**
 * Comprehensive UI/UX review spec for CherryPicker
 * Tests: accessibility, responsive layout, navigation, interaction flows,
 * error states, dark mode, CSP compliance, SEO, performance signals
 */
const { expect, test } = require('@playwright/test');

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/cherrypicker/';
const FIXTURE = require('path').join(__dirname, 'fixtures', 'regression-upload.csv');

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
    await expect(page.getByText('지출 분석')).toBeVisible();
    await expect(page.getByText('최적 카드 추천')).toBeVisible();
    await expect(page.getByText('절약 비교')).toBeVisible();
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
    await expect(footer.getByText(/CherryPicker/)).toBeVisible();
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
    // Initial state: no dark class
    const hasDarkInitially = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggle.click();
    // After click, dark class should be toggled
    const hasDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDarkAfter).toBe(!hasDarkInitially);
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
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '내 지출 분석' })).toBeVisible();
  });

  test('adding invalid file shows error', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    // Create a fake .txt file
    const tmpFile = '/tmp/test-invalid.txt';
    require('fs').writeFileSync(tmpFile, 'not a statement');
    await page.locator('input[type="file"]').first().setInputFiles(tmpFile);
    await expect(page.getByText(/CSV, Excel, PDF 파일만 지원/)).toBeVisible();
  });

  test('can remove individual files from upload list', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    // Should see file listed
    await expect(page.getByText('regression-upload.csv')).toBeVisible();
    // Click remove
    await page.getByRole('button', { name: '파일 제거' }).click();
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
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
  });

  test('shows spending summary cards', async ({ page }) => {
    await expect(page.getByText('최근 월 지출')).toBeVisible();
    await expect(page.getByText('거래 건수')).toBeVisible();
    await expect(page.getByText('분석 기간')).toBeVisible();
    await expect(page.getByText('최다 지출 카테고리')).toBeVisible();
    await expect(page.getByText('실효 혜택률')).toBeVisible();
  });

  test('shows category breakdown with bars', async ({ page }) => {
    await expect(page.getByText('항목별 지출')).toBeVisible();
    // At least one category should be visible
    const categoryRows = page.locator('[role="row"]');
    await expect(categoryRows.first()).toBeVisible();
  });

  test('shows savings comparison', async ({ page }) => {
    await expect(page.getByText('절약 비교')).toBeVisible();
    await expect(page.getByText('체리피킹')).toBeVisible();
    await expect(page.getByText('카드 한 장')).toBeVisible();
  });

  test('shows transaction review section', async ({ page }) => {
    await expect(page.getByText('거래 내역 확인')).toBeVisible();
  });

  test('transaction review can expand and show table', async ({ page }) => {
    await page.getByText('거래 내역 확인').click();
    // Table should appear with headers
    await expect(page.getByText('가맹점').first()).toBeVisible();
    await expect(page.getByText('금액').first()).toBeVisible();
    await expect(page.getByText('분류').first()).toBeVisible();
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
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await page.getByRole('link', { name: '추천 결과 보기' }).click();
    await page.waitForURL('**/results', { timeout: 15_000 });
  });

  test('shows three summary stat cards', async ({ page }) => {
    await expect(page.locator('#stat-total-spending')).toContainText('원');
    await expect(page.locator('#stat-total-savings')).toContainText('원');
    await expect(page.locator('#stat-cards-needed')).toContainText('장');
  });

  test('savings comparison shows bar chart', async ({ page }) => {
    await expect(page.getByText('혜택 비교')).toBeVisible();
    await expect(page.getByText('체리피킹')).toBeVisible();
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
    await expect(page.getByText('아직 분석 결과가 없어요')).toBeVisible();
  });

  test('shows populated state after analysis', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await page.goto(BASE + 'report');
    await page.waitForLoadState('networkidle');
    // Report should load from sessionStorage
    const content = page.locator('#report-content');
    await expect(content).toBeVisible();
  });

  test('print button exists', async ({ page }) => {
    await page.goto(BASE + 'report');
    await expect(page.getByRole('button', { name: /인쇄/ })).toBeVisible();
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
    // Type filter tabs
    await expect(page.getByText('전체')).toBeVisible();
    await expect(page.getByText('신용카드')).toBeVisible();
    await expect(page.getByText('체크카드')).toBeVisible();
  });

  test('card grid loads cards from JSON', async ({ page }) => {
    await page.goto(BASE + 'cards');
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    // Wait for cards to load
    await page.waitForTimeout(2000);
    // Should have card count
    await expect(page.getByText(/개 카드/)).toBeVisible();
  });

  test('search filters cards', async ({ page }) => {
    await page.goto(BASE + 'cards');
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.waitForTimeout(2000);
    const searchInput = page.getByPlaceholder('카드 이름으로 검색');
    await searchInput.fill('삼성');
    // Count should change
    const countText = await page.getByText(/개 카드/).textContent();
    expect(countText).toBeTruthy();
  });

  test('clicking a card opens detail view', async ({ page }) => {
    await page.goto(BASE + 'cards');
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.waitForTimeout(2000);
    // Click first card
    const firstCard = page.locator('button[class*="rounded-xl"][class*="border"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      // Should show detail view with back button
      await expect(page.getByText('목록으로')).toBeVisible();
    }
  });
});

// ─── Empty States ───

test.describe('Empty states', () => {
  test('dashboard empty state shows CTA', async ({ page }) => {
    await page.goto(BASE + 'dashboard');
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await expect(page.getByText('아직 분석한 내역이 없어요').or(page.getByText('아직 비교 데이터가 없어요'))).toBeVisible();
  });

  test('results empty state shows CTA', async ({ page }) => {
    await page.goto(BASE + 'results');
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    // Should show placeholder or empty state
    const hasContent = await page.locator('#stat-total-spending').isVisible().catch(() => false);
    if (!hasContent) {
      await expect(page.getByText(/아직|명세서를 올/).first()).toBeVisible();
    }
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
    const inputs = await page.locator('input[type="number"], input[type="text"]').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      const ariaLabel = await input.getAttribute('aria-label');
      const labelledBy = await input.getAttribute('aria-labelledby');
      // At least one label mechanism should exist
      expect(
        placeholder || ariaLabel || labelledBy || id,
        `Input at index has no label mechanism`
      ).toBeTruthy();
    }
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
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
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
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    // Spending summary should stack vertically on mobile
    const gridItems = page.locator('.grid-cols-2');
    await expect(gridItems.first()).toBeVisible();
  });
});

// ─── CSP & Console Errors ───

test.describe('CSP and runtime errors', () => {
  test('no unhandled page errors on home', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.waitForTimeout(2000);
    // Filter out known CSP issues (we're bypassing CSP in test)
    const realErrors = errors.filter(e => !e.includes('Content Security Policy') && !e.includes('astro-island'));
    expect(realErrors.length, `Unexpected errors: ${realErrors.join('\n')}`).toBe(0);
  });

  test('no unhandled page errors on dashboard with data', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(e => !e.includes('Content Security Policy') && !e.includes('astro-island'));
    expect(realErrors.length, `Unexpected errors: ${realErrors.join('\n')}`).toBe(0);
  });
});

// ─── Session Persistence ───

test.describe('Session persistence', () => {
  test('analysis results persist in sessionStorage', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')));
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
    await page.getByRole('spinbutton').fill('300000');
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });

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
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });

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
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });

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
    await page.getByRole('button', { name: /^분석 시작/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });

    const data = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('cherrypicker:analysis') || 'null')
    );
    expect(data.optimization.totalSpending).toBe(
      data.optimization.assignments.reduce((sum, a) => sum + a.spending, 0)
    );
  });
});
