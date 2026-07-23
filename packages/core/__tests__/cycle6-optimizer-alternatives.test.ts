import { describe, expect, test } from 'bun:test';
import type { CardRuleSet, RewardRule } from '@cherrypicker/rules';
import { buildConstraints } from '../src/optimizer/constraints.js';
import { greedyOptimize } from '../src/optimizer/greedy.js';
import type { CategorizedTransaction } from '../src/models/transaction.js';

function makeTransaction(
  id: string,
  category: string,
  amount = 10_000,
): CategorizedTransaction {
  return {
    id,
    date: '2026-07-01',
    merchant: id,
    amount,
    currency: 'KRW',
    category,
    confidence: 1,
  };
}

function percentageRule(
  id: string,
  category: string,
  rate: number,
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

function alternativeReward(
  transactions: CategorizedTransaction[],
  winner: CardRuleSet,
  candidate: CardRuleSet,
  category: string,
): number | undefined {
  const constraints = buildConstraints(
    transactions,
    new Map([
      [winner.card.id, 0],
      [candidate.card.id, 0],
    ]),
    new Map(),
  );
  const result = greedyOptimize(constraints, [winner, candidate]);
  return result.assignments
    .find((assignment) =>
      assignment.category === category &&
      assignment.assignedCardId === winner.card.id
    )
    ?.alternatives.find((alternative) =>
      alternative.cardId === candidate.card.id
    )
    ?.reward;
}

describe('greedyOptimize - whole-group alternative counterfactuals', () => {
  test('applies a candidate monthly cap once to the whole group', () => {
    const winner = makeCard(
      'winner-monthly',
      [percentageRule('winner-dining', 'dining', 20)],
    );
    const candidateRule = percentageRule(
      'candidate-dining',
      'dining',
      10,
    );
    candidateRule.tiers[0]!.monthlyCap = 1_000;
    const candidate = makeCard('candidate-monthly', [candidateRule]);

    expect(alternativeReward([
      makeTransaction('monthly-a', 'dining'),
      makeTransaction('monthly-b', 'dining'),
    ], winner, candidate, 'dining')).toBe(1_000);
  });

  test('applies a candidate global cap once to the whole group', () => {
    const winner = makeCard(
      'winner-global',
      [percentageRule('winner-dining', 'dining', 20)],
    );
    const candidate = makeCard(
      'candidate-global',
      [percentageRule('candidate-dining', 'dining', 10)],
      1_000,
    );

    expect(alternativeReward([
      makeTransaction('global-a', 'dining'),
      makeTransaction('global-b', 'dining'),
    ], winner, candidate, 'dining')).toBe(1_000);
  });

  test('applies candidate maxUses across the whole group', () => {
    const winner = makeCard(
      'winner-uses',
      [percentageRule('winner-dining', 'dining', 20)],
    );
    const candidateRule = percentageRule('candidate-once', 'dining', 10);
    candidateRule.conditions = { maxUses: 1, usePeriod: 'month' };
    const candidate = makeCard('candidate-uses', [candidateRule]);

    expect(alternativeReward([
      makeTransaction('uses-a', 'dining'),
      makeTransaction('uses-b', 'dining'),
    ], winner, candidate, 'dining')).toBe(1_000);
  });

  test('applies fixed-per-day rewards once to a same-day group', () => {
    const winner = makeCard(
      'winner-daily',
      [percentageRule('winner-dining', 'dining', 20)],
    );
    const candidate = makeCard('candidate-daily', [{
      id: 'candidate-fixed-day',
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
    }]);

    expect(alternativeReward([
      makeTransaction('daily-a', 'dining'),
      makeTransaction('daily-b', 'dining'),
    ], winner, candidate, 'dining')).toBe(1_000);
  });

  test('starts from the candidate card final state after it wins another group', () => {
    const winner = makeCard('winner-existing-state', [
      percentageRule('winner-dining', 'dining', 20),
    ]);
    const candidate = makeCard(
      'candidate-existing-state',
      [
        percentageRule('candidate-telecom', 'telecom', 20),
        percentageRule('candidate-wildcard', '*', 10),
      ],
      1_500,
    );
    const transactions = [
      makeTransaction('dining-winner', 'dining', 10_000),
      makeTransaction('telecom-winner', 'telecom', 5_000),
    ];
    const constraints = buildConstraints(
      transactions,
      new Map([
        [winner.card.id, 0],
        [candidate.card.id, 0],
      ]),
      new Map(),
    );

    const result = greedyOptimize(constraints, [winner, candidate]);
    const dining = result.assignments.find((assignment) =>
      assignment.category === 'dining'
    );
    const telecom = result.assignments.find((assignment) =>
      assignment.category === 'telecom'
    );

    expect(dining?.assignedCardId).toBe(winner.card.id);
    expect(telecom?.assignedCardId).toBe(candidate.card.id);
    expect(dining?.alternatives.find((alternative) =>
      alternative.cardId === candidate.card.id
    )).toMatchObject({
      reward: 500,
      rate: 0.05,
    });
  });
});
