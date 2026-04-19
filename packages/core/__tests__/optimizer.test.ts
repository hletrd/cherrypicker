import { describe, test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import { greedyOptimize } from '../src/optimizer/greedy.js';
import { buildConstraints } from '../src/optimizer/constraints.js';
import { loadCardRule } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import type { CardRuleSet } from '@cherrypicker/rules';

// NOTE: Reward rate values in test fixtures use percentage form
// (e.g., rate: 2 means 2%, rate: 5 means 5%) matching YAML convention.
// calculateRewards() normalizes these via normalizeRate (divides by 100).

const rulesDir = join(import.meta.dir, '../../../packages/rules/data/cards');

let simplePlan: CardRuleSet;
let mrLife: CardRuleSet;
let kbMinCheck: CardRuleSet;

beforeAll(async () => {
  simplePlan = await loadCardRule(join(rulesDir, 'shinhan/simple-plan.yaml'));
  mrLife = await loadCardRule(join(rulesDir, 'shinhan/mr-life.yaml'));
  kbMinCheck = await loadCardRule(join(rulesDir, 'kb/min-check.yaml'));
});

function makeTx(
  id: string,
  category: string,
  amount: number,
  merchant = category,
  isOnline = false,
  subcategory?: string,
): CategorizedTransaction {
  return {
    id,
    date: '2026-02-01',
    merchant,
    amount,
    currency: 'KRW',
    category,
    subcategory,
    confidence: 1.0,
    isOnline,
  };
}

const subcategoryFixture: CardRuleSet = {
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
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

const broadDiningFixture: CardRuleSet = {
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
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

function makeConstraints(
  transactions: CategorizedTransaction[],
  previousMonthSpending: Map<string, number>,
) {
  return buildConstraints(transactions, previousMonthSpending);
}

describe('greedyOptimize - basic', () => {
  test('returns result with assignments array', () => {
    const constraints = makeConstraints([makeTx('t1', 'uncategorized', 100000)], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    expect(result.assignments).toBeDefined();
    expect(Array.isArray(result.assignments)).toBe(true);
  });

  test('single card — all categories assigned to it', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'uncategorized', 50000),
      makeTx('t2', 'dining', 30000),
    ], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    for (const assignment of result.assignments) {
      expect(assignment.assignedCardId).toBe('shinhan-simple-plan');
    }
  });

  test('totalSpending equals sum of categorySpending values', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'uncategorized', 50000),
      makeTx('t2', 'dining', 30000),
    ], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    expect(result.totalSpending).toBe(80000);
  });

  test('totalReward equals sum of assignment rewards', () => {
    const constraints = makeConstraints([makeTx('t1', 'uncategorized', 100000)], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    const sumRewards = result.assignments.reduce((s, a) => s + a.reward, 0);
    expect(result.totalReward).toBe(sumRewards);
  });

  test('effectiveRate = totalReward / totalSpending', () => {
    const constraints = makeConstraints([makeTx('t1', 'uncategorized', 100000)], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    const expectedRate = result.totalSpending > 0
      ? result.totalReward / result.totalSpending
      : 0;
    expect(result.effectiveRate).toBeCloseTo(expectedRate, 10);
  });

  test('categories with zero spending are skipped', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'uncategorized', 100000),
      makeTx('t2', 'dining', 0),
    ], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    const diningAssignment = result.assignments.find((a) => a.category === 'dining');
    expect(diningAssignment).toBeUndefined();
  });
});

describe('greedyOptimize - two cards', () => {
  test('each category gets assigned to one card', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'convenience_store', 50000),
      makeTx('t2', 'uncategorized', 100000),
    ], new Map([
      ['shinhan-simple-plan', 0],
      ['shinhan-mr-life', 500000],
    ]));
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    expect(result.assignments).toHaveLength(2);
    for (const a of result.assignments) {
      expect(['shinhan-simple-plan', 'shinhan-mr-life']).toContain(a.assignedCardId);
    }
  });

  test('alternatives array contains the non-chosen card', () => {
    const constraints = makeConstraints([makeTx('t1', 'convenience_store', 50000)], new Map([
      ['shinhan-simple-plan', 0],
      ['shinhan-mr-life', 500000],
    ]));
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    const assignment = result.assignments[0];
    expect(assignment?.alternatives).toHaveLength(1);
  });

  test('cardResults contains entries for cards that have assignments', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'convenience_store', 50000),
      makeTx('t2', 'uncategorized', 100000),
    ], new Map([
      ['shinhan-simple-plan', 0],
      ['shinhan-mr-life', 500000],
    ]));
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    // All assigned cards should appear in cardResults
    const assignedCardIds = new Set(result.assignments.map((a) => a.assignedCardId));
    const cardResultIds = new Set(result.cardResults.map((r) => r.cardId));
    for (const id of assignedCardIds) {
      expect(cardResultIds.has(id)).toBe(true);
    }
  });

  test('savingsVsSingleCard = totalReward - bestSingleCard.totalReward', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'convenience_store', 100000),
      makeTx('t2', 'uncategorized', 100000),
    ], new Map([
      ['shinhan-simple-plan', 0],
      ['shinhan-mr-life', 1000000],
    ]));
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    const expected = result.totalReward - result.bestSingleCard.totalReward;
    expect(result.savingsVsSingleCard).toBeCloseTo(expected, 0);
  });

  test('bestSingleCard has a non-empty cardId', () => {
    const constraints = makeConstraints([makeTx('t1', 'uncategorized', 100000)], new Map([
      ['shinhan-simple-plan', 0],
      ['shinhan-mr-life', 500000],
    ]));
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    expect(result.bestSingleCard.cardId).toBeTruthy();
  });
});

describe('buildConstraints', () => {
  test('aggregates spending by category', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('t1', 'dining', 10000),
      makeTx('t2', 'dining', 20000),
      makeTx('t3', 'grocery', 50000),
    ];
    const prevSpending = new Map([['shinhan-simple-plan', 300000]]);
    const constraints = buildConstraints(txs, prevSpending);
    expect(constraints.categorySpending.get('dining')).toBe(30000);
    expect(constraints.categorySpending.get('grocery')).toBe(50000);
  });

  test('builds cards array from previousSpending map', () => {
    const txs: CategorizedTransaction[] = [makeTx('t1', 'dining', 10000)];
    const prevSpending = new Map([
      ['shinhan-simple-plan', 300000],
      ['shinhan-mr-life', 500000],
    ]);
    const constraints = buildConstraints(txs, prevSpending);
    expect(constraints.cards).toHaveLength(2);
    const simplePlanCard = constraints.cards.find((c) => c.cardId === 'shinhan-simple-plan');
    expect(simplePlanCard?.previousMonthSpending).toBe(300000);
  });

  test('preserves original transactions for transaction-aware scoring', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('t1', 'dining', 12000, '메가커피 강남', false, 'cafe'),
      makeTx('t2', 'dining', 18000, '스타벅스 강남', false, 'cafe'),
    ];
    const constraints = buildConstraints(txs, new Map([['fixture-subcategory-card', 0]]));
    expect(constraints.transactions).toEqual(txs);
  });

  test('transaction-level merchant and subcategory conditions change assignment decisions', () => {
    const transactions: CategorizedTransaction[] = [
      makeTx('t1', 'dining', 20000, '메가커피 강남', false, 'cafe'),
      makeTx('t2', 'dining', 20000, '스타벅스 강남', false, 'cafe'),
    ];
    const constraints = makeConstraints(transactions, new Map([
      ['fixture-subcategory-card', 0],
      ['fixture-broad-dining-card', 0],
    ]));

    const result = greedyOptimize(constraints, [subcategoryFixture, broadDiningFixture]);

    expect(result.assignments).toHaveLength(2);
    const subcategoryAssignment = result.assignments.find((assignment) => assignment.assignedCardId === 'fixture-subcategory-card');
    const broadAssignment = result.assignments.find((assignment) => assignment.assignedCardId === 'fixture-broad-dining-card');

    expect(subcategoryAssignment?.reward).toBe(1000);
    expect(subcategoryAssignment?.spending).toBe(20000);
    expect(broadAssignment?.reward).toBe(600);
    expect(broadAssignment?.spending).toBe(20000);
    expect(result.totalReward).toBe(1600);
  });

  test('card totals stay aligned with calculator outputs for assigned transactions', () => {
    const transactions: CategorizedTransaction[] = [
      makeTx('t1', 'telecom', 55000, 'SKT'),
      makeTx('t2', 'uncategorized', 100000, '기타'),
    ];
    const constraints = makeConstraints(transactions, new Map([
      ['kb-min-check', 300000],
      ['shinhan-simple-plan', 0],
    ]));

    const result = greedyOptimize(constraints, [kbMinCheck, simplePlan]);
    const telecomCard = result.cardResults.find((cardResult) => cardResult.cardId === 'kb-min-check');
    const simplePlanCard = result.cardResults.find((cardResult) => cardResult.cardId === 'shinhan-simple-plan');

    expect(telecomCard?.totalReward).toBe(2500);
    expect(telecomCard?.totalSpending).toBe(55000);
    expect(simplePlanCard?.totalReward).toBe(1000);
    expect(simplePlanCard?.totalSpending).toBe(100000);
    expect(result.totalReward).toBe(3500);
    expect(result.totalReward).toBe(result.cardResults.reduce((sum, cardResult) => sum + cardResult.totalReward, 0));
  });
});
