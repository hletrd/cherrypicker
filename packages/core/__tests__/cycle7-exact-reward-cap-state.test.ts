import { describe, expect, test } from 'bun:test';
import type { CardRuleSet } from '@cherrypicker/rules';
import {
  buildConstraints,
  calculateCashback,
  calculateDiscount,
  calculatePoints,
  calculateRewards,
  greedyOptimize,
} from '../src/index.js';
import type { CategorizedTransaction } from '../src/index.js';

type PercentageHelper = typeof calculateDiscount;

const HELPERS: ReadonlyArray<readonly [string, PercentageHelper]> = [
  ['discount', calculateDiscount],
  ['points', calculatePoints],
  ['cashback', calculateCashback],
];

function makeCard(options: {
  rate: number;
  globalCap?: number | null;
  ruleCap?: number | null;
}): CardRuleSet {
  const {
    rate,
    globalCap = null,
    ruleCap = null,
  } = options;
  return {
    card: {
      id: 'cycle7-exact-card',
      issuer: 'fixture',
      name: 'Cycle 7 exact card',
      nameKo: 'Cycle 7 정확 계산 카드',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      url: 'https://example.com/cycle7-exact-card',
      lastUpdated: '2026-07-24',
      source: 'manual',
    },
    performanceTiers: [
      {
        id: 'tier0',
        label: '무실적',
        minSpending: 0,
        maxSpending: null,
      },
    ],
    performanceExclusions: [],
    rewards: [
      {
        id: 'cycle7-exact-reward',
        category: 'dining',
        type: 'discount',
        support: { status: 'supported' },
        tiers: [
          {
            performanceTier: 'tier0',
            rate,
            value: { kind: 'percentage', amount: rate },
            monthlyCap: ruleCap,
            perTransactionCap: null,
          },
        ],
      },
    ],
    globalConstraints: {
      monthlyTotalDiscountCap: globalCap,
      minimumAnnualSpending: null,
    },
  };
}

function makeTransaction(
  id: string,
  amount: number,
): CategorizedTransaction {
  return {
    id,
    date: '2026-07-01',
    merchant: `merchant-${id}`,
    amount,
    currency: 'KRW',
    category: 'dining',
    confidence: 1,
  };
}

function calculateMainReward(amount: number, rate: number): number {
  return calculateRewards({
    transactions: [makeTransaction('main', amount)],
    previousMonthSpending: 0,
    cardRule: makeCard({ rate }),
  }).totalReward;
}

describe('public percentage-point helpers', () => {
  test.each([
    ['0.7% whole-Won boundary', 10_000, 0.7, 70],
    ['4.1% whole-Won boundary', 10_000, 4.1, 410],
    ['0.033% exact product', 300_000, 0.033, 99],
    ['0.7% fractional product', 9_999, 0.7, 69],
    ['scientific notation', 1_000_000_000, 1e-7, 1],
  ] as const)(
    'matches the main engine for %s',
    (_label, amount, percentagePoints, expected) => {
      expect(calculateMainReward(amount, percentagePoints)).toBe(expected);
      for (const [, helper] of HELPERS) {
        expect(
          helper(amount, percentagePoints, null, 0),
        ).toEqual({
          reward: expected,
          newMonthUsed: expected,
          capReached: false,
        });
      }
    },
  );

  test('takes authored percentage points directly instead of a pre-divided rate', () => {
    for (const [, helper] of HELPERS) {
      expect(helper(10_000, 0.7, null, 0).reward).toBe(70);
      expect(helper(10_000, 5, null, 0).reward).toBe(500);
    }
  });

  test.each(HELPERS)(
    '%s reports exact and clipped monthly-cap exhaustion',
    (_name, helper) => {
      expect(helper(10_000, 0.7, 70, 0)).toEqual({
        reward: 70,
        newMonthUsed: 70,
        capReached: true,
      });
      expect(helper(5_000, 0.7, 70, 35)).toEqual({
        reward: 35,
        newMonthUsed: 70,
        capReached: true,
      });
      expect(helper(9_999, 0.7, 70, 0)).toEqual({
        reward: 69,
        newMonthUsed: 69,
        capReached: false,
      });
      expect(helper(10_000, 0.7, 50, 0)).toEqual({
        reward: 50,
        newMonthUsed: 50,
        capReached: true,
      });
      expect(helper(10_000, 0.7, 0, 0)).toEqual({
        reward: 0,
        newMonthUsed: 0,
        capReached: false,
      });
    },
  );

  test.each(HELPERS)(
    '%s preserves safe-integer boundaries and fails before caps can hide overflow',
    (_name, helper) => {
      expect(
        helper(Number.MAX_SAFE_INTEGER, 100, null, 0),
      ).toEqual({
        reward: Number.MAX_SAFE_INTEGER,
        newMonthUsed: Number.MAX_SAFE_INTEGER,
        capReached: false,
      });
      expect(
        helper(
          100,
          1,
          Number.MAX_SAFE_INTEGER,
          Number.MAX_SAFE_INTEGER - 1,
        ),
      ).toEqual({
        reward: 1,
        newMonthUsed: Number.MAX_SAFE_INTEGER,
        capReached: true,
      });
      expect(() =>
        helper(
          Number.MAX_SAFE_INTEGER,
          100.000_000_1,
          1,
          0,
        ),
      ).toThrow(/not safely representable/);
      expect(() =>
        helper(Number.MAX_SAFE_INTEGER, 100, null, 1),
      ).toThrow(/monthly reward total/);
    },
  );
});

describe('main calculator exact global-cap telemetry', () => {
  test('records a single positive reward that exactly reaches the cap', () => {
    const result = calculateRewards({
      transactions: [makeTransaction('single-exact', 1_000)],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, globalCap: 100 }),
    });

    expect(result.totalReward).toBe(100);
    expect(result.rewards[0]?.capReached).toBe(true);
    expect(result.capsHit).toEqual([
      {
        category: 'dining',
        capType: 'monthly_total',
        capAmount: 100,
        actualReward: 100,
        appliedReward: 100,
      },
    ]);
  });

  test('records cumulative exact exhaustion on the reward that reaches it', () => {
    const result = calculateRewards({
      transactions: [
        makeTransaction('cumulative-first', 500),
        makeTransaction('cumulative-second', 500),
      ],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, globalCap: 100 }),
    });

    expect(result.totalReward).toBe(100);
    expect(result.capsHit).toEqual([
      {
        category: 'dining',
        capType: 'monthly_total',
        capAmount: 100,
        actualReward: 50,
        appliedReward: 50,
      },
    ]);
  });

  test('distinguishes one below, clipping, and a zero cap', () => {
    const oneBelow = calculateRewards({
      transactions: [makeTransaction('one-below', 990)],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, globalCap: 100 }),
    });
    expect(oneBelow.totalReward).toBe(99);
    expect(oneBelow.rewards[0]?.capReached).toBe(false);
    expect(oneBelow.capsHit).toEqual([]);

    const clipped = calculateRewards({
      transactions: [makeTransaction('clipped', 1_100)],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, globalCap: 100 }),
    });
    expect(clipped.totalReward).toBe(100);
    expect(clipped.rewards[0]?.capReached).toBe(true);
    expect(clipped.capsHit).toEqual([
      {
        category: 'dining',
        capType: 'monthly_total',
        capAmount: 100,
        actualReward: 110,
        appliedReward: 100,
      },
    ]);

    const zeroCap = calculateRewards({
      transactions: [makeTransaction('zero-cap', 1_000)],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, globalCap: 0 }),
    });
    expect(zeroCap.totalReward).toBe(0);
    expect(zeroCap.rewards[0]?.capReached).toBe(false);
    expect(zeroCap.capsHit).toEqual([]);
  });

  test('keeps exact rule-level and global-cap state coherent', () => {
    const result = calculateRewards({
      transactions: [makeTransaction('dual-exact', 1_000)],
      previousMonthSpending: 0,
      cardRule: makeCard({
        rate: 10,
        ruleCap: 100,
        globalCap: 100,
      }),
    });

    expect(result.totalReward).toBe(100);
    expect(result.rewards[0]).toMatchObject({
      reward: 100,
      capReached: true,
    });
    expect(result.rewards[0]).not.toHaveProperty('capAmount');
    expect(result.capsHit).toContainEqual({
      category: 'dining',
      capType: 'monthly_total',
      capAmount: 100,
      actualReward: 100,
      appliedReward: 100,
    });
  });
});

describe('main calculator exact rule-cap telemetry', () => {
  test('records one exact event with equal actual and applied reward', () => {
    const result = calculateRewards({
      transactions: [makeTransaction('rule-single-exact', 1_000)],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, ruleCap: 100 }),
    });

    expect(result.totalReward).toBe(100);
    expect(result.capsHit).toEqual([
      {
        category: 'dining',
        capType: 'monthly_category',
        capAmount: 100,
        actualReward: 100,
        appliedReward: 100,
        ruleId: 'cycle7-exact-reward',
        capGroup: 'cycle7-exact-reward',
      },
    ]);
  });

  test('emits cumulative exact exhaustion once and not again after exhaustion', () => {
    const result = calculateRewards({
      transactions: [
        makeTransaction('rule-first', 500),
        makeTransaction('rule-exact', 500),
        makeTransaction('rule-after-cap', 500),
      ],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, ruleCap: 100 }),
    });

    expect(result.totalReward).toBe(100);
    expect(result.capsHit).toEqual([
      {
        category: 'dining',
        capType: 'monthly_category',
        capAmount: 100,
        actualReward: 50,
        appliedReward: 50,
        ruleId: 'cycle7-exact-reward',
        capGroup: 'cycle7-exact-reward',
      },
    ]);
  });

  test('distinguishes one below, clipping, and a zero rule cap', () => {
    const oneBelow = calculateRewards({
      transactions: [makeTransaction('rule-one-below', 990)],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, ruleCap: 100 }),
    });
    expect(oneBelow.capsHit).toEqual([]);

    const clipped = calculateRewards({
      transactions: [makeTransaction('rule-clipped', 1_100)],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, ruleCap: 100 }),
    });
    expect(clipped.capsHit).toEqual([
      {
        category: 'dining',
        capType: 'monthly_category',
        capAmount: 100,
        actualReward: 110,
        appliedReward: 100,
        ruleId: 'cycle7-exact-reward',
        capGroup: 'cycle7-exact-reward',
      },
    ]);

    const zeroCap = calculateRewards({
      transactions: [makeTransaction('rule-zero-cap', 1_000)],
      previousMonthSpending: 0,
      cardRule: makeCard({ rate: 10, ruleCap: 0 }),
    });
    expect(zeroCap.totalReward).toBe(0);
    expect(zeroCap.capsHit).toEqual([]);
  });

  test('does not claim rule exhaustion when a tighter global cap rolls it back', () => {
    const result = calculateRewards({
      transactions: [makeTransaction('rule-global-rollback', 1_000)],
      previousMonthSpending: 0,
      cardRule: makeCard({
        rate: 10,
        ruleCap: 100,
        globalCap: 50,
      }),
    });

    expect(result.totalReward).toBe(50);
    expect(
      result.capsHit.filter((cap) => cap.capType === 'monthly_category'),
    ).toEqual([]);
    expect(result.capsHit).toContainEqual({
      category: 'dining',
      capType: 'monthly_total',
      capAmount: 50,
      actualReward: 100,
      appliedReward: 50,
    });
  });
});

describe('optimizer cap telemetry', () => {
  test.each([
    ['exact', 1_000, 100, 100],
    ['clipped', 1_100, 110, 100],
  ] as const)(
    'preserves the %s global-cap outcome',
    (_label, amount, actualReward, appliedReward) => {
      const card = makeCard({ rate: 10, globalCap: 100 });
      const constraints = buildConstraints(
        [makeTransaction(`optimizer-${_label}`, amount)],
        new Map([[card.card.id, 0]]),
        new Map([['dining', '외식']]),
      );
      const result = greedyOptimize(constraints, [card]);

      expect(result.totalReward).toBe(100);
      expect(result.cardResults).toHaveLength(1);
      expect(result.cardResults[0]?.byCategory[0]?.capReached).toBe(true);
      expect(result.cardResults[0]?.capsHit).toEqual([
        {
          category: 'dining',
          capType: 'monthly_total',
          capAmount: 100,
          actualReward,
          appliedReward,
        },
      ]);
    },
  );
});
