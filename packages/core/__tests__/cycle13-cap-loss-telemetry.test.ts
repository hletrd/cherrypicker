import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import {
  loadCardRule,
  type CardRuleSet,
  type RewardRule,
} from '@cherrypicker/rules';
import {
  buildConstraints,
  calculateRewards,
  greedyOptimize,
  type CategorizedTransaction,
} from '../src/index.js';
import {
  calculateRewardsWithPreparedCard,
  prepareCardRuleForCalculation,
} from '../src/calculator/reward.js';

function percentageRule(
  id: string,
  rate: number,
  options: {
    monthlyCap?: number | null;
    perTransactionCap?: number | null;
    category?: string;
    combination?: 'exclusive' | 'additive';
    priority?: number;
    stackingGroup?: string;
  } = {},
): RewardRule {
  return {
    id,
    category: options.category ?? 'dining',
    type: 'discount',
    support: { status: 'supported' },
    combination: options.combination ?? 'exclusive',
    stackingGroup: options.stackingGroup ?? 'base',
    priority: options.priority,
    tiers: [{
      performanceTier: 'tier0',
      rate,
      monthlyCap: options.monthlyCap ?? null,
      perTransactionCap: options.perTransactionCap ?? null,
    }],
  };
}

function fixedPerDayRule(
  id: string,
  fixedAmount: number,
  monthlyCap: number | null,
): RewardRule {
  return {
    id,
    category: 'dining',
    type: 'discount',
    support: { status: 'supported' },
    combination: 'exclusive',
    stackingGroup: 'base',
    tiers: [{
      performanceTier: 'tier0',
      rate: null,
      fixedAmount,
      unit: 'won_per_day',
      value: { kind: 'fixed_per_day', amount: fixedAmount },
      monthlyCap,
      perTransactionCap: null,
    }],
  };
}

function additiveFixedRule(
  id: string,
  fixedAmount: number,
  perTransactionCap: number | null,
): RewardRule {
  return {
    id,
    category: 'dining',
    type: 'discount',
    support: { status: 'supported' },
    combination: 'additive',
    stackingGroup: id,
    tiers: [{
      performanceTier: 'tier0',
      rate: null,
      fixedAmount,
      unit: null,
      value: { kind: 'fixed_per_transaction', amount: fixedAmount },
      monthlyCap: null,
      perTransactionCap,
    }],
  };
}

function makeCard(
  id: string,
  rewards: RewardRule[],
  globalCap: number | null = null,
): CardRuleSet {
  return {
    card: {
      id,
      issuer: 'fixture',
      name: id,
      nameKo: id,
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      url: `https://example.com/${id}`,
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
      monthlyTotalDiscountCap: globalCap,
      minimumAnnualSpending: null,
    },
  };
}

function makeTransaction(
  id: string,
  amount = 50_000,
  merchant = id,
): CategorizedTransaction {
  return {
    id,
    date: '2026-07-01',
    merchant,
    amount,
    currency: 'KRW',
    category: 'dining',
    confidence: 1,
  };
}

function optimize(
  transactions: CategorizedTransaction[],
  cards: CardRuleSet[],
) {
  return greedyOptimize(
    buildConstraints(
      transactions,
      new Map(cards.map((card) => [card.card.id, 0])),
      new Map([['dining', '외식']]),
    ),
    cards,
  );
}

describe('cycle 13 cap-loss telemetry', () => {
  test('retains exact monthly exhaustion followed by a blocked transaction', () => {
    const card = makeCard('monthly-card', [
      percentageRule('monthly-benefit', 10, { monthlyCap: 5_000 }),
    ]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('blocked', 50_000, 'b-blocked'),
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(5_000);
    expect(calculation.capsHit).toEqual([{
      category: 'dining',
      capType: 'monthly_category',
      capAmount: 5_000,
      actualReward: 5_000,
      appliedReward: 5_000,
      ruleId: 'monthly-benefit',
      capGroup: 'monthly-benefit',
    }]);
    expect(calculation.capSuppressions).toEqual([{
      transactionId: 'blocked',
      transactionIndex: 1,
      category: 'dining',
      actualReward: 0,
      counterfactualReward: 5_000,
      grossSuppressedReward: 5_000,
      replacementReward: 0,
      netSuppressedReward: 5_000,
      causes: [{
        ruleId: 'monthly-benefit',
        capGroup: 'monthly-benefit',
        capType: 'monthly_category',
        capAmount: 5_000,
        rewardBeforeCap: 5_000,
        rewardAfterCap: 0,
      }],
    }]);

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(5_000);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(result.portfolioCapLosses).toEqual([{
      transactionId: 'blocked',
      transactionOccurrence: 0,
      category: 'dining',
      counterfactualCardId: 'monthly-card',
      counterfactualCardName: 'monthly-card',
      selectedCardId: null,
      selectedCardName: null,
      counterfactualReward: 5_000,
      selectedReward: 0,
      grossSuppressedReward: 5_000,
      replacementReward: 0,
      netLostReward: 5_000,
      causes: [{
        ruleId: 'monthly-benefit',
        capGroup: 'monthly-benefit',
        capType: 'monthly_category',
        capAmount: 5_000,
        rewardBeforeCap: 5_000,
        rewardAfterCap: 0,
      }],
    }]);
  });

  test('subtracts an executable same-card exclusive fallback without changing totals', () => {
    const card = makeCard('fallback-card', [
      percentageRule('specific-capped', 10, { monthlyCap: 5_000 }),
      percentageRule('wildcard-fallback', 4, { category: '*' }),
    ]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('fallback', 50_000, 'b-fallback'),
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(7_000);
    expect(calculation.capSuppressions).toEqual([{
      transactionId: 'fallback',
      transactionIndex: 1,
      category: 'dining',
      actualReward: 2_000,
      counterfactualReward: 5_000,
      grossSuppressedReward: 5_000,
      replacementReward: 2_000,
      netSuppressedReward: 3_000,
      causes: [{
        ruleId: 'specific-capped',
        capGroup: 'specific-capped',
        capType: 'monthly_category',
        capAmount: 5_000,
        rewardBeforeCap: 5_000,
        rewardAfterCap: 0,
      }],
    }]);

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(7_000);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.reward).toBe(7_000);
    expect(result.portfolioCapLosses?.[0]).toMatchObject({
      transactionId: 'fallback',
      counterfactualCardId: 'fallback-card',
      selectedCardId: 'fallback-card',
      counterfactualReward: 5_000,
      selectedReward: 2_000,
      grossSuppressedReward: 5_000,
      replacementReward: 2_000,
      netLostReward: 3_000,
    });
  });

  test('subtracts the selected reward from another card from portfolio loss', () => {
    const capped = makeCard('a-capped-card', [
      percentageRule('capped-benefit', 10, { monthlyCap: 5_000 }),
    ]);
    const replacement = makeCard('b-replacement-card', [
      percentageRule('replacement-benefit', 6),
    ]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('replaced', 50_000, 'b-replaced'),
    ];

    const result = optimize(transactions, [capped, replacement]);
    expect(result.totalReward).toBe(8_000);
    expect(
      result.assignments.reduce((sum, assignment) => sum + assignment.reward, 0),
    ).toBe(8_000);
    expect(result.portfolioCapLosses).toEqual([{
      transactionId: 'replaced',
      transactionOccurrence: 0,
      category: 'dining',
      counterfactualCardId: 'a-capped-card',
      counterfactualCardName: 'a-capped-card',
      selectedCardId: 'b-replacement-card',
      selectedCardName: 'b-replacement-card',
      counterfactualReward: 5_000,
      selectedReward: 3_000,
      grossSuppressedReward: 5_000,
      replacementReward: 3_000,
      netLostReward: 2_000,
      causes: [{
        ruleId: 'capped-benefit',
        capGroup: 'capped-benefit',
        capType: 'monthly_category',
        capAmount: 5_000,
        rewardBeforeCap: 5_000,
        rewardAfterCap: 0,
      }],
    }]);
  });

  test('does not report net loss when an equal other-card reward replaces it', () => {
    const capped = makeCard('a-capped-card', [
      percentageRule('capped-benefit', 10, { monthlyCap: 5_000 }),
    ]);
    const secondOnlyRule = percentageRule('second-only', 10);
    secondOnlyRule.conditions = { specificMerchants: ['b-second'] };
    const equalReplacement = makeCard('b-equal-card', [secondOnlyRule]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('second', 50_000, 'b-second'),
    ];

    const result = optimize(transactions, [capped, equalReplacement]);
    expect(result.totalReward).toBe(10_000);
    expect(result.portfolioCapLosses).toEqual([]);
  });

  test('omits suppression when an equal same-card exclusive fallback replaces it', () => {
    const card = makeCard('equal-fallback-card', [
      percentageRule('specific-capped', 10, { monthlyCap: 5_000 }),
      percentageRule('equal-wildcard', 10, { category: '*' }),
    ]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('equal-fallback', 50_000, 'b-equal-fallback'),
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(10_000);
    expect(calculation.capSuppressions).toEqual([]);

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(10_000);
    expect(result.assignments[0]?.reward).toBe(10_000);
    expect(result.portfolioCapLosses).toEqual([]);
  });

  test('keeps only the highest ordered suppressed exclusive candidate', () => {
    const second = percentageRule('second-capped', 8, {
      monthlyCap: 0,
      priority: 10,
    });
    const first = percentageRule('first-capped', 10, {
      monthlyCap: 5_000,
      priority: 20,
    });
    const fallback = percentageRule('fallback', 4, {
      category: '*',
      priority: 0,
    });
    const card = makeCard('exclusive-card', [second, fallback, first]);
    const transactions = [
      makeTransaction('first-use', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(7_000);
    expect(calculation.capSuppressions[0]?.causes).toEqual([{
      ruleId: 'first-capped',
      capGroup: 'first-capped',
      capType: 'monthly_category',
      capAmount: 5_000,
      rewardBeforeCap: 5_000,
      rewardAfterCap: 0,
    }]);
    expect(calculation.capSuppressions[0]?.netSuppressedReward).toBe(3_000);
  });

  test('retains both independent additive losses in deterministic rule order', () => {
    const card = makeCard('additive-card', [
      percentageRule('z-additive', 5, {
        combination: 'additive',
        monthlyCap: 2_500,
      }),
      percentageRule('a-additive', 5, {
        combination: 'additive',
        monthlyCap: 2_500,
      }),
    ]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('blocked', 50_000, 'b-blocked'),
    ];

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(5_000);
    expect(result.portfolioCapLosses?.[0]).toMatchObject({
      counterfactualReward: 5_000,
      selectedReward: 0,
      grossSuppressedReward: 5_000,
      replacementReward: 0,
      netLostReward: 5_000,
    });
    expect(
      result.portfolioCapLosses?.[0]?.causes.map((cause) => cause.ruleId),
    ).toEqual(['a-additive', 'z-additive']);
  });

  test('uses per-transaction, monthly, then global stage precedence without duplicates', () => {
    const card = makeCard('stage-card', [
      percentageRule('all-caps', 10, {
        perTransactionCap: 0,
        monthlyCap: 0,
      }),
    ], 0);

    const calculation = calculateRewards({
      transactions: [makeTransaction('blocked')],
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(0);
    expect(calculation.capSuppressions[0]?.causes).toEqual([{
      ruleId: 'all-caps',
      capGroup: 'all-caps',
      capType: 'per_transaction',
      capAmount: 0,
      rewardBeforeCap: 5_000,
      rewardAfterCap: 0,
    }]);
  });

  test('retains every positive per-transaction, monthly, and global stage delta', () => {
    const card = makeCard('multi-stage-card', [
      percentageRule('multi-stage', 10, {
        perTransactionCap: 8_000,
        monthlyCap: 5_000,
      }),
    ], 3_000);

    const calculation = calculateRewards({
      transactions: [makeTransaction('multi-stage-transaction', 100_000)],
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(3_000);
    expect(calculation.capSuppressionsComplete).toBe(true);
    expect(calculation.capSuppressions[0]).toMatchObject({
      counterfactualReward: 10_000,
      actualReward: 3_000,
      grossSuppressedReward: 7_000,
      replacementReward: 0,
      netSuppressedReward: 7_000,
    });
    expect(
      calculation.capSuppressions[0]?.causes.map((cause) => [
        cause.capType,
        cause.rewardBeforeCap,
        cause.rewardAfterCap,
      ]),
    ).toEqual([
      ['per_transaction', 10_000, 8_000],
      ['monthly_category', 8_000, 5_000],
      ['monthly_total', 5_000, 3_000],
    ]);
  });

  test('reserves one fixed-per-day counterfactual without changing actual rewards', () => {
    const card = makeCard('fixed-per-day-card', [
      fixedPerDayRule('daily-capped', 5_000, 0),
      percentageRule('fallback', 2, { category: '*' }),
    ]);
    const transactions = [
      makeTransaction('same-day-one', 50_000, 'a-one'),
      makeTransaction('same-day-two', 50_000, 'b-two'),
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(2_000);
    expect(
      calculation.capSuppressions.map((suppression) => ({
        transactionId: suppression.transactionId,
        counterfactualReward: suppression.counterfactualReward,
        actualReward: suppression.actualReward,
        netSuppressedReward: suppression.netSuppressedReward,
      })),
    ).toEqual([
      {
        transactionId: 'same-day-one',
        counterfactualReward: 5_000,
        actualReward: 1_000,
        netSuppressedReward: 4_000,
      },
    ]);
    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(2_000);
    expect(result.portfolioCapLosses).toHaveLength(1);
    expect(result.portfolioCapLosses?.[0]).toMatchObject({
      transactionId: 'same-day-one',
      grossSuppressedReward: 5_000,
      replacementReward: 1_000,
      netLostReward: 4_000,
    });
  });

  test('does not reuse maxUses or fixed-per-day benefits earned normally', () => {
    const limited = percentageRule('limited-earned', 10, {
      monthlyCap: 5_000,
    });
    limited.conditions = { maxUses: 1, usePeriod: 'month' };
    const cards = [
      makeCard('earned-max-uses-card', [
        limited,
        percentageRule('max-uses-fallback', 2, { category: '*' }),
      ]),
      makeCard('earned-fixed-day-card', [
        fixedPerDayRule('fixed-earned', 5_000, 5_000),
        percentageRule('fixed-fallback', 2, { category: '*' }),
      ]),
    ];
    const transactions = [
      makeTransaction('earned-one', 50_000, 'a-one'),
      makeTransaction('earned-two', 50_000, 'b-two'),
    ];

    for (const card of cards) {
      const calculation = calculateRewards({
        transactions,
        previousMonthSpending: 0,
        cardRule: card,
      });
      expect(calculation.totalReward).toBe(6_000);
      expect(calculation.capSuppressionsComplete).toBe(true);
      expect(calculation.capSuppressions).toEqual([]);

      const result = optimize(transactions, [card]);
      expect(result.totalReward).toBe(6_000);
      expect(result.portfolioCapLosses).toEqual([]);
    }
  });

  test('marks cross-card stateful reconciliation unknown when actual use occurs later', () => {
    const limited = percentageRule('limited-primary', 10, {
      perTransactionCap: 3_000,
    });
    limited.conditions = { maxUses: 1, usePeriod: 'month' };
    const capped = makeCard('a-limited-card', [limited]);
    const firstOnly = percentageRule('first-only-replacement', 8);
    firstOnly.conditions = { specificMerchants: ['a-first'] };
    const replacement = makeCard('b-replacement-card', [firstOnly]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [capped, replacement]);
    expect(result.totalReward).toBe(7_000);
    expect(result.portfolioCapLosses).toBeUndefined();
  });

  test('marks a cross-card cap candidate unknown when reassignment frees the selected card state', () => {
    const selectedLimited = percentageRule('selected-limited', 8, {
      priority: 20,
    });
    selectedLimited.conditions = { maxUses: 1, usePeriod: 'month' };
    const selected = makeCard('a-selected', [
      selectedLimited,
      percentageRule('selected-fallback', 10, {
        category: '*',
        priority: 0,
      }),
    ]);
    const firstCapped = percentageRule('first-capped', 10, {
      monthlyCap: 0,
    });
    firstCapped.conditions = { specificMerchants: ['a-first'] };
    const alternative = makeCard('b-capped', [firstCapped]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [selected, alternative]);
    expect(result.totalReward).toBe(9_000);
    expect(result.portfolioCapLosses).toBeUndefined();

    firstCapped.tiers[0]!.monthlyCap = null;
    const capFreeOracle = optimize(transactions, [selected, alternative]);
    expect(capFreeOracle.totalReward).toBe(9_000);
    expect(
      capFreeOracle.cardResults.map(({ cardId, totalReward }) => ({
        cardId,
        totalReward,
      })),
    ).toEqual([
      { cardId: 'a-selected', totalReward: 4_000 },
      { cardId: 'b-capped', totalReward: 5_000 },
    ]);
  });

  test('marks cross-card telemetry unknown when reassignment frees a fixed-per-day use', () => {
    const selected = makeCard('a-selected-fixed-day', [
      fixedPerDayRule('selected-daily', 4_000, null),
      percentageRule('selected-fallback', 10, {
        category: '*',
        priority: 0,
      }),
    ]);
    const firstCapped = percentageRule('first-capped', 10, {
      monthlyCap: 0,
    });
    firstCapped.conditions = { specificMerchants: ['a-first'] };
    const alternative = makeCard('b-capped', [firstCapped]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [selected, alternative]);
    expect(result.totalReward).toBe(9_000);
    expect(result.portfolioCapLosses).toBeUndefined();
  });

  test('marks an equal cross-card stateful tie unknown when it wins cap-free ordering', () => {
    const statefulCapped = percentageRule('stateful-capped', 10, {
      monthlyCap: 0,
      priority: 20,
    });
    statefulCapped.conditions = { maxUses: 1, usePeriod: 'month' };
    const stateful = makeCard('a-stateful', [
      statefulCapped,
      percentageRule('stateful-fallback', 8, {
        category: '*',
        priority: 0,
      }),
    ]);
    const firstOnly = percentageRule('selected-first', 10);
    firstOnly.conditions = { specificMerchants: ['a-first'] };
    const selected = makeCard('b-selected', [firstOnly]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [stateful, selected]);
    expect(result.totalReward).toBe(9_000);
    expect(result.portfolioCapLosses).toBeUndefined();

    statefulCapped.tiers[0]!.monthlyCap = null;
    const capFreeOracle = optimize(transactions, [stateful, selected]);
    expect(capFreeOracle.totalReward).toBe(9_000);
    expect(
      capFreeOracle.cardResults.map(({ cardId, totalReward }) => ({
        cardId,
        totalReward,
      })),
    ).toEqual([
      { cardId: 'a-stateful', totalReward: 9_000 },
    ]);
  });

  test('marks a cross-card winner unknown when it bypasses selected-card counterfactual state', () => {
    const statefulCapped = percentageRule('stateful-capped', 10, {
      monthlyCap: 0,
      priority: 20,
    });
    statefulCapped.conditions = { maxUses: 1, usePeriod: 'month' };
    const selected = makeCard('a-selected', [
      statefulCapped,
      percentageRule('selected-fallback', 8, {
        category: '*',
        priority: 0,
      }),
    ]);
    const firstCapped = percentageRule('first-capped', 12, {
      monthlyCap: 0,
    });
    firstCapped.conditions = { specificMerchants: ['a-first'] };
    const alternative = makeCard('b-alternative', [firstCapped]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [selected, alternative]);
    expect(result.totalReward).toBe(8_000);
    expect(result.portfolioCapLosses).toBeUndefined();

    statefulCapped.tiers[0]!.monthlyCap = null;
    firstCapped.tiers[0]!.monthlyCap = null;
    const capFreeOracle = optimize(transactions, [selected, alternative]);
    expect(capFreeOracle.totalReward).toBe(11_000);
    expect(
      capFreeOracle.cardResults.map(({ cardId, totalReward }) => ({
        cardId,
        totalReward,
      })),
    ).toEqual([
      { cardId: 'a-selected', totalReward: 5_000 },
      { cardId: 'b-alternative', totalReward: 6_000 },
    ]);
  });

  test('observes equal hidden stateful reservations before a cross-card winner', () => {
    const statefulCapped = percentageRule('stateful-capped', 8, {
      monthlyCap: 0,
      priority: 30,
    });
    statefulCapped.conditions = {
      maxUses: 1,
      usePeriod: 'month',
      specificMerchants: ['a-first', 'b-later'],
    };
    const firstFallback = percentageRule('first-fallback', 8, {
      priority: 20,
    });
    firstFallback.conditions = { specificMerchants: ['a-first'] };
    const laterFallback = percentageRule('later-fallback', 2, {
      priority: 20,
    });
    laterFallback.conditions = { specificMerchants: ['b-later'] };
    const selected = makeCard('a-selected', [
      statefulCapped,
      firstFallback,
      laterFallback,
    ]);
    const firstCapped = percentageRule('first-capped', 12, {
      monthlyCap: 0,
    });
    firstCapped.conditions = { specificMerchants: ['a-first'] };
    const alternative = makeCard('b-alternative', [firstCapped]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [selected, alternative]);
    expect(result.totalReward).toBe(5_000);
    expect(result.portfolioCapLosses).toBeUndefined();

    statefulCapped.tiers[0]!.monthlyCap = null;
    firstCapped.tiers[0]!.monthlyCap = null;
    const capFreeOracle = optimize(transactions, [selected, alternative]);
    expect(capFreeOracle.totalReward).toBe(10_000);
    expect(
      capFreeOracle.cardResults.map(({ cardId, totalReward }) => ({
        cardId,
        totalReward,
      })),
    ).toEqual([
      { cardId: 'a-selected', totalReward: 4_000 },
      { cardId: 'b-alternative', totalReward: 6_000 },
    ]);
  });

  test('replays ordered same-card stateful fallbacks instead of maximizing local rows', () => {
    const primary = percentageRule('limited-primary', 10, {
      monthlyCap: 0,
      priority: 20,
    });
    primary.conditions = {
      maxUses: 1,
      usePeriod: 'month',
      specificMerchants: ['a-first', 'b-later'],
    };
    const firstFallback = percentageRule('first-fallback', 8, {
      priority: 10,
    });
    firstFallback.conditions = { specificMerchants: ['a-first'] };
    const laterFallback = percentageRule('later-fallback', 2, {
      priority: 10,
    });
    laterFallback.conditions = { specificMerchants: ['b-later'] };
    const card = makeCard('ordered-stateful-card', [
      primary,
      firstFallback,
      laterFallback,
    ]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(5_000);
    expect(result.portfolioCapLosses).toEqual([
      expect.objectContaining({
        transactionId: 'first',
        counterfactualCardId: 'ordered-stateful-card',
        selectedCardId: 'ordered-stateful-card',
        counterfactualReward: 5_000,
        selectedReward: 4_000,
        netLostReward: 1_000,
      }),
    ]);
  });

  test('does not defer an equal stateful opportunity to manufacture a later loss', () => {
    const primary = percentageRule('limited-primary', 10, {
      monthlyCap: 0,
      priority: 20,
    });
    primary.conditions = {
      maxUses: 1,
      usePeriod: 'month',
      specificMerchants: ['a-first', 'b-later'],
    };
    const equalFirst = percentageRule('equal-first-fallback', 10, {
      priority: 10,
    });
    equalFirst.conditions = { specificMerchants: ['a-first'] };
    const weakerLater = percentageRule('weaker-later-fallback', 2, {
      priority: 10,
    });
    weakerLater.conditions = { specificMerchants: ['b-later'] };
    const card = makeCard('equal-stateful-card', [
      primary,
      equalFirst,
      weakerLater,
    ]);
    const transactions = [
      makeTransaction('equal-first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(6_000);
    expect(result.portfolioCapLosses).toEqual([]);
  });

  test('marks a later negative stateful offset unknown instead of summing only the gain', () => {
    const firstCapped = percentageRule('first-capped', 10, {
      monthlyCap: 0,
      priority: 30,
    });
    firstCapped.conditions = { specificMerchants: ['a-first'] };
    const limited = percentageRule('limited-actual', 8, {
      priority: 20,
    });
    limited.conditions = { maxUses: 1, usePeriod: 'month' };
    const card = makeCard('negative-offset-card', [
      firstCapped,
      limited,
      percentageRule('fallback', 10, {
        category: '*',
        priority: 0,
      }),
    ]);
    const transactions = [
      makeTransaction('first', 50_000, 'a-first'),
      makeTransaction('later', 50_000, 'b-later'),
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(9_000);
    expect(calculation.capSuppressionsComplete).toBe(false);
    expect(calculation.capSuppressions).toHaveLength(1);

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(9_000);
    expect(result.portfolioCapLosses).toBeUndefined();
  });

  test('retains only the winning loss when stateful and nonstateful options share a transaction', () => {
    const limited = percentageRule('limited-primary', 10, {
      monthlyCap: 0,
    });
    limited.conditions = { maxUses: 1, usePeriod: 'month' };
    const selected = makeCard('a-selected-card', [
      limited,
      percentageRule('selected-fallback', 2, { category: '*' }),
    ]);
    const alternative = makeCard('b-alternative-card', [
      percentageRule('alternative-capped', 8, { monthlyCap: 0 }),
    ]);

    const result = optimize(
      [makeTransaction('same-transaction')],
      [selected, alternative],
    );
    expect(result.totalReward).toBe(1_000);
    expect(result.portfolioCapLosses).toEqual([
      expect.objectContaining({
        transactionId: 'same-transaction',
        counterfactualCardId: 'a-selected-card',
        selectedCardId: 'a-selected-card',
        netLostReward: 4_000,
      }),
    ]);
  });

  test('records exact global exhaustion later but no loss on the final exact hit', () => {
    const card = makeCard('global-card', [
      percentageRule('global-benefit', 10),
    ], 5_000);
    const first = makeTransaction('first', 50_000, 'a-first');
    const second = makeTransaction('blocked', 50_000, 'b-blocked');

    const exactOnly = calculateRewards({
      transactions: [first],
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(exactOnly.capSuppressions).toEqual([]);
    expect(exactOnly.capsHit[0]).toMatchObject({
      capType: 'monthly_total',
      actualReward: 5_000,
      appliedReward: 5_000,
    });

    const withLaterSpend = optimize([first, second], [card]);
    expect(withLaterSpend.portfolioCapLosses?.[0]).toMatchObject({
      transactionId: 'blocked',
      netLostReward: 5_000,
      causes: [{
        ruleId: 'global-benefit',
        capGroup: 'global-benefit',
        capType: 'monthly_total',
        capAmount: 5_000,
        rewardBeforeCap: 5_000,
        rewardAfterCap: 0,
      }],
    });
  });

  test('retains global-cap loss for a different unassigned category', () => {
    const card = makeCard('global-wildcard-card', [
      percentageRule('global-wildcard', 10, { category: '*' }),
    ], 5_000);
    const transactions = [
      makeTransaction('dining-exact', 50_000, 'a-dining'),
      {
        ...makeTransaction('grocery-blocked', 50_000, 'b-grocery'),
        category: 'grocery',
      },
    ];

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(5_000);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(result.portfolioCapLosses).toEqual([
      expect.objectContaining({
        transactionId: 'grocery-blocked',
        category: 'grocery',
        selectedCardId: null,
        selectedCardName: null,
        selectedReward: 0,
        netLostReward: 5_000,
        causes: [
          expect.objectContaining({
            ruleId: 'global-wildcard',
            capType: 'monthly_total',
          }),
        ],
      }),
    ]);
  });

  test('reports a declared zero global cap for an all-unassigned portfolio', () => {
    const card = makeCard('zero-global-card', [
      percentageRule('zero-global-benefit', 10),
    ], 0);

    const result = optimize(
      [makeTransaction('zero-global-transaction')],
      [card],
    );
    expect(result.totalReward).toBe(0);
    expect(result.assignments).toEqual([]);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(result.portfolioCapLosses).toEqual([{
      transactionId: 'zero-global-transaction',
      transactionOccurrence: 0,
      category: 'dining',
      counterfactualCardId: 'zero-global-card',
      counterfactualCardName: 'zero-global-card',
      selectedCardId: null,
      selectedCardName: null,
      counterfactualReward: 5_000,
      selectedReward: 0,
      grossSuppressedReward: 5_000,
      replacementReward: 0,
      netLostReward: 5_000,
      causes: [{
        ruleId: 'zero-global-benefit',
        capGroup: 'zero-global-benefit',
        capType: 'monthly_total',
        capAmount: 0,
        rewardBeforeCap: 5_000,
        rewardAfterCap: 0,
      }],
    }]);
  });

  test('keeps duplicate transaction IDs distinct by occurrence without replay duplicates', () => {
    const card = makeCard('per-transaction-card', [
      percentageRule('per-transaction-benefit', 10, {
        perTransactionCap: 5_000,
      }),
    ]);
    const transactions = [
      makeTransaction('duplicate-id', 100_000, 'a-one'),
      makeTransaction('duplicate-id', 100_000, 'b-two'),
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(10_000);
    expect(
      calculation.capSuppressions.map((suppression) =>
        suppression.transactionId
      ),
    ).toEqual(['duplicate-id', 'duplicate-id']);
    expect(
      calculation.capSuppressions.map((suppression) =>
        suppression.causes[0]?.capType
      ),
    ).toEqual(['per_transaction', 'per_transaction']);

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(10_000);
    expect(
      result.portfolioCapLosses?.map((loss) => [
        loss.transactionId,
        loss.transactionOccurrence,
      ]),
    ).toEqual([
      ['duplicate-id', 0],
      ['duplicate-id', 1],
    ]);
  });

  test('records one clipped loss and the later fully blocked loss', () => {
    const card = makeCard('clip-then-block-card', [
      percentageRule('global-benefit', 10),
    ], 5_000);
    const transactions = [
      makeTransaction('clipped-first', 60_000, 'a-first'),
      makeTransaction('blocked-later', 50_000, 'b-later'),
    ];

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(5_000);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(result.cardResults[0]?.capsHit).toEqual([{
      category: 'dining',
      capType: 'monthly_total',
      capAmount: 5_000,
      actualReward: 6_000,
      appliedReward: 5_000,
    }]);
    expect(
      result.portfolioCapLosses?.map((loss) => ({
        transactionId: loss.transactionId,
        grossSuppressedReward: loss.grossSuppressedReward,
        netLostReward: loss.netLostReward,
      })),
    ).toEqual([
      {
        transactionId: 'clipped-first',
        grossSuppressedReward: 1_000,
        netLostReward: 1_000,
      },
      {
        transactionId: 'blocked-later',
        grossSuppressedReward: 5_000,
        netLostReward: 5_000,
      },
    ]);
  });

  test('reserves one maxUses counterfactual without changing actual rewards', () => {
    const occurrenceRule = percentageRule('occurrence-capped', 10, {
      monthlyCap: 0,
    });
    occurrenceRule.conditions = { maxUses: 1, usePeriod: 'month' };
    const card = makeCard('occurrence-card', [
      occurrenceRule,
      percentageRule('fallback', 2, { category: '*' }),
    ]);
    const transactions = [
      makeTransaction('one', 50_000, 'a-one'),
      makeTransaction('two', 50_000, 'b-two'),
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(2_000);
    expect(
      calculation.capSuppressions.map((suppression) => ({
        transactionId: suppression.transactionId,
        actualReward: suppression.actualReward,
        netSuppressedReward: suppression.netSuppressedReward,
      })),
    ).toEqual([
      { transactionId: 'one', actualReward: 1_000, netSuppressedReward: 4_000 },
    ]);
    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(2_000);
    expect(result.portfolioCapLosses).toHaveLength(1);
    expect(result.portfolioCapLosses?.[0]).toMatchObject({
      transactionId: 'one',
      grossSuppressedReward: 5_000,
      replacementReward: 1_000,
      netLostReward: 4_000,
    });

    const clipped = makeCard('clipped-card', [
      percentageRule('clipped', 10, { monthlyCap: 3_000 }),
    ]);
    const clippedResult = optimize(
      [makeTransaction('clipped-transaction')],
      [clipped],
    );
    expect(clippedResult.totalReward).toBe(3_000);
    expect(clippedResult.portfolioCapLosses?.[0]).toMatchObject({
      grossSuppressedReward: 2_000,
      replacementReward: 0,
      netLostReward: 2_000,
    });
  });

  test('marks unassigned and cross-card maxUses opportunities unknown', () => {
    const makeLimitedCard = (id: string) => {
      const primary = percentageRule('limited-primary', 10, {
        monthlyCap: 0,
      });
      primary.conditions = { maxUses: 1, usePeriod: 'month' };
      return makeCard(id, [primary]);
    };
    const transactions = [
      makeTransaction('limited-one', 50_000, 'a-one'),
      makeTransaction('limited-two', 50_000, 'b-two'),
    ];

    const unassigned = optimize(
      transactions,
      [makeLimitedCard('unassigned-limited-card')],
    );
    expect(unassigned.totalReward).toBe(0);
    expect(unassigned.unassignedTransactionCount).toBe(2);
    expect(unassigned.portfolioCapLosses).toBeUndefined();

    const otherCard = makeCard('z-other-card', [
      percentageRule('other-benefit', 2),
    ]);
    const replaced = optimize(
      transactions,
      [makeLimitedCard('a-limited-card'), otherCard],
    );
    expect(replaced.totalReward).toBe(2_000);
    expect(replaced.portfolioCapLosses).toBeUndefined();
  });

  test('does not claim a complete stateful loss after cross-card replacement', () => {
    const primary = percentageRule('limited-primary', 10, {
      monthlyCap: 0,
    });
    primary.conditions = { maxUses: 1, usePeriod: 'month' };
    const capped = makeCard('a-limited-card', [primary]);
    const firstOnly = percentageRule('first-equal', 10);
    firstOnly.conditions = { specificMerchants: ['a-one'] };
    const replacement = makeCard('z-replacement-card', [
      firstOnly,
      percentageRule('later-weaker', 2, { category: '*' }),
    ]);
    const transactions = [
      makeTransaction('equal-first', 50_000, 'a-one'),
      makeTransaction('weaker-later', 50_000, 'b-two'),
    ];

    const result = optimize(transactions, [capped, replacement]);
    expect(result.totalReward).toBe(6_000);
    expect(result.portfolioCapLosses).toBeUndefined();
  });

  test('keeps exact safe-boundary telemetry identical on public and prepared paths', () => {
    const card = makeCard('safe-boundary-card', [
      additiveFixedRule(
        'large-fixed',
        Number.MAX_SAFE_INTEGER - 1,
        Number.MAX_SAFE_INTEGER - 2,
      ),
      additiveFixedRule('one-fixed', 1, 1),
    ]);
    const transactions = [makeTransaction('safe-boundary', 1)];
    const input = {
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    };

    const direct = calculateRewards(input);
    const prepared = calculateRewardsWithPreparedCard({
      transactions,
      previousMonthSpending: 0,
      preparedCardRule: prepareCardRuleForCalculation(card),
    });
    expect(prepared).toEqual(direct);
    expect(direct.capSuppressionsComplete).toBe(true);
    expect(direct.totalReward).toBe(Number.MAX_SAFE_INTEGER - 1);
    expect(direct.capSuppressions).toHaveLength(1);
    expect(direct.capSuppressions[0]).toMatchObject({
      counterfactualReward: Number.MAX_SAFE_INTEGER,
      actualReward: Number.MAX_SAFE_INTEGER - 1,
      grossSuppressedReward: 1,
      replacementReward: 0,
      netSuppressedReward: 1,
    });
  });

  test('marks unrepresentable telemetry unknown without changing actual rewards', () => {
    const card = makeCard('overflow-telemetry-card', [
      additiveFixedRule(
        'max-fixed',
        Number.MAX_SAFE_INTEGER,
        0,
      ),
      additiveFixedRule('overflow-one', 1, 0),
    ]);
    const transactions = [makeTransaction('overflow-telemetry', 1)];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 0,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(0);
    expect(calculation.capSuppressions).toEqual([]);
    expect(calculation.capSuppressionsComplete).toBe(false);

    const result = optimize(transactions, [card]);
    expect(result.totalReward).toBe(0);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(result.portfolioCapLosses).toBeUndefined();
  });

  test('reproduces the live BC Baro Clear Plus exact-cap witness', async () => {
    const card = await loadCardRule(join(
      import.meta.dir,
      '../../rules/data/cards/bc/baro-clear-plus.yaml',
    ));
    const transactions = [
      {
        ...makeTransaction('bc-first', 50_000, '쿠팡 첫 결제'),
        category: 'online_shopping',
      },
      {
        ...makeTransaction('bc-blocked', 50_000, '쿠팡 다음 결제'),
        category: 'online_shopping',
      },
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 150_000,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(5_000);
    expect(calculation.capSuppressions).toEqual([
      expect.objectContaining({
        transactionId: 'bc-blocked',
        counterfactualReward: 5_000,
        actualReward: 0,
        netSuppressedReward: 5_000,
      }),
    ]);

    const result = greedyOptimize(
      buildConstraints(
        transactions,
        new Map([[card.card.id, 150_000]]),
        new Map([['online_shopping', '온라인 쇼핑']]),
      ),
      [card],
    );
    expect(result.totalReward).toBe(5_000);
    expect(result.portfolioCapLosses).toEqual([
      expect.objectContaining({
        counterfactualCardId: 'bc-baro-clear-plus',
        counterfactualReward: 5_000,
        selectedReward: 0,
        netLostReward: 5_000,
      }),
    ]);
  });

  test('reproduces the live Digital Samsung cumulative exact-cap witness', async () => {
    const card = await loadCardRule(join(
      import.meta.dir,
      '../../rules/data/cards/sc/digital-samsung.yaml',
    ));
    const transactions = [
      {
        ...makeTransaction('samsung-seven', 100_000, '온라인 첫 결제'),
        category: 'online_shopping',
        channel: 'online' as const,
        factProvenance: { channel: 'statement' as const },
      },
      {
        ...makeTransaction('samsung-three', 42_858, '온라인 두 번째 결제'),
        category: 'online_shopping',
        channel: 'online' as const,
        factProvenance: { channel: 'statement' as const },
      },
      {
        ...makeTransaction('samsung-blocked', 100_000, '온라인 세 번째 결제'),
        category: 'online_shopping',
        channel: 'online' as const,
        factProvenance: { channel: 'statement' as const },
      },
    ];

    const calculation = calculateRewards({
      transactions,
      previousMonthSpending: 300_000,
      cardRule: card,
    });
    expect(calculation.totalReward).toBe(10_000);
    expect(calculation.capsHit).toContainEqual(expect.objectContaining({
      capType: 'monthly_category',
      actualReward: 3_000,
      appliedReward: 3_000,
    }));
    expect(calculation.capSuppressions).toEqual([
      expect.objectContaining({
        transactionId: 'samsung-blocked',
        counterfactualReward: 7_000,
        actualReward: 0,
        netSuppressedReward: 7_000,
      }),
    ]);
  });
});
