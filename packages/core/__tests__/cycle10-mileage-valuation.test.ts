import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { loadCardRule } from '@cherrypicker/rules';
import { calculateRewards } from '../src/calculator/reward.js';
import { buildConstraints } from '../src/optimizer/constraints.js';
import { greedyOptimize } from '../src/optimizer/greedy.js';

describe('Cycle 10 mileage valuation boundary', () => {
  test('direct calculator callers cannot turn raw mileage into Won', async () => {
    const card = await loadCardRule(
      join(
        import.meta.dir,
        '../../rules/data/cards/samsung/and-mileage-platinum.yaml',
      ),
    );
    card.rewards[0]!.support = { status: 'supported' };

    const result = calculateRewards({
      transactions: [{
        id: 'mileage-transaction',
        date: '2026-07-24',
        merchant: '국내 가맹점',
        amount: 100_000,
        currency: 'KRW',
        category: 'uncategorized',
        confidence: 1,
      }],
      previousMonthSpending: 0,
      cardRule: card,
    });

    expect(result.totalReward).toBe(0);
    expect(result.unsupportedRules).toEqual([
      expect.objectContaining({
        cardId: 'samsung-and-mileage-platinum',
        transactionId: 'mileage-transaction',
        ruleId: 'reward-001',
        reason: 'unsupported_reward_unit',
        detail: 'mileage reward valuation contract is not modeled',
      }),
    ]);
  });

  test('optimizer callers cannot rank a mileage rule as monetary value', async () => {
    const card = await loadCardRule(
      join(
        import.meta.dir,
        '../../rules/data/cards/samsung/and-mileage-platinum.yaml',
      ),
    );
    card.rewards[0]!.support = { status: 'supported' };
    card.rewards = card.rewards.slice(0, 1);
    const transaction = {
      id: 'mileage-optimizer-transaction',
      date: '2026-07-24',
      merchant: '국내 가맹점',
      amount: 100_000,
      currency: 'KRW',
      category: 'uncategorized',
      confidence: 1,
    } as const;

    const result = greedyOptimize(
      buildConstraints(
        [transaction],
        new Map([[card.card.id, 0]]),
        new Map(),
      ),
      [card],
    );

    expect(result).toMatchObject({
      assignments: [],
      cardResults: [],
      totalReward: 0,
      unassignedSpending: 100_000,
      bestSingleCard: null,
    });
    expect(result.unsupportedRules).toEqual([
      expect.objectContaining({
        transactionId: 'mileage-optimizer-transaction',
        reason: 'unsupported_reward_unit',
      }),
    ]);
  });
});
