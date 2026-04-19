const path = require('node:path');
const { readFileSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const { expect, test } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');
const categories = JSON.parse(
  readFileSync(path.join(repoRoot, 'apps/web/public/data/categories.json'), 'utf8'),
).categories;

let MerchantMatcher;
let buildConstraints;
let greedyOptimize;

test.beforeAll(async () => {
  ({ MerchantMatcher } = await import(
    pathToFileURL(path.join(repoRoot, 'packages/core/dist/categorizer/matcher.js')).href
  ));
  ({ buildConstraints } = await import(
    pathToFileURL(path.join(repoRoot, 'packages/core/dist/optimizer/constraints.js')).href
  ));
  ({ greedyOptimize } = await import(
    pathToFileURL(path.join(repoRoot, 'packages/core/dist/optimizer/greedy.js')).href
  ));
});

test('merchant matcher keeps duplicate-key regressions fixed', () => {
  const matcher = new MerchantMatcher(categories);

  const vehicleTax = matcher.match('자동차세');
  const dutyFree = matcher.match('면세점');

  expect(vehicleTax.category).toBe('utilities');
  expect(vehicleTax.confidence).toBeGreaterThan(0);
  expect(dutyFree.category).toBe('offline_shopping');
  expect(dutyFree.confidence).toBeGreaterThan(0);
});

test('optimizer uses transaction-level facts and keeps card totals aligned', () => {
  const subcategoryFixture = {
    card: {
      id: 'fixture-subcategory-card',
      issuer: 'fixture',
      name: 'Fixture Subcategory Card',
      nameKo: '서브카테고리 테스트 카드',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      url: 'https://example.com/subcategory-fixture',
      lastUpdated: '2026-04-12',
      source: 'manual',
    },
    performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
    performanceExclusions: [],
    rewards: [
      {
        category: 'dining',
        type: 'discount',
        tiers: [{ performanceTier: 'tier0', rate: 2, monthlyCap: null, perTransactionCap: null }],
      },
      {
        category: 'dining',
        subcategory: 'cafe',
        type: 'discount',
        tiers: [{ performanceTier: 'tier0', rate: 5, monthlyCap: null, perTransactionCap: null }],
        conditions: { specificMerchants: ['메가커피'] },
      },
    ],
    globalConstraints: { monthlyTotalDiscountCap: null, minimumAnnualSpending: null },
  };

  const broadDiningFixture = {
    card: {
      id: 'fixture-broad-dining-card',
      issuer: 'fixture',
      name: 'Fixture Broad Dining Card',
      nameKo: '일반 외식 카드',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      url: 'https://example.com/dining-fixture',
      lastUpdated: '2026-04-12',
      source: 'manual',
    },
    performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
    performanceExclusions: [],
    rewards: [
      {
        category: 'dining',
        type: 'discount',
        tiers: [{ performanceTier: 'tier0', rate: 3, monthlyCap: null, perTransactionCap: null }],
      },
    ],
    globalConstraints: { monthlyTotalDiscountCap: null, minimumAnnualSpending: null },
  };

  const transactions = [
    {
      id: 't1',
      date: '2026-02-01',
      merchant: '메가커피 강남',
      amount: 20_000,
      currency: 'KRW',
      category: 'dining',
      subcategory: 'cafe',
      confidence: 1,
      isOnline: false,
    },
    {
      id: 't2',
      date: '2026-02-01',
      merchant: '스타벅스 강남',
      amount: 20_000,
      currency: 'KRW',
      category: 'dining',
      subcategory: 'cafe',
      confidence: 1,
      isOnline: false,
    },
  ];

  const constraints = buildConstraints(
    transactions,
    new Map([
      ['fixture-subcategory-card', 0],
      ['fixture-broad-dining-card', 0],
    ]),
  );
  const result = greedyOptimize(constraints, [subcategoryFixture, broadDiningFixture]);

  expect(result.assignments).toHaveLength(2);

  const subcategoryAssignment = result.assignments.find(
    (assignment) => assignment.assignedCardId === 'fixture-subcategory-card',
  );
  const broadAssignment = result.assignments.find(
    (assignment) => assignment.assignedCardId === 'fixture-broad-dining-card',
  );
  const subcategoryCard = result.cardResults.find(
    (cardResult) => cardResult.cardId === 'fixture-subcategory-card',
  );
  const broadCard = result.cardResults.find(
    (cardResult) => cardResult.cardId === 'fixture-broad-dining-card',
  );

  expect(subcategoryAssignment?.reward).toBe(1000);
  expect(subcategoryAssignment?.spending).toBe(20_000);
  expect(broadAssignment?.reward).toBe(600);
  expect(broadAssignment?.spending).toBe(20_000);
  expect(subcategoryCard?.totalReward).toBe(1000);
  expect(subcategoryCard?.totalSpending).toBe(20_000);
  expect(broadCard?.totalReward).toBe(600);
  expect(broadCard?.totalSpending).toBe(20_000);
  expect(result.totalReward).toBe(1600);
  expect(result.totalReward).toBe(
    result.cardResults.reduce((sum, cardResult) => sum + cardResult.totalReward, 0),
  );
});
