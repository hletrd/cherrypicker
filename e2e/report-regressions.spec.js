const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { expect, test } = require('@playwright/test');

const optimization = {
  assignments: [
    {
      category: 'uncategorized',
      categoryNameKo: '미분류',
      assignedCardId: 'simple-plan',
      assignedCardName: '심플플랜',
      spending: 100000,
      reward: 1000,
      rate: 0.01,
      alternatives: [],
    },
  ],
  totalReward: 1000,
  totalSpending: 100000,
  effectiveRate: 0.01,
  savingsVsSingleCard: 0,
  bestSingleCard: {
    cardId: 'simple-plan',
    cardName: '심플플랜',
    totalReward: 1000,
  },
  cardResults: [
    {
      cardId: 'simple-plan',
      cardName: '심플플랜',
      totalReward: 1000,
      totalSpending: 100000,
      effectiveRate: 0.01,
      byCategory: [],
      performanceTier: 'tier0',
      capsHit: [],
    },
  ],
};
const transactions = [
  {
    id: 't1',
    date: '2026-02-01',
    merchant: '테스트 매장',
    amount: 100000,
    currency: 'KRW',
    category: 'uncategorized',
    confidence: 1,
  },
];
let reportHtml;

test.beforeAll(async () => {
  const generatorUrl = pathToFileURL(
    path.join(__dirname, '../packages/viz/src/report/generator.ts'),
  ).href;
  const { generateHTMLReport } = await import(generatorUrl);
  reportHtml = generateHTMLReport(
    optimization,
    transactions,
    new Map([['uncategorized', '미분류']]),
    {
      latestStatementPeriod: {
        start: '2026-02-01',
        end: '2026-02-01',
      },
      fullStatementPeriod: {
        start: '2026-02-01',
        end: '2026-02-01',
      },
      latestTransactionCount: 1,
      fullTransactionCount: 1,
      parserExclusions: [],
      calendarExclusions: [],
      previousSpendingBasis: {
        kind: 'missing-calendar-month',
        month: '2026-01',
        assumedAmount: 0,
      },
      unsupportedIssues: [],
    },
  );
});

test('C2-023 activates the hash-authorized report stylesheet', async ({
  page,
}) => {
  await page.setContent(reportHtml, { waitUntil: 'load' });

  await expect(page).toHaveTitle('CherryPicker 분석 보고서');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'CherryPicker 분석 보고서',
    }),
  ).toBeVisible();
  await expect(page.locator('style')).toHaveCount(1);
  expect(
    await page.evaluate(() => document.styleSheets.length),
  ).toBe(1);
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(248, 250, 252)',
  );
  await expect(page.locator('body')).toHaveCSS('padding-top', '32px');
  await expect(page.locator('body')).toHaveCSS('padding-left', '16px');
  await expect(page.locator('.metrics-grid')).toHaveCSS('display', 'grid');
  await expect(page.locator('.section').first()).toHaveCSS(
    'border-top-style',
    'solid',
  );
  await expect(page.locator('table').first()).toHaveCSS(
    'border-collapse',
    'collapse',
  );
  await expect(page.locator('script')).toHaveCount(0);
});

test('C2-023 rejects modified inline styles and all scripts', async ({
  page,
}) => {
  const tampered = reportHtml
    .replace('--color-bg: #f8fafc;', '--color-bg: #000000;')
    .replace(
      '</body>',
      '<script>window.__reportScriptRan = true;</script></body>',
    );

  await page.setContent(tampered, { waitUntil: 'load' });

  const state = await page.evaluate(() => ({
    styleSheetCount: document.styleSheets.length,
    scriptRan: window.__reportScriptRan === true,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  }));
  expect(state).toEqual({
    styleSheetCount: 0,
    scriptRan: false,
    bodyBackground: 'rgba(0, 0, 0, 0)',
  });
});
