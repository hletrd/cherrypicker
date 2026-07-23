import { describe, expect, test } from 'bun:test';
import type { CardRuleSet, RewardRule } from '@cherrypicker/rules';
import { calculateRewards } from '../src/calculator/reward.js';
import type { CategorizedTransaction } from '../src/models/transaction.js';

type RewardKind = RewardRule['tiers'][number]['value']['kind'];

function transaction(
  id: string,
  category: string,
): CategorizedTransaction {
  return {
    id,
    date: '2026-07-24',
    merchant: `${category} merchant`,
    amount: 10_000,
    currency: 'KRW',
    category,
    confidence: 1,
  };
}

function rewardRule(options: {
  id: string;
  category: string;
  amount: number;
  kind?: RewardKind;
  capGroup: string;
  monthlyCap: number | null;
  perTransactionCap?: number | null;
}): RewardRule {
  const kind = options.kind ?? 'percentage';
  return {
    id: options.id,
    category: options.category,
    type: 'discount',
    tiers: [{
      performanceTier: 'tier0',
      rate: kind === 'percentage' ? options.amount : null,
      fixedAmount: kind === 'percentage' ? null : options.amount,
      unit: kind === 'fixed_per_day' ? 'won_per_day' : null,
      value: { kind, amount: options.amount },
      monthlyCap: options.monthlyCap,
      perTransactionCap: options.perTransactionCap ?? null,
    }],
    priority: 0,
    combination: 'exclusive',
    stackingGroup: options.id,
    capGroup: options.capGroup,
    support: { status: 'supported' },
  };
}

function card(rewards: RewardRule[]): CardRuleSet {
  return {
    card: {
      id: 'cycle12-cap-identity',
      issuer: 'fixture',
      name: 'Cycle 12 Cap Identity',
      nameKo: '사이클 12 한도 식별자',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
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

function calculate(
  cardRule: CardRuleSet,
  transactions: CategorizedTransaction[],
) {
  return calculateRewards({
    cardRule,
    transactions,
    previousMonthSpending: 0,
  });
}

describe('Cycle 12 shared cap and rule execution identities', () => {
  test.each([
    ['different numeric caps', 100, 1_000],
    ['uncapped versus capped', null, 1_000],
  ])(
    'direct calculator calls reject %s before transaction order can matter',
    (_label, firstCap, secondCap) => {
      const cardRule = card([
        rewardRule({
          id: 'dining-rate',
          category: 'dining',
          amount: 10,
          capGroup: 'shared-monthly',
          monthlyCap: firstCap,
        }),
        rewardRule({
          id: 'grocery-rate',
          category: 'grocery',
          amount: 5,
          capGroup: 'shared-monthly',
          monthlyCap: secondCap,
        }),
      ]);
      const dining = transaction('dining', 'dining');
      const grocery = transaction('grocery', 'grocery');
      const expected =
        `cap group "shared-monthly" defines monthlyCap ` +
        `${String(secondCap)} for performance tier "tier0", but ` +
        `rewards.0.tiers.0.monthlyCap defines ${String(firstCap)}`;

      expect(() => calculate(cardRule, [dining, grocery])).toThrow(expected);
      expect(() => calculate(cardRule, [grocery, dining])).toThrow(expected);
    },
  );

  test('a coherent shared monthly cap has an order-invariant total', () => {
    const cardRule = card([
      rewardRule({
        id: 'dining-rate',
        category: 'dining',
        amount: 10,
        capGroup: 'shared-monthly',
        monthlyCap: 500,
      }),
      rewardRule({
        id: 'grocery-rate',
        category: 'grocery',
        amount: 5,
        capGroup: 'shared-monthly',
        monthlyCap: 500,
      }),
    ]);
    const dining = transaction('dining', 'dining');
    const grocery = transaction('grocery', 'grocery');

    expect(calculate(cardRule, [dining, grocery]).totalReward).toBe(500);
    expect(calculate(cardRule, [grocery, dining]).totalReward).toBe(500);
  });

  test('independent fixed-per-day rules do not share daily occurrence state', () => {
    const cardRule = card([
      rewardRule({
        id: 'dining-daily',
        category: 'dining',
        amount: 100,
        kind: 'fixed_per_day',
        capGroup: 'shared-monthly',
        monthlyCap: 1_000,
      }),
      rewardRule({
        id: 'grocery-daily',
        category: 'grocery',
        amount: 200,
        kind: 'fixed_per_day',
        capGroup: 'shared-monthly',
        monthlyCap: 1_000,
      }),
    ]);
    const dining = transaction('dining', 'dining');
    const grocery = transaction('grocery', 'grocery');

    expect(calculate(cardRule, [dining, grocery]).totalReward).toBe(300);
    expect(calculate(cardRule, [grocery, dining]).totalReward).toBe(300);
  });

  test('cap telemetry keeps the contributing rule and shared group identities', () => {
    const cardRule = card([
      rewardRule({
        id: 'dining-per-purchase',
        category: 'dining',
        amount: 300,
        kind: 'fixed_per_transaction',
        capGroup: 'shared-monthly',
        monthlyCap: 1_000,
        perTransactionCap: 100,
      }),
      rewardRule({
        id: 'grocery-per-purchase',
        category: 'grocery',
        amount: 400,
        kind: 'fixed_per_transaction',
        capGroup: 'shared-monthly',
        monthlyCap: 1_000,
        perTransactionCap: 200,
      }),
    ]);

    expect(calculate(cardRule, [
      transaction('dining', 'dining'),
      transaction('grocery', 'grocery'),
    ]).capsHit).toEqual([
      expect.objectContaining({
        ruleId: 'dining-per-purchase',
        capGroup: 'shared-monthly',
      }),
      expect.objectContaining({
        ruleId: 'grocery-per-purchase',
        capGroup: 'shared-monthly',
      }),
    ]);
  });
});
