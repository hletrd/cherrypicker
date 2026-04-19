/**
 * Unit tests for calculateRewards global cap rollback behavior.
 *
 * When the global cap clips a reward, the rule-level tracker must be rolled
 * back to reflect only what was actually applied. These tests verify the
 * interaction between rule-level caps and global caps.
 */
import { describe, test, expect } from 'bun:test';
import { calculateRewards } from '../src/calculator/reward.js';
import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';

// Build a minimal card rule with configurable rule-level and global caps
function makeCardRule(ruleCap: number | null, globalCap: number | null, rate: number = 10): CardRuleSet {
  return {
    card: {
      id: 'test-card',
      issuer: 'test',
      name: 'Test Card',
      nameKo: '테스트카드',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      url: '',
      lastUpdated: '',
      source: 'manual',
    },
    performanceTiers: [
      { id: 'tier1', label: '기본', minSpending: 0, maxSpending: null },
    ],
    performanceExclusions: [],
    rewards: [
      {
        category: 'dining',
        type: 'discount',
        tiers: [
          {
            performanceTier: 'tier1',
            rate, // percentage form (10 = 10%)
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

function makeTx(id: string, amount: number, category: string = 'dining'): CategorizedTransaction {
  return {
    id,
    date: '2026-03-15',
    merchant: `merchant-${id}`,
    amount,
    currency: 'KRW',
    category,
    subcategory: undefined,
    confidence: 1.0,
  };
}

describe('calculateRewards — global cap rollback', () => {
  test('global cap clips reward and total does not exceed cap', () => {
    // 3 transactions of 1000 Won each at 10% = 100 Won reward each
    // Rule-level cap: unlimited
    // Global cap: 150 Won total
    const rule = makeCardRule(null, 150);
    const txs = [makeTx('t1', 1000), makeTx('t2', 1000), makeTx('t3', 1000)];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    // Total reward should be exactly 150 (global cap)
    expect(result.totalReward).toBe(150);
    const diningReward = result.rewards.find(r => r.category === 'dining');
    expect(diningReward?.reward).toBe(150);
    // Global cap hit should be recorded
    expect(result.capsHit.some(c => c.capType === 'monthly_total')).toBe(true);
  });

  test('rule-level cap and global cap both apply — rule cap is tighter', () => {
    // 3 transactions of 1000 Won each at 10% = 100 Won reward each
    // Rule-level cap: 120 Won
    // Global cap: 200 Won (looser than rule cap)
    const rule = makeCardRule(120, 200);
    const txs = [makeTx('t1', 1000), makeTx('t2', 1000), makeTx('t3', 1000)];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    // Rule cap limits to 120; global cap (200) is not hit
    expect(result.totalReward).toBe(120);
  });

  test('global cap tighter than rule cap rolls back rule tracker correctly', () => {
    // 2 transactions of 1000 Won at 10% = 100 Won each
    // Rule-level cap: 200 (loose)
    // Global cap: 50 (very tight)
    const rule = makeCardRule(200, 50);
    const txs = [makeTx('t1', 1000), makeTx('t2', 1000)];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    // Global cap clips the first transaction from 100 to 50
    // Second transaction gets 0 (global cap exhausted)
    expect(result.totalReward).toBe(50);
    const diningReward = result.rewards.find(r => r.category === 'dining');
    expect(diningReward?.reward).toBe(50);
  });

  test('single transaction exceeding global cap is clipped', () => {
    // 1 transaction of 10000 Won at 10% = 1000 Won reward
    // Global cap: 500
    const rule = makeCardRule(null, 500);
    const txs = [makeTx('t1', 10000)];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    expect(result.totalReward).toBe(500);
  });

  test('no global cap means unlimited rewards', () => {
    // 3 transactions of 10000 Won at 10% = 1000 Won each
    // Global cap: null (unlimited)
    // Rule cap: null (unlimited)
    const rule = makeCardRule(null, null);
    const txs = [makeTx('t1', 10000), makeTx('t2', 10000), makeTx('t3', 10000)];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    expect(result.totalReward).toBe(3000);
    expect(result.capsHit.length).toBe(0);
  });

  test('multiple categories share the global cap', () => {
    // 2 transactions in different categories, each earning 100 Won
    // Global cap: 150
    const rule: CardRuleSet = {
      card: {
        id: 'multi-cat-card',
        issuer: 'test',
        name: 'Multi Cat Card',
        nameKo: '멀티카테고리',
        type: 'credit',
        annualFee: { domestic: 0, international: 0 },
        url: '',
        lastUpdated: '',
        source: 'manual',
      },
      performanceTiers: [
        { id: 'tier1', label: '기본', minSpending: 0, maxSpending: null },
      ],
      performanceExclusions: [],
      rewards: [
        {
          category: 'dining',
          type: 'discount',
          tiers: [{ performanceTier: 'tier1', rate: 10, monthlyCap: null, perTransactionCap: null }],
        },
        {
          category: 'grocery',
          type: 'discount',
          tiers: [{ performanceTier: 'tier1', rate: 10, monthlyCap: null, perTransactionCap: null }],
        },
      ],
      globalConstraints: {
        monthlyTotalDiscountCap: 150,
        minimumAnnualSpending: null,
      },
    };

    const txs = [
      makeTx('t1', 1000, 'dining'),
      makeTx('t2', 1000, 'grocery'),
      makeTx('t3', 1000, 'dining'),
    ];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    // Total across both categories should be clipped to 150
    expect(result.totalReward).toBe(150);
  });
});
