import { describe, test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import { greedyOptimize } from '../src/optimizer/greedy.js';
import { buildConstraints } from '../src/optimizer/constraints.js';
import { loadCardRule } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import type { CardRuleSet } from '@cherrypicker/rules';

// NOTE: Reward rate values in test fixtures use percentage form
// (e.g., rate: 2 means 2%, rate: 5 means 5%) matching YAML convention.
// calculateRewards() evaluates the authored percentage points exactly.

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
  subcategory?: string,
): CategorizedTransaction {
  return {
    id,
    date: '2026-02-01',
    merchant,
    amount,
    currency: 'KRW',
    paymentType: 'domestic',
    factProvenance: { paymentType: 'statement' },
    category,
    subcategory,
    confidence: 1.0,
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
      support: { status: 'supported' },
      tiers: [{ performanceTier: 'tier0', rate: 2, monthlyCap: null, perTransactionCap: null }],
    },
    {
      category: 'dining',
      subcategory: 'cafe',
      type: 'discount',
      support: { status: 'supported' },
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
      support: { status: 'supported' },
      tiers: [{ performanceTier: 'tier0', rate: 3, monthlyCap: null, perTransactionCap: null }],
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

const DEFAULT_CATEGORY_LABELS = new Map<string, string>([
  ['uncategorized', '미분류'],
  ['dining', '외식'],
  ['cafe', '카페'],
  ['convenience_store', '편의점'],
  ['entertainment', '엔터테인먼트'],
  ['telecom', '통신'],
  ['dining.cafe', '카페'],
]);

function makeConstraints(
  transactions: CategorizedTransaction[],
  previousMonthSpending: Map<string, number>,
  categoryLabels: Map<string, string> = DEFAULT_CATEGORY_LABELS,
) {
  return buildConstraints(transactions, previousMonthSpending, categoryLabels);
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

  test('totalSpending equals sum of transaction amounts', () => {
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

  test('alternatives omit a non-chosen card with no positive modeled benefit', () => {
    const constraints = makeConstraints([makeTx('t1', 'convenience_store', 50000)], new Map([
      ['shinhan-simple-plan', 0],
      ['shinhan-mr-life', 500000],
    ]));
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    const assignment = result.assignments[0];
    expect(assignment?.alternatives).toEqual([]);
  });

  test('retains unsupported issues from a losing candidate card', () => {
    const constraints = makeConstraints(
      [makeTx('t1', 'convenience_store', 50000, 'CU 강남점')],
      new Map([
        ['shinhan-simple-plan', 0],
        ['shinhan-mr-life', 500000],
      ]),
    );

    const result = greedyOptimize(constraints, [simplePlan, mrLife]);

    expect(result.assignments[0]?.assignedCardId).toBe('shinhan-simple-plan');
    expect(result.cardResults.some((card) => card.cardId === 'shinhan-mr-life')).toBe(false);
    expect(result.unsupportedRules).toContainEqual(
      expect.objectContaining({
        cardId: 'shinhan-mr-life',
        transactionId: 't1',
        ruleId: 'reward-003',
        category: 'convenience_store',
        reason: 'rule_marked_unsupported',
      }),
    );
  });

  test('keeps identical rule IDs from different cards as distinct issues', () => {
    const firstCard = structuredClone(mrLife);
    const secondCard = structuredClone(mrLife);
    firstCard.card.id = 'unsupported-card-a';
    secondCard.card.id = 'unsupported-card-b';
    const constraints = makeConstraints(
      [makeTx('t1', 'convenience_store', 50_000, 'CU 강남점')],
      new Map([
        [firstCard.card.id, 500_000],
        [secondCard.card.id, 500_000],
      ]),
    );

    const result = greedyOptimize(constraints, [firstCard, secondCard]);
    const sharedRuleIssues = (result.unsupportedRules ?? []).filter(
      (issue) => issue.ruleId === 'reward-003',
    );

    expect(sharedRuleIssues).toHaveLength(2);
    expect(sharedRuleIssues.map((issue) => issue.cardId).sort()).toEqual([
      'unsupported-card-a',
      'unsupported-card-b',
    ]);
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

describe('greedyOptimize - edge cases', () => {
  test('transactions with negative amounts are skipped', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'uncategorized', 100000),
      makeTx('t2', 'uncategorized', -50000),
    ], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    // Only the positive transaction should be assigned
    expect(result.totalSpending).toBe(100000);
  });

  test('transactions with zero amounts are skipped', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'uncategorized', 100000),
      makeTx('t2', 'dining', 0),
    ], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    const diningAssignment = result.assignments.find((a) => a.category === 'dining');
    expect(diningAssignment).toBeUndefined();
    expect(result.totalSpending).toBe(100000);
  });

  test('non-KRW rows are excluded from every optimizer spending view', () => {
    const krw = makeTx('krw', 'uncategorized', 10_000);
    const usd = {
      ...makeTx('usd', 'uncategorized', 90_000),
      currency: 'USD',
    };
    const constraints = makeConstraints(
      [krw, usd],
      new Map([['shinhan-simple-plan', 0]]),
    );

    const result = greedyOptimize(constraints, [simplePlan]);
    const assignmentSpending = result.assignments.reduce(
      (sum, assignment) => sum + assignment.spending,
      0,
    );
    const cardResultSpending = result.cardResults.reduce(
      (sum, card) => sum + card.totalSpending,
      0,
    );

    expect(result.totalSpending).toBe(10_000);
    expect(result.unassignedSpending).toBe(0);
    expect(result.unassignedTransactionCount).toBe(0);
    expect(assignmentSpending + result.unassignedSpending).toBe(
      result.totalSpending,
    );
    expect(cardResultSpending + result.unassignedSpending).toBe(
      result.totalSpending,
    );
  });

  test('all-merchant wildcard rewards a categorized transaction', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'dining', 50000),
    ], new Map([['shinhan-simple-plan', 0]]));
    const result = greedyOptimize(constraints, [simplePlan]);
    const dining = result.assignments.find((a) => a.category === 'dining');
    expect(dining).toBeDefined();
    expect(dining!.reward).toBe(500);
  });

  test('a supported card with no matching benefit leaves spending unassigned', () => {
    // mr-life has no tier0 reward for entertainment.
    const constraints = makeConstraints([
      makeTx('t1', 'entertainment', 50000),
    ], new Map([['shinhan-mr-life', 0]]));
    const result = greedyOptimize(constraints, [mrLife]);
    expect(result.assignments).toEqual([]);
    expect(result.totalReward).toBe(0);
    expect(result.totalSpending).toBe(50_000);
    expect(result.unassignedSpending).toBe(50_000);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(result.effectiveRate).toBe(0);
    expect(result.bestSingleCard).toBeNull();
    expect(result.savingsVsSingleCard).toBe(0);
    expect(result.cardResults).toEqual([]);
  });

  test('zero-reward ties do not manufacture an ASCII card recommendation', () => {
    const first = structuredClone(mrLife);
    const second = structuredClone(mrLife);
    first.card.id = 'zero-z';
    first.card.nameKo = 'Z 카드';
    second.card.id = 'zero-a';
    second.card.nameKo = 'A 카드';
    const constraints = makeConstraints(
      [makeTx('t1', 'entertainment', 50_000)],
      new Map([
        [first.card.id, 0],
        [second.card.id, 0],
      ]),
    );

    const result = greedyOptimize(constraints, [first, second]);
    expect(result.totalReward).toBe(0);
    expect(result.bestSingleCard).toBeNull();
    expect(result.assignments).toEqual([]);
    expect(result.unassignedSpending).toBe(50_000);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(greedyOptimize(constraints, [second, first])).toEqual(result);
  });

  test('discontinued cards cannot enter recommendation results', () => {
    const discontinued = structuredClone(simplePlan);
    discontinued.card.id = 'a-discontinued';
    discontinued.card.discontinued = true;
    discontinued.rewards[0]!.tiers[0]!.rate = 100;
    discontinued.rewards[0]!.tiers[0]!.value = {
      kind: 'percentage',
      amount: 100,
    };
    const constraints = makeConstraints(
      [makeTx('t1', 'uncategorized', 10_000)],
      new Map([
        [discontinued.card.id, Number.NaN],
        [simplePlan.card.id, 0],
      ]),
    );

    const result = greedyOptimize(
      constraints,
      [discontinued, simplePlan],
    );

    expect(result.assignments[0]?.assignedCardId).toBe(simplePlan.card.id);
    expect(result.bestSingleCard?.cardId).toBe(simplePlan.card.id);
    expect(result.cardResults.map((card) => card.cardId)).not.toContain(
      discontinued.card.id,
    );
    expect(
      result.assignments.flatMap((assignment) =>
        assignment.alternatives.map((alternative) => alternative.cardId)
      ),
    ).not.toContain(discontinued.card.id);
  });

  test('rejects a catalog containing only discontinued cards', () => {
    const discontinued = structuredClone(simplePlan);
    discontinued.card.discontinued = true;
    const constraints = makeConstraints(
      [makeTx('t1', 'uncategorized', 10_000)],
      new Map([[discontinued.card.id, 0]]),
    );

    expect(() => greedyOptimize(constraints, [discontinued])).toThrow(
      /recommendation-eligible card/,
    );
  });

  test('rejects an empty card catalog', () => {
    const constraints = makeConstraints(
      [makeTx('t1', 'uncategorized', 10_000)],
      new Map(),
    );

    expect(() => greedyOptimize(constraints, [])).toThrow(
      /cardRules must contain at least one card/,
    );
  });

  test.each([
    Number.MAX_SAFE_INTEGER + 1,
    1.5,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid previousMonthSpending %s', (previousMonthSpending) => {
    const constraints = makeConstraints(
      [makeTx('t1', 'uncategorized', 10_000)],
      new Map([['shinhan-simple-plan', previousMonthSpending]]),
    );

    expect(() => greedyOptimize(constraints, [simplePlan])).toThrow(
      /previousMonthSpending for shinhan-simple-plan must be a non-negative safe integer/,
    );
  });

  test.each([201, 1e308])(
    'fails closed with a disclosure for oversized fuel volume %s',
    (fuelVolumeLiters) => {
    const transaction = {
      ...makeTx('oversized-fuel', 'transportation', 50_000),
      fuelVolumeLiters,
      factProvenance: { fuelVolumeLiters: 'statement' as const },
    };
    const constraints = makeConstraints(
      [transaction],
      new Map([['shinhan-mr-life', 300_000]]),
    );

    const result = greedyOptimize(constraints, [mrLife]);
    expect(result.totalReward).toBe(0);
    expect(Number.isSafeInteger(result.totalReward)).toBe(true);
    expect(Number.isSafeInteger(result.totalSpending)).toBe(true);
    expect(result.unsupportedRules).toEqual([
      expect.objectContaining({
        transactionId: 'oversized-fuel',
        reason: 'invalid_fuel_volume',
      }),
    ]);
    },
  );

  test('rejects a cross-card spending aggregate beyond the safe boundary', () => {
    const diningCard = structuredClone(simplePlan);
    diningCard.card.id = 'safe-dining-card';
    diningCard.rewards[0]!.category = 'dining';
    const telecomCard = structuredClone(simplePlan);
    telecomCard.card.id = 'safe-telecom-card';
    telecomCard.rewards[0]!.category = 'telecom';
    const amount = 2 ** 52;
    const constraints = makeConstraints(
      [
        makeTx('dining-max', 'dining', amount),
        makeTx('telecom-max', 'telecom', amount),
      ],
      new Map([
        [diningCard.card.id, 0],
        [telecomCard.card.id, 0],
      ]),
    );

    expect(() => greedyOptimize(
      constraints,
      [diningCard, telecomCard],
    )).toThrow(/(?:calculator|optimizer) total spending/);
  });
});

describe('greedyOptimize - bestSingleCard', () => {
  test('bestSingleCard is the card with highest total reward when all transactions are assigned to it', () => {
    const constraints = makeConstraints([
      makeTx('t1', 'convenience_store', 50000),
      makeTx('t2', 'uncategorized', 100000),
    ], new Map([
      ['shinhan-simple-plan', 0],
      ['shinhan-mr-life', 1000000],
    ]));
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    // bestSingleCard should be one of the two cards
    expect(['shinhan-simple-plan', 'shinhan-mr-life']).toContain(result.bestSingleCard.cardId);
    expect(result.bestSingleCard.totalReward).toBeGreaterThan(0);
  });

  test('savingsVsSingleCard can be negative when greedy is not optimal', () => {
    // In some cases, the greedy approach may not beat a single card
    // This tests that savingsVsSingleCard = totalReward - bestSingleCard.totalReward
    const constraints = makeConstraints([
      makeTx('t1', 'uncategorized', 100000),
    ], new Map([
      ['shinhan-simple-plan', 0],
      ['shinhan-mr-life', 0],
    ]));
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    // With no qualifying tier for mr-life, simple-plan should win
    expect(result.savingsVsSingleCard).toBe(result.totalReward - result.bestSingleCard.totalReward);
  });
});

describe('buildConstraints', () => {
  test('builds cards array from previousSpending map', () => {
    const txs: CategorizedTransaction[] = [makeTx('t1', 'dining', 10000)];
    const prevSpending = new Map([
      ['shinhan-simple-plan', 300000],
      ['shinhan-mr-life', 500000],
    ]);
    const constraints = buildConstraints(txs, prevSpending, DEFAULT_CATEGORY_LABELS);
    expect(constraints.cards).toHaveLength(2);
    const simplePlanCard = constraints.cards.find((c) => c.cardId === 'shinhan-simple-plan');
    expect(simplePlanCard?.previousMonthSpending).toBe(300000);
  });

  test('preserves original transactions for transaction-aware scoring', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('t1', 'dining', 12000, '메가커피 강남', 'cafe'),
      makeTx('t2', 'dining', 18000, '스타벅스 강남', 'cafe'),
    ];
    const constraints = buildConstraints(txs, new Map([['fixture-subcategory-card', 0]]), DEFAULT_CATEGORY_LABELS);
    expect(constraints.transactions).toEqual(txs);
  });

  test('transaction-level merchant and subcategory conditions change assignment decisions', () => {
    const transactions: CategorizedTransaction[] = [
      makeTx('t1', 'dining', 20000, '메가커피 강남', 'cafe'),
      makeTx('t2', 'dining', 20000, '스타벅스 강남', 'cafe'),
    ];
    const constraints = makeConstraints(transactions, new Map([
      ['fixture-subcategory-card', 0],
      ['fixture-broad-dining-card', 0],
    ]));

    const result = greedyOptimize(constraints, [subcategoryFixture, broadDiningFixture]);

    // Both transactions have subcategory='cafe' which blocks the broad dining rule.
    // 메가커피 matches the specific cafe rule (5% = 1000).
    // 스타벅스 does NOT match the specific cafe rule (merchant not '메가커피'),
    // and broad dining rule is blocked because tx has subcategory → 0 reward.
    expect(result.assignments.length).toBeGreaterThanOrEqual(1);
    const subcategoryAssignment = result.assignments.find((assignment) => assignment.assignedCardId === 'fixture-subcategory-card');
    expect(subcategoryAssignment).toBeDefined();
    expect(subcategoryAssignment!.reward).toBe(1000);
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
