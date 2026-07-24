import { describe, expect, test } from 'bun:test';
import type { CardRuleSet, RewardRule } from '@cherrypicker/rules';
import * as publicCore from '../src/index.js';
import {
  calculateRewards,
  calculateRewardsWithPreparedCard,
  prepareCardRuleForCalculation,
} from '../src/calculator/reward.js';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import { buildConstraints } from '../src/optimizer/constraints.js';
import { greedyOptimize } from '../src/optimizer/greedy.js';

function transaction(
  index: number,
  overrides: Partial<CategorizedTransaction> = {},
): CategorizedTransaction {
  return {
    id: `cycle14-transaction-${index}`,
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    merchant: `merchant-${index}`,
    amount: 10_000,
    currency: 'KRW',
    category: 'dining',
    confidence: 1,
    ...overrides,
  };
}

function percentageRule(
  index: number,
  options: {
    maxUses?: number;
    monthlyCap?: number | null;
  } = {},
): RewardRule {
  const id = `cycle14-rule-${index}`;
  return {
    id,
    category: 'dining',
    type: 'discount',
    conditions: {
      specificMerchants: [`merchant-${index}`],
      ...(options.maxUses === undefined
        ? {}
        : { maxUses: options.maxUses, usePeriod: 'month' as const }),
    },
    tiers: [{
      performanceTier: 'tier0',
      rate: 10,
      fixedAmount: null,
      unit: null,
      value: { kind: 'percentage', amount: 10 },
      monthlyCap:
        options.monthlyCap === undefined ? 500 : options.monthlyCap,
      perTransactionCap: null,
    }],
    priority: 0,
    combination: 'exclusive',
    stackingGroup: id,
    capGroup: id,
    support: { status: 'supported' },
  };
}

function fixedPerDayRule(index: number): RewardRule {
  const id = `cycle14-daily-rule-${index}`;
  return {
    id,
    category: 'dining',
    type: 'discount',
    conditions: {
      specificMerchants: [`merchant-${index}`],
    },
    tiers: [{
      performanceTier: 'tier0',
      rate: null,
      fixedAmount: 1_000,
      unit: 'won_per_day',
      value: { kind: 'fixed_per_day', amount: 1_000 },
      monthlyCap: 500,
      perTransactionCap: null,
    }],
    priority: 0,
    combination: 'exclusive',
    stackingGroup: id,
    capGroup: id,
    support: { status: 'supported' },
  };
}

function card(id: string, rewards: RewardRule[]): CardRuleSet {
  return {
    card: {
      id,
      issuer: 'fixture',
      name: id,
      nameKo: id,
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

function observeStackingGroupReads(cardRule: CardRuleSet): {
  counts: () => number[];
  reset: () => void;
} {
  const ruleIds = cardRule.rewards.map((rule) => rule.id!);
  const reads = new Map(ruleIds.map((ruleId) => [ruleId, 0]));
  cardRule.rewards = cardRule.rewards.map((rule) => {
    const ruleId = rule.id!;
    return new Proxy(rule, {
      get(target, property, receiver) {
        if (property === 'stackingGroup') {
          reads.set(ruleId, (reads.get(ruleId) ?? 0) + 1);
        }
        return Reflect.get(target, property, receiver);
      },
    });
  });
  return {
    counts: () => ruleIds.map((ruleId) => reads.get(ruleId) ?? 0),
    reset: () => {
      for (const ruleId of ruleIds) reads.set(ruleId, 0);
    },
  };
}

function optimize(
  transactions: CategorizedTransaction[],
  cards: CardRuleSet[],
) {
  return greedyOptimize(
    buildConstraints(
      transactions,
      new Map(cards.map((cardRule) => [cardRule.card.id, 0])),
      new Map([
        ['dining', '외식'],
        ['grocery', '마트'],
      ]),
    ),
    cards,
  );
}

describe('Cycle 14 reconciled stateless cap prefix', () => {
  test('skips only proven stateless prefix counterfactual groups', () => {
    const cardRule = card(
      'cycle14-stateless-direct',
      [0, 1, 2].map((index) => percentageRule(index)),
    );
    const reads = observeStackingGroupReads(cardRule);
    const preparedCardRule = prepareCardRuleForCalculation(cardRule);
    const transactions = [0, 1, 2].map((index) => transaction(index));

    const ordinary = calculateRewardsWithPreparedCard({
      transactions,
      previousMonthSpending: 0,
      preparedCardRule,
      capSuppressionStartIndex: 2,
    });
    expect(reads.counts()).toEqual([2, 2, 2]);

    reads.reset();
    const reconciled = calculateRewardsWithPreparedCard({
      transactions,
      previousMonthSpending: 0,
      preparedCardRule,
      capSuppressionStartIndex: 2,
      prefixCounterfactualAlreadyReconciled: true,
    });

    // Each rule getter is read once for actual grouping. Counterfactual
    // grouping disappears only for the two proven prefix rows.
    expect(reads.counts()).toEqual([1, 1, 2]);
    expect(reconciled).toEqual(ordinary);
    expect(JSON.stringify(reconciled)).toBe(JSON.stringify(ordinary));
  });

  test('rejects a claim without collection or an exact append boundary', () => {
    const cardRule = card(
      'cycle14-invalid-claim',
      [0, 1, 2].map((index) => percentageRule(index)),
    );
    const preparedCardRule = prepareCardRuleForCalculation(cardRule);
    const transactions = [0, 1, 2].map((index) => transaction(index));

    expect(() =>
      calculateRewardsWithPreparedCard({
        transactions,
        previousMonthSpending: 0,
        preparedCardRule,
        collectCapSuppressions: false,
        capSuppressionStartIndex: 2,
        prefixCounterfactualAlreadyReconciled: true,
      })
    ).toThrow(
      'prefixCounterfactualAlreadyReconciled requires cap suppression collection',
    );
    for (const capSuppressionStartIndex of [1, 3]) {
      expect(() =>
        calculateRewardsWithPreparedCard({
          transactions,
          previousMonthSpending: 0,
          preparedCardRule,
          capSuppressionStartIndex,
          prefixCounterfactualAlreadyReconciled: true,
        })
      ).toThrow(
        'prefixCounterfactualAlreadyReconciled requires ' +
          'capSuppressionStartIndex to identify the appended transaction',
      );
    }
  });

  test('retains full maxUses and fixed-per-day counterfactual history', () => {
    const fixtures = [
      card(
        'cycle14-max-uses',
        [0, 1, 2].map((index) =>
          percentageRule(index, { maxUses: 1 })
        ),
      ),
      card(
        'cycle14-fixed-per-day',
        [0, 1, 2].map((index) => fixedPerDayRule(index)),
      ),
    ];
    const transactions = [0, 1, 2].map((index) => transaction(index));

    for (const cardRule of fixtures) {
      const reads = observeStackingGroupReads(cardRule);
      const preparedCardRule = prepareCardRuleForCalculation(cardRule);
      expect(preparedCardRule.hasStatefulReward).toBe(true);

      const ordinary = calculateRewardsWithPreparedCard({
        transactions,
        previousMonthSpending: 0,
        preparedCardRule,
        capSuppressionStartIndex: 2,
      });
      expect(reads.counts()).toEqual([2, 2, 2]);

      reads.reset();
      const claimed = calculateRewardsWithPreparedCard({
        transactions,
        previousMonthSpending: 0,
        preparedCardRule,
        capSuppressionStartIndex: 2,
        prefixCounterfactualAlreadyReconciled: true,
      });
      expect(reads.counts()).toEqual([2, 2, 2]);
      expect(claimed).toEqual(ordinary);
    }
  });

  test('keeps unsafe direct and public prefix knownness fail-closed', () => {
    const cappedPriority = percentageRule(0, { monthlyCap: 0 });
    cappedPriority.tiers[0]!.rate = 1;
    cappedPriority.tiers[0]!.value = {
      kind: 'percentage',
      amount: 1,
    };
    cappedPriority.priority = 10;
    cappedPriority.stackingGroup = 'unsafe';
    const uncappedFallback = percentageRule(0, { monthlyCap: null });
    uncappedFallback.id = 'cycle14-unsafe-fallback';
    uncappedFallback.tiers[0]!.rate = 5;
    uncappedFallback.tiers[0]!.value = {
      kind: 'percentage',
      amount: 5,
    };
    uncappedFallback.priority = 0;
    uncappedFallback.stackingGroup = 'unsafe';
    uncappedFallback.capGroup = 'cycle14-unsafe-fallback';
    const cardRule = card(
      'cycle14-unsafe-prefix',
      [cappedPriority, uncappedFallback],
    );
    const transactions = [
      transaction(0, { merchant: 'a-prefix' }),
      transaction(1, {
        merchant: 'z-later',
        category: 'grocery',
      }),
    ];
    cappedPriority.conditions = { specificMerchants: ['a-prefix'] };
    uncappedFallback.conditions = { specificMerchants: ['a-prefix'] };

    const direct = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule,
    });
    const preparedCardRule = prepareCardRuleForCalculation(cardRule);
    const appendOnly = calculateRewardsWithPreparedCard({
      transactions,
      previousMonthSpending: 0,
      preparedCardRule,
      capSuppressionStartIndex: 1,
    });
    const beyondWindow = calculateRewardsWithPreparedCard({
      transactions,
      previousMonthSpending: 0,
      preparedCardRule,
      capSuppressionStartIndex: 2,
    });

    expect(direct.totalReward).toBe(500);
    expect(direct.capSuppressions).toEqual([]);
    expect(direct.capSuppressionsComplete).toBe(false);
    expect(appendOnly).toEqual(direct);
    expect(beyondWindow.capSuppressions).toEqual([]);
    expect(beyondWindow.capSuppressionsComplete).toBe(false);
    expect(publicCore).not.toHaveProperty(
      'calculateRewardsWithPreparedCard',
    );

    const firstOnly = optimize([transactions[0]!], [cardRule]);
    const withLaterRow = optimize(transactions, [cardRule]);
    expect(firstOnly.portfolioCapLosses).toBeUndefined();
    expect(withLaterRow.totalReward).toBe(500);
    expect(withLaterRow.portfolioCapLosses).toBeUndefined();
  });

  test('optimizer append scoring removes only historical stateless reads', () => {
    const cardRule = card(
      'cycle14-stateless-optimizer',
      [0, 1, 2].map((index) => percentageRule(index)),
    );
    const reads = observeStackingGroupReads(cardRule);
    const result = optimize(
      [0, 1, 2].map((index) => transaction(index)),
      [cardRule],
    );

    // Scoring contributes two reads per row while it is current and two
    // actual-only reads on each later iteration. Three reporting replays add
    // one actual read apiece. Without the proven-prefix skip this is 11/8/5.
    expect(reads.counts()).toEqual([9, 7, 5]);
    expect(result.totalReward).toBe(1_500);
    expect(result.portfolioCapLosses).toHaveLength(3);
  });
});
