import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import {
  loadCardRule,
  type CardRuleSet,
  type RewardRule,
} from '@cherrypicker/rules';
import { calculateRewards } from '../src/calculator/reward.js';
import type { CategorizedTransaction } from '../src/models/transaction.js';

function makeTransaction(
  id: string,
  amount = 10_000,
  date = '2026-07-01',
): CategorizedTransaction {
  return {
    id,
    date,
    merchant: '테스트 가맹점',
    amount,
    currency: 'KRW',
    category: 'dining',
    subcategory: 'cafe',
    confidence: 1,
  };
}

function percentageRule(
  id: string,
  category: string,
  rate: number,
  overrides: Partial<RewardRule> = {},
): RewardRule {
  return {
    id,
    category,
    type: 'discount',
    combination: 'exclusive',
    stackingGroup: 'base',
    tiers: [{
      performanceTier: 'tier0',
      rate,
      monthlyCap: null,
      perTransactionCap: null,
    }],
    ...overrides,
  };
}

function makeCard(rewards: RewardRule[]): CardRuleSet {
  return {
    card: {
      id: 'cycle6-reward-card',
      issuer: 'fixture',
      name: 'Cycle 6 Reward Card',
      nameKo: '사이클 6 보상 카드',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      url: 'https://example.com/cycle6-reward',
      lastUpdated: '2026-07-24',
      source: 'manual',
    },
    performanceTiers: [{
      id: 'tier0',
      label: '무실적',
      minSpending: 0,
      maxSpending: null,
    }],
    performanceExclusions: [],
    rewards,
    globalConstraints: {
      monthlyTotalDiscountCap: null,
      minimumAnnualSpending: null,
    },
  };
}

function totalReward(
  cardRule: CardRuleSet,
  transactions: CategorizedTransaction[],
): number {
  return calculateRewards({
    transactions,
    previousMonthSpending: 0,
    cardRule,
  }).totalReward;
}

describe('calculateRewards - executable exclusive fallback', () => {
  test('direct callers cannot inherit first-entry-wins duplicate tiers', () => {
    const duplicate = percentageRule('duplicate-tier', '*', 1);
    duplicate.tiers.push({
      ...duplicate.tiers[0]!,
      rate: 99,
      value: { kind: 'percentage', amount: 99 },
    });
    const card = makeCard([duplicate]);

    expect(() => totalReward(card, [makeTransaction('duplicate')])).toThrow(
      'duplicate performance tier reference "tier0" in reward rule ' +
      '"duplicate-tier" at tiers.1 (first referenced at tiers.0)',
    );

    duplicate.tiers.reverse();
    expect(() => totalReward(card, [makeTransaction('reversed')])).toThrow(
      /duplicate performance tier reference "tier0"/,
    );
  });

  test('Deep Dream tier0 dining receives its exact wildcard benefit', async () => {
    const deepDream = await loadCardRule(join(
      import.meta.dir,
      '../../rules/data/cards/shinhan/deep-dream.yaml',
    ));

    expect(totalReward(deepDream, [
      makeTransaction('deep-dream-tier0'),
    ])).toBe(70);
  });

  test('a zero category tier does not hide a positive wildcard tier', () => {
    const card = makeCard([
      percentageRule('specific-zero', 'dining', 0),
      percentageRule('wildcard-positive', '*', 0.7),
    ]);

    expect(totalReward(card, [makeTransaction('zero-specific')])).toBe(70);
  });

  test('an exhausted category monthly cap falls back to the wildcard', () => {
    const specific = percentageRule('specific-capped', 'dining', 10);
    specific.tiers[0]!.monthlyCap = 1_000;
    const card = makeCard([
      specific,
      percentageRule('wildcard-positive', '*', 1),
    ]);

    expect(totalReward(card, [
      makeTransaction('specific-first'),
      makeTransaction('wildcard-second'),
    ])).toBe(1_100);
  });

  test('a zero per-transaction cap falls back on every transaction', () => {
    const specific = percentageRule('specific-zero-cap', 'dining', 10, {
      conditions: { maxUses: 1, usePeriod: 'month' },
    });
    specific.tiers[0]!.perTransactionCap = 0;
    const card = makeCard([
      specific,
      percentageRule('wildcard-positive', '*', 1),
    ]);

    expect(totalReward(card, [
      makeTransaction('fallback-first'),
      makeTransaction('fallback-second'),
    ])).toBe(200);
  });

  test('an exhausted maxUses condition falls back to the wildcard', () => {
    const card = makeCard([
      percentageRule('specific-one-use', 'dining', 10, {
        conditions: { maxUses: 1, usePeriod: 'month' },
      }),
      percentageRule('wildcard-positive', '*', 1),
    ]);

    expect(totalReward(card, [
      makeTransaction('specific-first'),
      makeTransaction('fallback-second'),
    ])).toBe(1_100);
  });

  test('a consumed fixed-per-day rule falls back on the same day', () => {
    const fixedPerDay: RewardRule = {
      id: 'specific-daily',
      category: 'dining',
      type: 'discount',
      combination: 'exclusive',
      stackingGroup: 'base',
      tiers: [{
        performanceTier: 'tier0',
        rate: null,
        fixedAmount: 1_000,
        unit: 'won_per_day',
        value: { kind: 'fixed_per_day', amount: 1_000 },
        monthlyCap: null,
        perTransactionCap: null,
      }],
    };
    const card = makeCard([
      fixedPerDay,
      percentageRule('wildcard-positive', '*', 1),
    ]);

    expect(totalReward(card, [
      makeTransaction('daily-first'),
      makeTransaction('fallback-second'),
    ])).toBe(1_100);
  });

  test('an unsupported specific reward is disclosed before fallback', () => {
    const unsupportedFuel: RewardRule = {
      id: 'specific-fuel',
      category: 'dining',
      type: 'discount',
      combination: 'exclusive',
      stackingGroup: 'base',
      tiers: [{
        performanceTier: 'tier0',
        rate: null,
        fixedAmount: 80,
        unit: 'won_per_liter',
        value: { kind: 'fuel_per_liter', amount: 80 },
        monthlyCap: null,
        perTransactionCap: null,
      }],
    };
    const card = makeCard([
      unsupportedFuel,
      percentageRule('wildcard-positive', '*', 1),
    ]);

    const output = calculateRewards({
      transactions: [makeTransaction('unsupported-specific')],
      previousMonthSpending: 0,
      cardRule: card,
    });

    expect(output.totalReward).toBe(100);
    expect(output.unsupportedRules).toEqual([
      expect.objectContaining({
        ruleId: 'specific-fuel',
        reason: 'missing_fuel_volume',
      }),
    ]);
  });

  test.each(['monthly', 'transaction'] as const)(
    'an unsupported specific reward remains disclosed with a zero %s cap',
    (capKind) => {
      const unsupportedFuel: RewardRule = {
        id: `specific-fuel-${capKind}`,
        category: 'dining',
        type: 'discount',
        combination: 'exclusive',
        stackingGroup: 'base',
        tiers: [{
          performanceTier: 'tier0',
          rate: null,
          fixedAmount: 80,
          unit: 'won_per_liter',
          value: { kind: 'fuel_per_liter', amount: 80 },
          monthlyCap: capKind === 'monthly' ? 0 : null,
          perTransactionCap: capKind === 'transaction' ? 0 : null,
        }],
      };
      const card = makeCard([
        unsupportedFuel,
        percentageRule('wildcard-positive', '*', 1),
      ]);

      const output = calculateRewards({
        transactions: [makeTransaction(`unsupported-${capKind}`)],
        previousMonthSpending: 0,
        cardRule: card,
      });

      expect(output.totalReward).toBe(100);
      expect(output.unsupportedRules).toEqual([
        expect.objectContaining({
          ruleId: `specific-fuel-${capKind}`,
          reason: 'missing_fuel_volume',
        }),
      ]);
    },
  );

  test('fallback preserves additive benefits in a separate stacking group', () => {
    const card = makeCard([
      percentageRule('specific-zero', 'dining', 0),
      percentageRule('wildcard-positive', '*', 1),
      percentageRule('additive-bonus', 'dining', 2, {
        combination: 'additive',
        stackingGroup: 'bonus',
      }),
    ]);

    expect(totalReward(card, [makeTransaction('stacked')])).toBe(300);
  });

  test('additive cap use is projected before exclusive fallback selection', () => {
    const additive = percentageRule('additive-shared-cap', 'dining', 1, {
      combination: 'additive',
      capGroup: 'shared',
    });
    additive.tiers[0]!.monthlyCap = 100;
    const specific = percentageRule('specific-shared-cap', 'dining', 10, {
      capGroup: 'shared',
    });
    specific.tiers[0]!.monthlyCap = 100;
    const card = makeCard([
      additive,
      specific,
      percentageRule('wildcard-positive', '*', 1),
    ]);

    expect(totalReward(card, [
      makeTransaction('shared-cap-fallback'),
    ])).toBe(200);
  });

  test('an unknown percentage type throws even when its reward floors to zero', () => {
    const unknown = percentageRule('unknown-small-reward', '*', 0.1);
    unknown.type = 'mystery' as 'discount';
    const card = makeCard([unknown]);

    expect(() => totalReward(card, [
      makeTransaction('unknown-one-won', 1),
    ])).toThrow(/Unknown reward type/);
  });

  test('exclusive ties remain deterministic by priority and rule ID', () => {
    const card = makeCard([
      percentageRule('z-rule', 'dining', 5, { priority: 1 }),
      percentageRule('a-rule', 'dining', 1, { priority: 1 }),
    ]);

    expect(totalReward(card, [makeTransaction('deterministic')])).toBe(100);
    expect(totalReward({
      ...card,
      rewards: [...card.rewards].reverse(),
    }, [makeTransaction('reversed')])).toBe(100);
  });
});

describe('calculateRewards - exact percentage-point arithmetic', () => {
  test.each([
    [0.7, 10_000, 70],
    [1.3, 10_000, 130],
    [0.033, 100_000, 33],
    [0.7, 10_001, 70],
    [1e-7, 1_000_000_000, 1],
    [0, 10_000, 0],
  ])(
    '%s percentage points of %s Won floors exactly to %s Won',
    (rate, amount, expected) => {
      const card = makeCard([percentageRule('exact-rate', '*', rate)]);
      expect(totalReward(card, [makeTransaction('exact', amount)])).toBe(
        expected,
      );
    },
  );

  test('caps the exact result after percentage-point evaluation', () => {
    const capped = percentageRule('exact-capped', '*', 0.7);
    capped.tiers[0]!.perTransactionCap = 65;
    const card = makeCard([capped]);

    expect(totalReward(card, [makeTransaction('capped')])).toBe(65);
  });

  test('accepts the maximum safe exact product and rejects overflow', () => {
    const exact = makeCard([percentageRule('maximum', '*', 100)]);
    expect(totalReward(exact, [
      makeTransaction('maximum', Number.MAX_SAFE_INTEGER),
    ])).toBe(Number.MAX_SAFE_INTEGER);

    const overflow = makeCard([
      percentageRule('overflow', '*', 100.000_000_1),
    ]);
    expect(() => totalReward(overflow, [
      makeTransaction('overflow', Number.MAX_SAFE_INTEGER),
    ])).toThrow(/calculated reward is not safely representable/);
  });
});
