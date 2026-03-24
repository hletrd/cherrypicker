import { describe, test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import { greedyOptimize } from '../src/optimizer/greedy.js';
import { buildConstraints } from '../src/optimizer/constraints.js';
import { loadCardRule } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import type { CardRuleSet } from '@cherrypicker/rules';

const rulesDir = join(import.meta.dir, '../../../packages/rules/data/cards');

let simplePlan: CardRuleSet;
let mrLife: CardRuleSet;

beforeAll(async () => {
  simplePlan = await loadCardRule(join(rulesDir, 'shinhan/simple-plan.yaml'));
  mrLife = await loadCardRule(join(rulesDir, 'shinhan/mr-life.yaml'));
});

function makeTx(
  id: string,
  category: string,
  amount: number,
): CategorizedTransaction {
  return {
    id,
    date: '2026-02-01',
    merchant: category,
    amount,
    currency: 'KRW',
    category,
    confidence: 1.0,
  };
}

describe('greedyOptimize - basic', () => {
  test('returns result with assignments array', () => {
    const constraints = {
      cards: [{ cardId: 'shinhan-simple-plan', previousMonthSpending: 0 }],
      categorySpending: new Map([['uncategorized', 100000]]),
    };
    const result = greedyOptimize(constraints, [simplePlan]);
    expect(result.assignments).toBeDefined();
    expect(Array.isArray(result.assignments)).toBe(true);
  });

  test('single card — all categories assigned to it', () => {
    const constraints = {
      cards: [{ cardId: 'shinhan-simple-plan', previousMonthSpending: 0 }],
      categorySpending: new Map([
        ['uncategorized', 50000],
        ['dining', 30000],
      ]),
    };
    const result = greedyOptimize(constraints, [simplePlan]);
    for (const assignment of result.assignments) {
      expect(assignment.assignedCardId).toBe('shinhan-simple-plan');
    }
  });

  test('totalSpending equals sum of categorySpending values', () => {
    const constraints = {
      cards: [{ cardId: 'shinhan-simple-plan', previousMonthSpending: 0 }],
      categorySpending: new Map([
        ['uncategorized', 50000],
        ['dining', 30000],
      ]),
    };
    const result = greedyOptimize(constraints, [simplePlan]);
    expect(result.totalSpending).toBe(80000);
  });

  test('totalReward equals sum of assignment rewards', () => {
    const constraints = {
      cards: [{ cardId: 'shinhan-simple-plan', previousMonthSpending: 0 }],
      categorySpending: new Map([['uncategorized', 100000]]),
    };
    const result = greedyOptimize(constraints, [simplePlan]);
    const sumRewards = result.assignments.reduce((s, a) => s + a.reward, 0);
    expect(result.totalReward).toBe(sumRewards);
  });

  test('effectiveRate = totalReward / totalSpending', () => {
    const constraints = {
      cards: [{ cardId: 'shinhan-simple-plan', previousMonthSpending: 0 }],
      categorySpending: new Map([['uncategorized', 100000]]),
    };
    const result = greedyOptimize(constraints, [simplePlan]);
    const expectedRate = result.totalSpending > 0
      ? result.totalReward / result.totalSpending
      : 0;
    expect(result.effectiveRate).toBeCloseTo(expectedRate, 10);
  });

  test('categories with zero spending are skipped', () => {
    const constraints = {
      cards: [{ cardId: 'shinhan-simple-plan', previousMonthSpending: 0 }],
      categorySpending: new Map([
        ['uncategorized', 100000],
        ['dining', 0],
      ]),
    };
    const result = greedyOptimize(constraints, [simplePlan]);
    const diningAssignment = result.assignments.find((a) => a.category === 'dining');
    expect(diningAssignment).toBeUndefined();
  });
});

describe('greedyOptimize - two cards', () => {
  test('each category gets assigned to one card', () => {
    const constraints = {
      cards: [
        { cardId: 'shinhan-simple-plan', previousMonthSpending: 0 },
        { cardId: 'shinhan-mr-life', previousMonthSpending: 500000 },
      ],
      categorySpending: new Map([
        ['convenience_store', 50000],
        ['uncategorized', 100000],
      ]),
    };
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    expect(result.assignments).toHaveLength(2);
    for (const a of result.assignments) {
      expect(['shinhan-simple-plan', 'shinhan-mr-life']).toContain(a.assignedCardId);
    }
  });

  test('alternatives array contains the non-chosen card', () => {
    const constraints = {
      cards: [
        { cardId: 'shinhan-simple-plan', previousMonthSpending: 0 },
        { cardId: 'shinhan-mr-life', previousMonthSpending: 500000 },
      ],
      categorySpending: new Map([['convenience_store', 50000]]),
    };
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    const assignment = result.assignments[0];
    expect(assignment?.alternatives).toHaveLength(1);
  });

  test('cardResults contains entries for cards that have assignments', () => {
    const constraints = {
      cards: [
        { cardId: 'shinhan-simple-plan', previousMonthSpending: 0 },
        { cardId: 'shinhan-mr-life', previousMonthSpending: 500000 },
      ],
      categorySpending: new Map([
        ['convenience_store', 50000],
        ['uncategorized', 100000],
      ]),
    };
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    // All assigned cards should appear in cardResults
    const assignedCardIds = new Set(result.assignments.map((a) => a.assignedCardId));
    const cardResultIds = new Set(result.cardResults.map((r) => r.cardId));
    for (const id of assignedCardIds) {
      expect(cardResultIds.has(id)).toBe(true);
    }
  });

  test('savingsVsSingleCard = totalReward - bestSingleCard.totalReward', () => {
    const constraints = {
      cards: [
        { cardId: 'shinhan-simple-plan', previousMonthSpending: 0 },
        { cardId: 'shinhan-mr-life', previousMonthSpending: 1000000 },
      ],
      categorySpending: new Map([
        ['convenience_store', 100000],
        ['uncategorized', 100000],
      ]),
    };
    const result = greedyOptimize(constraints, [simplePlan, mrLife]);
    const expected = result.totalReward - result.bestSingleCard.totalReward;
    expect(result.savingsVsSingleCard).toBeCloseTo(expected, 0);
  });

  test('bestSingleCard has a non-empty cardId', () => {
    const constraints = {
      cards: [
        { cardId: 'shinhan-simple-plan', previousMonthSpending: 0 },
        { cardId: 'shinhan-mr-life', previousMonthSpending: 500000 },
      ],
      categorySpending: new Map([['uncategorized', 100000]]),
    };
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
});
