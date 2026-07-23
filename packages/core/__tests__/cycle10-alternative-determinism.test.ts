import { describe, expect, test } from 'bun:test';
import type { CardRuleSet, RewardRule } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import { buildConstraints } from '../src/optimizer/constraints.js';
import { greedyOptimize } from '../src/optimizer/greedy.js';

type StatefulContract =
  | 'max-uses'
  | 'fixed-per-day'
  | 'monthly-category-cap'
  | 'global-cap';

function transaction(
  id: string,
  category: string,
  amount: number,
  date: string,
): CategorizedTransaction {
  return {
    id,
    date,
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
    tiers: [{
      performanceTier: 'tier0',
      rate,
      monthlyCap: null,
      perTransactionCap: null,
    }],
    combination: 'exclusive',
    stackingGroup: id,
    capGroup: id,
    support: { status: 'supported' },
  };
}

function fixedPerDayRule(id: string): RewardRule {
  return {
    id,
    category: '*',
    type: 'discount',
    tiers: [{
      performanceTier: 'tier0',
      rate: null,
      fixedAmount: 1_000,
      unit: 'won_per_day',
      value: { kind: 'fixed_per_day', amount: 1_000 },
      monthlyCap: null,
      perTransactionCap: null,
    }],
    combination: 'exclusive',
    stackingGroup: id,
    capGroup: id,
    support: { status: 'supported' },
  };
}

function card(
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

function candidateCard(contract: StatefulContract): CardRuleSet {
  if (contract === 'fixed-per-day') {
    return card(`candidate-${contract}`, [
      fixedPerDayRule(`candidate-${contract}-reward`),
    ]);
  }

  const rule = percentageRule(`candidate-${contract}-reward`, '*', 10);
  if (contract === 'max-uses') {
    rule.conditions = { maxUses: 2, usePeriod: 'month' };
  } else if (contract === 'monthly-category-cap') {
    rule.tiers[0]!.monthlyCap = 2_000;
  }
  return card(
    `candidate-${contract}`,
    [rule],
    contract === 'global-cap' ? 2_000 : null,
  );
}

function optimize(
  transactions: CategorizedTransaction[],
  cards: CardRuleSet[],
) {
  return greedyOptimize(
    buildConstraints(
      transactions,
      new Map(cards.map((candidate) => [candidate.card.id, 0])),
      new Map([
        ['dining', '외식'],
        ['telecom', '통신'],
      ]),
    ),
    cards,
  );
}

function alternativeReward(
  transactions: CategorizedTransaction[],
  winner: CardRuleSet,
  candidate: CardRuleSet,
): number | undefined {
  const result = optimize(transactions, [winner, candidate]);
  return result.assignments
    .find((assignment) =>
      assignment.category === 'dining' &&
      assignment.assignedCardId === winner.card.id
    )
    ?.alternatives.find((alternative) =>
      alternative.cardId === candidate.card.id
    )
    ?.reward;
}

const positions = [
  {
    position: 'before',
    proposedAmount: 15_000,
    expected: {
      'max-uses': 1_000,
      'fixed-per-day': 1_000,
      'monthly-category-cap': 500,
      'global-cap': 500,
    },
  },
  {
    position: 'between',
    proposedAmount: 7_500,
    expected: {
      'max-uses': 250,
      'fixed-per-day': 1_000,
      'monthly-category-cap': 500,
      'global-cap': 500,
    },
  },
  {
    position: 'after',
    proposedAmount: 2_500,
    expected: {
      'max-uses': undefined,
      'fixed-per-day': 1_000,
      'monthly-category-cap': 250,
      'global-cap': 250,
    },
  },
] as const;

const statefulContracts: StatefulContract[] = [
  'max-uses',
  'fixed-per-day',
  'monthly-category-cap',
  'global-cap',
];

describe('Cycle 10 canonical alternative counterfactuals', () => {
  for (const contract of statefulContracts) {
    for (const position of positions) {
      test(`${contract}: proposed group sorts ${position.position} candidate-owned rows`, () => {
        const winner = card(`winner-${contract}`, [
          percentageRule(`winner-${contract}-dining`, 'dining', 50),
        ]);
        const candidate = candidateCard(contract);
        const input = [
          transaction('candidate-large', 'telecom', 10_000, '2026-07-01'),
          transaction(
            `proposed-${position.position}`,
            'dining',
            position.proposedAmount,
            '2026-07-03',
          ),
          transaction('candidate-small', 'telecom', 5_000, '2026-07-02'),
        ];

        const forward = optimize(input, [winner, candidate]);
        const reverse = optimize([...input].reverse(), [candidate, winner]);
        expect(reverse).toEqual(forward);
        expect(
          alternativeReward(input, winner, candidate),
        ).toBe(position.expected[contract]);
      });
    }
  }

  test('a non-positive signed counterfactual is omitted', () => {
    const winner = card('winner-non-positive', [
      percentageRule('winner-non-positive-dining', 'dining', 50),
    ]);
    const candidateRule = percentageRule(
      'candidate-non-positive-reward',
      '*',
      10,
    );
    candidateRule.conditions = { maxUses: 1, usePeriod: 'month' };
    const candidate = card('candidate-non-positive', [candidateRule]);
    const input = [
      transaction('candidate-owned', 'telecom', 10_000, '2026-07-01'),
      transaction('proposed-after', 'dining', 5_000, '2026-07-02'),
    ];

    expect(() => optimize(input, [winner, candidate])).not.toThrow();
    expect(alternativeReward(input, winner, candidate)).toBeUndefined();
  });
});
