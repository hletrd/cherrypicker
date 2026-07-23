import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  isOptimizationExecutableCard,
  isRecommendationEligibleCard,
  loadOptimizerCatalogArtifact,
  type CardRuleSet,
} from '@cherrypicker/rules';
import {
  buildConstraints,
  greedyOptimize,
  type CategorizedTransaction,
} from '../src/index.js';

function transaction(
  id: string,
  category: string,
  amount: number,
): CategorizedTransaction {
  return {
    id,
    date: '2026-07-24',
    merchant: `merchant-${id}`,
    amount,
    currency: 'KRW',
    category,
    confidence: 1,
  };
}

function card(options: {
  id: string;
  category?: string;
  rate?: number;
  support?: 'supported' | 'unsupported';
}): CardRuleSet {
  const {
    id,
    category = 'dining',
    rate = 10,
    support = 'supported',
  } = options;
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
        id: `${id}-reward`,
        category,
        type: 'discount',
        tiers: [
          {
            performanceTier: 'tier0',
            rate,
            value: { kind: 'percentage', amount: rate },
            monthlyCap: null,
            perTransactionCap: null,
          },
        ],
        priority: 0,
        combination: 'exclusive',
        stackingGroup: `${id}-stack`,
        capGroup: `${id}-cap`,
        support: support === 'supported'
          ? { status: 'supported' }
          : {
              status: 'unsupported',
              reason: 'fixture requires an unmodeled fact',
            },
      },
    ],
    globalConstraints: {
      monthlyTotalDiscountCap: null,
      minimumAnnualSpending: null,
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
      new Map(cards.map((candidate) => [candidate.card.id, 0])),
      new Map([
        ['dining', '외식'],
        ['grocery', '식료품'],
      ]),
    ),
    cards,
  );
}

describe('optimizer executable-benefit contract', () => {
  test('keeps an unsupported-only active card visible but out of scoring', () => {
    const unsupported = card({
      id: 'unsupported-only',
      support: 'unsupported',
    });

    expect(isRecommendationEligibleCard(unsupported)).toBe(true);
    expect(isOptimizationExecutableCard(unsupported)).toBe(false);

    const result = optimize(
      [transaction('unsupported-input', 'dining', 10_000)],
      [unsupported],
    );

    expect(result).toMatchObject({
      assignments: [],
      cardResults: [],
      totalReward: 0,
      totalSpending: 10_000,
      unassignedSpending: 10_000,
      unassignedTransactionCount: 1,
      effectiveRate: 0,
      savingsVsSingleCard: 0,
      bestSingleCard: null,
    });
  });

  test.each([
    [
      'a supported rule does not match',
      card({ id: 'grocery-only', category: 'grocery' }),
      transaction('dining-input', 'dining', 10_000),
    ],
    [
      'the calculated reward rounds down to zero Won',
      card({ id: 'fractional', rate: 0.1 }),
      transaction('one-won-input', 'dining', 1),
    ],
  ])('%s', (_label, candidate, input) => {
    const result = optimize([input], [candidate]);

    expect(result.assignments).toEqual([]);
    expect(result.cardResults).toEqual([]);
    expect(result.totalReward).toBe(0);
    expect(result.totalSpending).toBe(input.amount);
    expect(result.unassignedSpending).toBe(input.amount);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(result.bestSingleCard).toBeNull();
    expect(result.savingsVsSingleCard).toBe(0);
  });

  test('includes mixed assigned and unassigned spending in result invariants', () => {
    const dining = card({ id: 'dining-positive', rate: 10 });
    const result = optimize(
      [
        transaction('positive', 'dining', 1_000),
        transaction('no-benefit', 'grocery', 2_000),
      ],
      [dining],
    );

    const assignmentSpending = result.assignments.reduce(
      (sum, assignment) => sum + assignment.spending,
      0,
    );
    const cardResultSpending = result.cardResults.reduce(
      (sum, cardResult) => sum + cardResult.totalSpending,
      0,
    );

    expect(result.assignments).toHaveLength(1);
    expect(result.totalReward).toBe(100);
    expect(result.totalSpending).toBe(3_000);
    expect(result.unassignedSpending).toBe(2_000);
    expect(result.unassignedTransactionCount).toBe(1);
    expect(assignmentSpending + result.unassignedSpending).toBe(
      result.totalSpending,
    );
    expect(cardResultSpending + result.unassignedSpending).toBe(
      result.totalSpending,
    );
    expect(result.effectiveRate).toBe(result.totalReward / result.totalSpending);
    expect(result.bestSingleCard).toMatchObject({
      cardId: dining.card.id,
      totalReward: 100,
    });
    expect(result.savingsVsSingleCard).toBe(0);
  });

  test('omits zero-benefit alternatives and is deterministic across card order', () => {
    const winner = card({ id: 'winner', rate: 10 });
    const positiveAlternative = card({ id: 'positive-alt', rate: 5 });
    const noMatch = card({ id: 'no-match', category: 'grocery', rate: 50 });
    const unsupported = card({
      id: 'unsupported',
      rate: 100,
      support: 'unsupported',
    });
    const input = [transaction('ordered', 'dining', 10_000)];
    const forward = optimize(
      input,
      [winner, noMatch, unsupported, positiveAlternative],
    );
    const reverse = optimize(
      input,
      [positiveAlternative, unsupported, noMatch, winner],
    );

    expect(reverse).toEqual(forward);
    expect(forward.assignments[0]?.alternatives).toEqual([
      {
        cardId: positiveAlternative.card.id,
        cardName: positiveAlternative.card.nameKo,
        reward: 500,
        rate: 0.05,
      },
    ]);
  });

  test(
    'the full published unsupported-only subset cannot produce a winner',
    async () => {
      const artifact = await loadOptimizerCatalogArtifact(
        join(
          import.meta.dir,
          '../../../apps/web/public/data/cards-optimizer.json',
        ),
      );
      const unsupportedOnly = artifact.cards.filter((candidate) =>
        !isOptimizationExecutableCard(candidate)
      );

      expect(unsupportedOnly.length).toBeGreaterThan(0);
      expect(
        unsupportedOnly.every(isRecommendationEligibleCard),
      ).toBe(true);

      const result = optimize(
        [transaction('artifact-input', 'uncategorized', 1)],
        unsupportedOnly,
      );
      expect(result.assignments).toEqual([]);
      expect(result.cardResults).toEqual([]);
      expect(result.bestSingleCard).toBeNull();
      expect(result.unassignedSpending).toBe(1);
      expect(result.unassignedTransactionCount).toBe(1);
    },
    30_000,
  );
});
