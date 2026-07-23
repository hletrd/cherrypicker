const { readFileSync } = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');

const SAFE_FALLBACK_BASE_URL = 'http://127.0.0.1:4173/cherrypicker/';
const normalFixture = path.join(__dirname, 'fixtures', 'regression-upload.csv');
const partialWarningFixture = path.join(
  __dirname,
  'fixtures',
  'partial-warning-upload.csv',
);
const normalFixtureContents = readFileSync(normalFixture, 'utf8');
const publishedSummary = JSON.parse(
  readFileSync(
    path.join(__dirname, '../apps/web/public/data/cards-summary.json'),
    'utf8',
  ),
);
const longKoreanName =
  '일상 생활비부터 온라인 쇼핑과 대중교통까지 차곡차곡 혜택을 받는 초장문 테스트 카드';

function appUrl(relativePath = '') {
  const base = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? SAFE_FALLBACK_BASE_URL,
  );
  base.search = '';
  base.hash = '';
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(relativePath.replace(/^\/+/, ''), base).toString();
}

async function waitForIsland(page) {
  await page.waitForFunction(() =>
    Boolean(document.querySelector('astro-island:not([ssr])')),
  );
}

async function analyze(page, fixture = normalFixture) {
  await page.goto(appUrl());
  await waitForIsland(page);
  await page.getByLabel('파일 선택', { exact: true }).setInputFiles(fixture);
  await page
    .getByLabel('전월 카드 이용액', { exact: true })
    .fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(page.locator('#dashboard-data-content')).toBeVisible();
}

async function resolveCssColors(page, values) {
  return page.evaluate((colors) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context is unavailable');

    return colors.map((color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha / 255];
    });
  }, values);
}

function composite(foreground, background) {
  const alpha = foreground[3];
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
    1,
  ];
}

function luminance(color) {
  const channels = color.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722
  );
}

function contrastRatio(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectOpaqueContrast(page, locator, minimum = 4.5) {
  await expect(locator).toBeVisible();
  const pair = await locator.evaluate((element) => {
    const foreground = getComputedStyle(element).color;
    let current = element;
    while (current instanceof HTMLElement) {
      const background = getComputedStyle(current).backgroundColor;
      const alpha = background.startsWith('rgb(')
        ? 1
        : Number(background.match(/,\s*([\d.]+)\s*\)$/)?.[1] ?? 0);
      if (alpha === 1) return { foreground, background };
      current = current.parentElement;
    }
    return {
      foreground,
      background: getComputedStyle(document.body).backgroundColor,
    };
  });
  const [foreground, background] = await resolveCssColors(page, [
    pair.foreground,
    pair.background,
  ]);
  expect(
    contrastRatio(foreground, background),
  ).toBeGreaterThanOrEqual(minimum);
}

test('native upload accepts one page-wide drop, exposes labels/formats, and resolves the favicon', async ({
  page,
  request,
}) => {
  await page.goto(appUrl());
  await waitForIsland(page);

  const region = page.getByRole('region', { name: '카드 명세서 업로드' });
  const fileInput = page.getByLabel('파일 선택', { exact: true });
  await expect(fileInput).toHaveAttribute(
    'accept',
    '.csv,.tsv,.xlsx,.xls,.pdf,.json,.ofx,.qfx,.html,.htm',
  );
  await expect(
    page.getByText(
      'CSV/TSV, Excel, PDF, JSON, OFX/QFX, HTML 지원 · 여러 파일 동시 업로드 가능',
      { exact: true },
    ),
  ).toBeVisible();

  await region.evaluate(
    (target, contents) => {
      const data = new DataTransfer();
      data.items.add(
        new File([contents], 'single-page-drop.csv', { type: 'text/csv' }),
      );
      target.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: data,
        }),
      );
    },
    normalFixtureContents,
  );

  await expect(
    page.getByText('single-page-drop.csv', { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: 'single-page-drop.csv 제거',
      exact: true,
    }),
  ).toBeVisible();

  const faviconHref = await page
    .locator('link[rel="icon"]')
    .getAttribute('href');
  expect(faviconHref).toBeTruthy();
  const favicon = await request.get(new URL(faviconHref, page.url()).toString());
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()['content-type']).toMatch(/^image\/svg\+xml\b/i);
});

test('out-of-range previous spending stays on the form with an associated Korean error', async ({
  page,
}) => {
  await page.goto(appUrl());
  await waitForIsland(page);
  await page
    .getByLabel('파일 선택', { exact: true })
    .setInputFiles(normalFixture);

  const input = page.getByLabel('전월 카드 이용액', { exact: true });
  await input.fill('20000000000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();

  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute(
    'aria-describedby',
    /previous-spending-error/,
  );
  await expect(
    page.getByRole('alert').getByText(
      '전월 카드 이용액은 100억원 이하로 입력해 주세요.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(appUrl());
});

test('partial analysis warnings retain filename/count across result routes and restoration', async ({
  page,
}) => {
  await analyze(page, partialWarningFixture);

  const warningHeading = page.getByRole('heading', {
    name: '분석 완료 — 확인할 항목 있음',
  });
  await expect(warningHeading).toBeVisible();
  await expect(page.getByText(/1개 파일에서 1개 항목을 읽지 못했어요/)).toBeVisible();
  const details = page.locator(
    'button[aria-controls="analysis-warning-details"]',
  );
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  await details.click();
  await expect(details).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/partial-warning-upload\.csv/)).toBeVisible();
  await expect(page.getByText(/3행/)).toBeVisible();
  await expectOpaqueContrast(page, warningHeading);

  await page.goto(appUrl('results'));
  await expect(warningHeading).toBeVisible();
  await expect(page.getByText(/partial-warning-upload\.csv/)).toBeHidden();
  await page.getByRole('button', { name: '세부 내용 보기' }).click();
  await expect(page.getByText(/partial-warning-upload\.csv/)).toBeVisible();

  await page.goto(appUrl('report'));
  await expect(warningHeading).toBeVisible();
  await page.reload();
  await expect(warningHeading).toBeVisible();
  await page.getByRole('button', { name: '세부 내용 보기' }).click();
  await expect(page.getByText(/partial-warning-upload\.csv/)).toBeVisible();
});

test('card loader exposes a retry without reload and preserves filter/current-page ARIA', async ({
  page,
}) => {
  const summaryWithLongName = structuredClone(publishedSummary);
  summaryWithLongName.cards[0].nameKo = longKoreanName;
  let attempts = 0;
  let mainFrameNavigations = 0;

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations += 1;
  });
  await page.route(/\/data\/cards-summary\.json$/, (route) => {
    attempts += 1;
    if (attempts === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'temporary' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(summaryWithLongName),
    });
  });

  await page.goto(appUrl('cards'));
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('카드 목록 데이터를 불러올 수 없어요');
  await expectOpaqueContrast(page, alert.getByText(/카드 목록 데이터를/));
  const navigationsBeforeRetry = mainFrameNavigations;
  const urlBeforeRetry = page.url();

  await alert.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByTestId('card-grid-page')).toBeVisible();
  expect(attempts).toBe(2);
  expect(mainFrameNavigations).toBe(navigationsBeforeRetry);
  expect(page.url()).toBe(urlBeforeRetry);

  const search = page.getByLabel('카드 검색', { exact: true });
  await search.fill('초장문 테스트 카드');
  const longName = page.getByText(longKoreanName, { exact: true });
  await expect(longName).toBeVisible();
  const wrapping = await longName.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      wordBreak: style.wordBreak,
      overflowWrap: style.overflowWrap,
      width: element.getBoundingClientRect().width,
      parentWidth: element.parentElement.getBoundingClientRect().width,
    };
  });
  expect(wrapping.wordBreak).toBe('keep-all');
  expect(wrapping.overflowWrap).toBe('anywhere');
  expect(wrapping.width).toBeLessThanOrEqual(wrapping.parentWidth);
  await search.fill('');

  const pageTwo = page.getByRole('button', {
    name: '2페이지',
    exact: true,
  });
  await pageTwo.click();
  await expect(pageTwo).toHaveAttribute('aria-current', 'page');

  const typeGroup = page.getByRole('group', {
    name: '카드 종류',
    exact: true,
  });
  const credit = typeGroup.getByRole('button', {
    name: '신용카드',
    exact: true,
  });
  await credit.click();
  await expect(credit).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: '1페이지', exact: true }),
  ).toHaveAttribute('aria-current', 'page');

  const issuerButtons = page
    .getByRole('group', { name: '카드사', exact: true })
    .getByRole('button');
  const firstIssuer = issuerButtons.nth(1);
  await firstIssuer.click();
  await expect(firstIssuer).toHaveAttribute('aria-pressed', 'true');

  const sort = page.getByLabel('정렬', { exact: true });
  await sort.selectOption('fee-desc');
  await expect(sort).toHaveValue('fee-desc');
  await expect(
    page.locator('nav a[aria-current="page"]').filter({
      hasText: '카드 목록',
    }).first(),
  ).toBeVisible();
  await expectOpaqueContrast(page, page.getByTestId('issuer-badge').first());
});

test('desktop recommendations retain native table semantics and keyboard disclosure state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await analyze(page);

  const table = page.getByTestId('optimal-card-table');
  await expect(table).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: '카테고리', exact: true }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: '추천 카드', exact: true }),
  ).toBeVisible();
  const firstDataRow = table.locator('tbody > tr').first();
  expect(await firstDataRow.getAttribute('role')).toBeNull();

  const disclosure = table
    .locator('button[aria-controls^="desktop-alternatives-"]')
    .first();
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  await disclosure.press('Space');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await disclosure.press('Enter');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(disclosure).toBeFocused();

  const categoryDisclosure = page
    .getByRole('button', { name: /상세 정보$/ })
    .first();
  await categoryDisclosure.focus();
  await expect(categoryDisclosure).toHaveAttribute('aria-expanded', 'true');
  await categoryDisclosure.press('Enter');
  await expect(categoryDisclosure).toHaveAttribute('aria-expanded', 'false');
  await categoryDisclosure.press('Enter');
  await expect(categoryDisclosure).toHaveAttribute('aria-expanded', 'true');

  const sortGroup = page.getByRole('group', {
    name: '추천 카드 정렬',
    exact: true,
  });
  const rewardSort = sortGroup.getByRole('button', {
    name: '혜택액순',
    exact: true,
  });
  await rewardSort.click();
  await expect(rewardSort).toHaveAttribute('aria-pressed', 'true');
});

for (const width of [320, 375, 400]) {
  test(`mobile recommendation geometry stays usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await analyze(page);
    await expect(
      page.getByTestId('category-bar-track').first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('single-card-bar-track'),
    ).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: '추천 카드 정렬', exact: true })
        .getByRole('button')
        .first(),
    ).toBeVisible();

    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      categoryTracks: Array.from(
        document.querySelectorAll('[data-testid="category-bar-track"]'),
        (element) => element.getBoundingClientRect().width,
      ),
      savingsTracks: Array.from(
        document.querySelectorAll(
          '[data-testid="single-card-bar-track"], [data-testid="cherrypick-bar-track"]',
        ),
        (element) => element.getBoundingClientRect().width,
      ),
      actionTargets: Array.from(
        document.querySelectorAll(
          '[data-testid="optimal-card-mobile-list"] button, [role="group"][aria-label="추천 카드 정렬"] button',
        ),
        (element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        },
      ),
    }));

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.categoryTracks.length).toBeGreaterThan(0);
    for (const trackWidth of geometry.categoryTracks) {
      expect(trackWidth).toBeGreaterThanOrEqual(120);
    }
    expect(geometry.savingsTracks.length).toBeGreaterThan(0);
    for (const trackWidth of geometry.savingsTracks) {
      expect(trackWidth).toBeGreaterThanOrEqual(120);
    }
    expect(geometry.actionTargets.length).toBeGreaterThan(0);
    for (const target of geometry.actionTargets) {
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByTestId('optimal-card-mobile-list')).toBeVisible();
    await expect(page.getByTestId('optimal-card-table')).toBeHidden();
  });
}

test('mobile menu keyboard flow returns focus and reduced motion disables smooth card scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.__plan70ScrollCalls = [];
    window.scrollTo = (options) => {
      window.__plan70ScrollCalls.push(options);
    };
  });
  await page.goto(appUrl('cards'));
  await expect(page.getByTestId('card-grid-page')).toBeVisible();
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
  ).toBe('auto');

  const trigger = page.locator('#mobile-menu-btn');
  await expect(trigger).toHaveAttribute('aria-label', '메뉴 열기');
  await trigger.focus();
  await trigger.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAttribute('aria-controls', 'mobile-menu');

  const menu = page.locator('#mobile-menu');
  const currentLink = menu.getByRole('link', {
    name: '카드 목록',
    exact: true,
  });
  await expect(currentLink).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Tab');
  await expect(
    menu.getByRole('link', { name: '홈', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();

  const firstCard = page.getByTestId('card-grid-card').first();
  await firstCard.focus();
  await firstCard.press('Enter');
  await expect(page.getByText('목록으로').first()).toBeVisible();
  const scrollCalls = await page.evaluate(() => window.__plan70ScrollCalls);
  expect(scrollCalls.at(-1)).toMatchObject({ top: 0, behavior: 'auto' });
});

test('computed hero, theme, status, and issuer pairs meet WCAG AA', async ({
  page,
}) => {
  await page.goto(appUrl());
  const heroPairs = await page
    .locator('[data-testid="hero-subtitle"], [data-testid="hero-privacy"]')
    .evaluateAll((elements) =>
      elements.map((element) => {
        let gradient = 'none';
        let current = element.parentElement;
        while (current) {
          const candidate = getComputedStyle(current).backgroundImage;
          if (candidate !== 'none') {
            gradient = candidate;
            break;
          }
          current = current.parentElement;
        }
        return {
          foreground: getComputedStyle(element).color,
          overlay: getComputedStyle(element).backgroundColor,
          gradient,
        };
      }),
    );

  expect(heroPairs).toHaveLength(2);
  for (const pair of heroPairs) {
    const stopTokens = [
      ...pair.gradient.matchAll(
        /(?:rgba?|hsla?|oklab|oklch|lab|lch|color)\([^)]*\)/gi,
      ),
    ].map(
      (match) => match[0],
    );
    const [foreground, overlay, ...stops] = await resolveCssColors(page, [
      pair.foreground,
      pair.overlay,
      ...stopTokens,
    ]);
    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const stop of stops) {
      expect(contrastRatio(foreground, composite(overlay, stop))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  }

  const footerText = page.locator('footer').getByText(/© 2026/);
  for (const dark of [false, true]) {
    await page.evaluate((enabled) => {
      document.documentElement.classList.toggle('dark', enabled);
    }, dark);
    await expectOpaqueContrast(page, footerText);
  }

  await page.goto(appUrl('cards'));
  await expect(page.getByTestId('card-grid-page')).toBeVisible();
  await expectOpaqueContrast(page, page.getByTestId('issuer-badge').first());
});

test('light/dark print preparation and narrow report alternatives preserve dense values', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await analyze(page);
  await page.goto(appUrl('results'));
  await expect(page.locator('#results-data-content')).toBeVisible();
  await page.evaluate(() => {
    window.print = () => {
      window.__plan70PrintCalls = (window.__plan70PrintCalls ?? 0) + 1;
    };
    document.documentElement.classList.remove('dark');
  });

  await page
    .getByRole('button', { name: '인쇄 / PDF 저장', exact: true })
    .click();
  await expect(page.locator('html')).toHaveClass(/print-mode/);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('optimal-card-table')).toBeVisible();
  await expect(page.getByTestId('optimal-card-mobile-list')).toBeHidden();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe('rgb(255, 255, 255)');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('html')).not.toHaveClass(/print-mode/);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.emulateMedia({ media: 'screen' });

  await page.goto(appUrl('report'));
  await expect(page.locator('#report-data-content')).toBeVisible();
  await expect(page.getByTestId('report-assignments-mobile')).toBeVisible();
  await expect(page.getByTestId('report-assignments-table')).toBeHidden();
  const reportGeometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    values: Array.from(
      document.querySelectorAll(
        '[data-testid="report-assignments-mobile"] dd, [data-testid="report-card-breakdown-mobile"] dd',
      ),
      (element) => ({
        text: element.textContent?.trim(),
        right: element.getBoundingClientRect().right,
      }),
    ),
  }));
  expect(reportGeometry.documentWidth).toBeLessThanOrEqual(
    reportGeometry.viewport,
  );
  expect(reportGeometry.values.length).toBeGreaterThan(0);
  for (const value of reportGeometry.values) {
    expect(value.text).toBeTruthy();
    expect(value.right).toBeLessThanOrEqual(reportGeometry.viewport);
  }

  await page.evaluate(() => {
    window.print = () => {
      window.__plan70PrintCalls = (window.__plan70PrintCalls ?? 0) + 1;
    };
    document.documentElement.classList.add('dark');
  });
  await page
    .getByRole('button', { name: '인쇄 / PDF 저장', exact: true })
    .click();
  await expect(page.locator('html')).toHaveClass(/print-mode/);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('report-assignments-table')).toBeVisible();
  await expect(page.getByTestId('report-card-breakdown-table')).toBeVisible();
  await expect(page.getByTestId('report-assignments-mobile')).toBeHidden();
  await expect(page.getByTestId('report-card-breakdown-mobile')).toBeHidden();
  expect(
    await page
      .locator('#report-data-content > div')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe('rgb(255, 255, 255)');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('html')).not.toHaveClass(/print-mode/);
});

test('card reward table exposes a labeled, keyboard-focusable scroll region without clipping the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(appUrl('cards#shinhan-11st'));

  const region = page.getByTestId('card-rewards-scroll-region');
  await expect(region).toBeVisible();
  await expect(region).toHaveAttribute(
    'aria-label',
    '카테고리별 카드 혜택 표',
  );
  await expect(region).toHaveAttribute('tabindex', '0');
  await region.focus();
  await expect(region).toBeFocused();
  await expect(
    region.getByRole('columnheader', { name: '혜택', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('표를 좌우로 스크롤할 수 있어요', { exact: true }),
  ).toBeVisible();

  const geometry = await region.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
});
