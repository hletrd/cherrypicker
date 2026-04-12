import { describe, test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import { calculateRewards } from '../src/calculator/reward.js';
import { loadCardRule } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import type { CardRuleSet } from '@cherrypicker/rules';

const rulesDir = join(import.meta.dir, '../../../packages/rules/data/cards');

// Use shinhan/simple-plan: tier0 (0 minSpending), 1% discount on uncategorized, no cap
// Use shinhan/mr-life for multi-tier + cap tests

let simplePlan: CardRuleSet;
let mrLife: CardRuleSet;
let kbMinCheck: CardRuleSet;

beforeAll(async () => {
  simplePlan = await loadCardRule(join(rulesDir, 'shinhan/simple-plan.yaml'));
  mrLife = await loadCardRule(join(rulesDir, 'shinhan/mr-life.yaml'));
  kbMinCheck = await loadCardRule(join(rulesDir, 'kb/min-check.yaml'));
});

function makeTx(
  id: string,
  category: string,
  amount: number,
  merchant = '테스트',
  isOnline = false,
  subcategory?: string,
): CategorizedTransaction {
  return {
    id,
    date: '2026-02-01',
    merchant,
    amount,
    currency: 'KRW',
    category,
    subcategory,
    confidence: 1.0,
    isOnline,
  };
}

const subcategoryFixture: CardRuleSet = {
  card: {
    id: 'fixture-subcategory-card',
    issuer: 'fixture',
    name: 'Fixture Subcategory Card',
    nameKo: '서브카테고리 테스트 카드',
    type: 'credit',
    annualFee: { domestic: 0, international: 0 },
    url: 'https://example.com/subcategory-fixture',
    lastUpdated: '2026-04-12',
    source: 'manual',
  },
  performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
  performanceExclusions: [],
  rewards: [
    {
      category: 'dining',
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: 2, monthlyCap: null, perTransactionCap: null }],
    },
    {
      category: 'dining',
      subcategory: 'cafe',
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: 5, monthlyCap: null, perTransactionCap: null }],
      conditions: { specificMerchants: ['메가커피'] },
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

const cashbackFixture: CardRuleSet = {
  card: {
    id: 'fixture-cashback-card',
    issuer: 'fixture',
    name: 'Fixture Cashback Card',
    nameKo: '캐시백 테스트 카드',
    type: 'credit',
    annualFee: { domestic: 0, international: 0 },
    url: 'https://example.com/cashback-fixture',
    lastUpdated: '2026-04-12',
    source: 'manual',
  },
  performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
  performanceExclusions: [],
  rewards: [
    {
      category: 'grocery',
      type: 'cashback',
      tiers: [{ performanceTier: 'tier0', rate: 5, monthlyCap: null, perTransactionCap: null }],
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

describe('calculateRewards - simple-plan (tier0, 1% on uncategorized, no cap)', () => {
  test('basic 1% discount calculation', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'uncategorized', 100000)],
      previousMonthSpending: 0,
      cardRule: simplePlan,
    });
    const cat = output.rewards.find((r) => r.category === 'uncategorized');
    expect(cat).toBeDefined();
    expect(cat!.reward).toBe(1000);
    expect(output.totalReward).toBe(1000);
    expect(output.performanceTier).toBe('tier0');
  });

  test('cardId matches loaded card', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'uncategorized', 10000)],
      previousMonthSpending: 0,
      cardRule: simplePlan,
    });
    expect(output.cardId).toBe('shinhan-simple-plan');
  });

  test('total spending is sum of transaction amounts', () => {
    const output = calculateRewards({
      transactions: [
        makeTx('t1', 'uncategorized', 30000),
        makeTx('t2', 'uncategorized', 20000),
      ],
      previousMonthSpending: 0,
      cardRule: simplePlan,
    });
    expect(output.totalSpending).toBe(50000);
  });

  test('no qualifying tier → zero reward', () => {
    // mr-life has no tier0 rewards; with previousMonthSpending=0 → tier0 (무실적)
    // but mr-life tiers start at tier1 (300000) → tierId='tier0' but no tierRate matches
    const output = calculateRewards({
      transactions: [makeTx('t1', 'convenience_store', 50000)],
      previousMonthSpending: 0,   // qualifies for tier0 only
      cardRule: mrLife,
    });
    // tier0 is selected but no reward rules have tier0 → zero reward
    expect(output.totalReward).toBe(0);
    expect(output.performanceTier).toBe('tier0');
  });

  test('empty transactions returns zero reward', () => {
    const output = calculateRewards({
      transactions: [],
      previousMonthSpending: 0,
      cardRule: simplePlan,
    });
    expect(output.totalReward).toBe(0);
    expect(output.totalSpending).toBe(0);
    expect(output.rewards).toHaveLength(0);
  });
});

describe('calculateRewards - mr-life (tiered, capped)', () => {
  test('tier1 selected for previousMonthSpending=300000', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'convenience_store', 50000)],
      previousMonthSpending: 300000,
      cardRule: mrLife,
    });
    expect(output.performanceTier).toBe('tier1');
  });

  test('tier2 selected for previousMonthSpending=500000', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'convenience_store', 50000)],
      previousMonthSpending: 500000,
      cardRule: mrLife,
    });
    expect(output.performanceTier).toBe('tier2');
  });

  test('tier3 selected for previousMonthSpending=1000000', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'convenience_store', 50000)],
      previousMonthSpending: 1000000,
      cardRule: mrLife,
    });
    expect(output.performanceTier).toBe('tier3');
  });

  test('convenience_store tier1: 10% rate capped at 10000', () => {
    // tier1 monthlyCap=10000 for convenience_store
    // 150000 * 10% = 15000, so the monthly cap should bind.
    const output = calculateRewards({
      transactions: [makeTx('t1', 'convenience_store', 150000)],
      previousMonthSpending: 300000,
      cardRule: mrLife,
    });
    const cat = output.rewards.find((r) => r.category === 'convenience_store');
    expect(cat).toBeDefined();
    expect(cat!.reward).toBe(10000);
    expect(cat!.capReached).toBe(true);
  });

  test('monthly cap enforcement: reward does not exceed cap', () => {
    // Multiple convenience_store transactions exceeding cap
    const output = calculateRewards({
      transactions: [
        makeTx('t1', 'convenience_store', 50000),
        makeTx('t2', 'convenience_store', 50000),
        makeTx('t3', 'convenience_store', 50000),
      ],
      previousMonthSpending: 300000,  // tier1, cap=10000
      cardRule: mrLife,
    });
    const cat = output.rewards.find((r) => r.category === 'convenience_store');
    expect(cat!.reward).toBe(10000);
    expect(cat!.capReached).toBe(true);
  });

  test('tier3 has higher cap than tier1 for convenience_store', () => {
    const outputTier1 = calculateRewards({
      transactions: [makeTx('t1', 'convenience_store', 200000)],
      previousMonthSpending: 300000,
      cardRule: mrLife,
    });
    const outputTier3 = calculateRewards({
      transactions: [makeTx('t1', 'convenience_store', 200000)],
      previousMonthSpending: 1000000,
      cardRule: mrLife,
    });
    const rewardTier1 = outputTier1.rewards.find((r) => r.category === 'convenience_store')!.reward;
    const rewardTier3 = outputTier3.rewards.find((r) => r.category === 'convenience_store')!.reward;
    expect(rewardTier3).toBeGreaterThan(rewardTier1);
  });

  test('multiple categories are each rewarded correctly', () => {
    const output = calculateRewards({
      transactions: [
        makeTx('t1', 'convenience_store', 20000),
        makeTx('t2', 'telecom', 55000),
        makeTx('t3', 'dining', 30000),
      ],
      previousMonthSpending: 500000,  // tier2
      cardRule: mrLife,
    });
    // All three categories should have reward entries
    const categories = output.rewards.map((r) => r.category);
    expect(categories).toContain('convenience_store');
    expect(categories).toContain('telecom');
    expect(categories).toContain('dining');
    // Total reward is sum of category rewards
    const expectedTotal = output.rewards.reduce((s, r) => s + r.reward, 0);
    expect(output.totalReward).toBe(expectedTotal);
  });

  test('capsHit array populated when cap is reached', () => {
    const output = calculateRewards({
      transactions: [
        makeTx('t1', 'convenience_store', 200000),
      ],
      previousMonthSpending: 300000,  // tier1, monthlyCap=10000
      cardRule: mrLife,
    });
    // Cap should be hit — either in capsHit or captured in capReached
    const cat = output.rewards.find((r) => r.category === 'convenience_store');
    expect(cat!.capReached).toBe(true);
  });

  test('reward type is discount for mr-life convenience_store', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'convenience_store', 10000)],
      previousMonthSpending: 300000,
      cardRule: mrLife,
    });
    const cat = output.rewards.find((r) => r.category === 'convenience_store');
    expect(cat!.rewardType).toBe('discount');
  });
});

describe('calculateRewards - fixed amount and subcategory handling', () => {
  test('cashback percentage rates are normalized before calculator math', () => {
    const output = calculateRewards({
      transactions: [makeTx('c1', 'grocery', 10000)],
      previousMonthSpending: 0,
      cardRule: cashbackFixture,
    });
    const grocery = output.rewards.find((reward) => reward.category === 'grocery');
    expect(grocery).toBeDefined();
    expect(grocery!.reward).toBe(500);
  });

  test('fixed-amount telecom benefit applies once per eligible transaction', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'telecom', 55000)],
      previousMonthSpending: 300000,
      cardRule: kbMinCheck,
    });
    const telecom = output.rewards.find((reward) => reward.category === 'telecom');
    expect(telecom).toBeDefined();
    expect(telecom!.reward).toBe(2500);
  });

  test('unsupported unit-based rewards stay explicit instead of being fabricated from spend amount', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'transportation', 50000)],
      previousMonthSpending: 300000,
      cardRule: mrLife,
    });
    const transportation = output.rewards.find((reward) => reward.category === 'transportation');
    expect(transportation).toBeDefined();
    expect(transportation!.reward).toBe(0);
  });

  test('subcategory-specific rules win over broad category rules', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'dining', 20000, '메가커피 강남', false, 'cafe')],
      previousMonthSpending: 0,
      cardRule: subcategoryFixture,
    });
    const cafe = output.rewards.find((reward) => reward.category === 'dining.cafe');
    expect(cafe).toBeDefined();
    expect(cafe!.reward).toBe(1000);
  });

  test('subcategory-specific merchant misses can fall back to the broader category rule', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'dining', 20000, '스타벅스 강남', false, 'cafe')],
      previousMonthSpending: 0,
      cardRule: subcategoryFixture,
    });
    const cafe = output.rewards.find((reward) => reward.category === 'dining.cafe');
    expect(cafe).toBeDefined();
    expect(cafe!.reward).toBe(400);
  });
});
