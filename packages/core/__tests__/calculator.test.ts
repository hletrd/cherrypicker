import { describe, test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import { calculateRewards } from '../src/calculator/reward.js';
import { loadCardRule } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import type { CardRuleSet } from '@cherrypicker/rules';

// NOTE: Reward rate values in test fixtures use percentage form
// (e.g., rate: 2 means 2%, rate: 5 means 5%) matching YAML convention.
// calculateRewards() normalizes these via normalizeRate (divides by 100).

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

const globalCapFixture: CardRuleSet = {
  card: {
    id: 'fixture-global-cap-card',
    issuer: 'fixture',
    name: 'Fixture Global Cap Card',
    nameKo: '글로벌캡 테스트 카드',
    type: 'credit',
    annualFee: { domestic: 0, international: 0 },
    url: 'https://example.com/global-cap-fixture',
    lastUpdated: '2026-04-19',
    source: 'manual',
  },
  performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
  performanceExclusions: [],
  rewards: [
    {
      category: 'dining',
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: 5, monthlyCap: 3000, perTransactionCap: null }],
    },
    {
      category: 'grocery',
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: 3, monthlyCap: null, perTransactionCap: null }],
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: 5000,
    minimumAnnualSpending: null,
  },
};

const perTxCapFixture: CardRuleSet = {
  card: {
    id: 'fixture-per-tx-cap-card',
    issuer: 'fixture',
    name: 'Fixture Per-Tx Cap Card',
    nameKo: '건당상한 테스트 카드',
    type: 'credit',
    annualFee: { domestic: 0, international: 0 },
    url: 'https://example.com/per-tx-cap-fixture',
    lastUpdated: '2026-04-19',
    source: 'manual',
  },
  performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
  performanceExclusions: [],
  rewards: [
    {
      category: 'dining',
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: 10, monthlyCap: null, perTransactionCap: 50000 }],
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

const nullRateFixture: CardRuleSet = {
  card: {
    id: 'fixture-null-rate-card',
    issuer: 'fixture',
    name: 'Fixture Null Rate Card',
    nameKo: 'null rate 테스트 카드',
    type: 'credit',
    annualFee: { domestic: 0, international: 0 },
    url: 'https://example.com/null-rate-fixture',
    lastUpdated: '2026-04-19',
    source: 'manual',
  },
  performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
  performanceExclusions: [],
  rewards: [
    {
      category: 'dining',
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: null, monthlyCap: null, perTransactionCap: null }],
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

const fixedRewardPerDayFixture: CardRuleSet = {
  card: {
    id: 'fixture-fixed-per-day-card',
    issuer: 'fixture',
    name: 'Fixture Fixed Per Day Card',
    nameKo: '일일 고정 테스트 카드',
    type: 'credit',
    annualFee: { domestic: 0, international: 0 },
    url: 'https://example.com/fixed-per-day-fixture',
    lastUpdated: '2026-04-19',
    source: 'manual',
  },
  performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
  performanceExclusions: [],
  rewards: [
    {
      category: 'telecom',
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: null, fixedAmount: 3000, unit: 'won_per_day', monthlyCap: null, perTransactionCap: null }],
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

const mileageFixture: CardRuleSet = {
  card: {
    id: 'fixture-mileage-card',
    issuer: 'fixture',
    name: 'Fixture Mileage Card',
    nameKo: '마일리지 테스트 카드',
    type: 'credit',
    annualFee: { domestic: 0, international: 0 },
    url: 'https://example.com/mileage-fixture',
    lastUpdated: '2026-04-19',
    source: 'manual',
  },
  performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
  performanceExclusions: [],
  rewards: [
    {
      category: 'travel',
      type: 'mileage',
      tiers: [{ performanceTier: 'tier0', rate: 2, monthlyCap: null, perTransactionCap: null }],
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

describe('calculateRewards - global cap and per-transaction cap', () => {
  test('global cap enforcement: reward does not exceed globalMonthlyTotalDiscountCap', () => {
    // dining 5% of 60000 = 3000 (exactly at rule monthlyCap)
    // grocery 3% of 100000 = 3000
    // Total raw = 6000, but global cap = 5000
    const output = calculateRewards({
      transactions: [
        makeTx('t1', 'dining', 60000),
        makeTx('t2', 'grocery', 100000),
      ],
      previousMonthSpending: 0,
      cardRule: globalCapFixture,
    });
    expect(output.totalReward).toBe(5000);
  });

  test('global cap tracks remaining correctly across categories', () => {
    // dining 5% of 40000 = 2000 (under rule cap of 3000)
    // grocery 3% of 200000 = 6000
    // Total raw = 8000, but global cap = 5000
    // dining takes 2000, grocery gets min(6000, 5000-2000) = 3000
    const output = calculateRewards({
      transactions: [
        makeTx('t1', 'dining', 40000),
        makeTx('t2', 'grocery', 200000),
      ],
      previousMonthSpending: 0,
      cardRule: globalCapFixture,
    });
    expect(output.totalReward).toBe(5000);
    const dining = output.rewards.find((r) => r.category === 'dining');
    expect(dining!.reward).toBe(2000);
  });

  test('per-transaction cap: reward amount capped per transaction', () => {
    // 10% of 100000 = 10000, but perTransactionCap=50000 → 10% of 50000 = 5000
    const output = calculateRewards({
      transactions: [makeTx('t1', 'dining', 100000)],
      previousMonthSpending: 0,
      cardRule: perTxCapFixture,
    });
    const dining = output.rewards.find((r) => r.category === 'dining');
    expect(dining!.reward).toBe(5000);
  });

  test('per-transaction cap does not affect transactions under cap', () => {
    // 10% of 30000 = 3000, perTransactionCap=50000 → no binding
    const output = calculateRewards({
      transactions: [makeTx('t1', 'dining', 30000)],
      previousMonthSpending: 0,
      cardRule: perTxCapFixture,
    });
    const dining = output.rewards.find((r) => r.category === 'dining');
    expect(dining!.reward).toBe(3000);
  });
});

describe('calculateRewards - filtering and edge cases', () => {
  test('negative amount transactions are skipped', () => {
    const output = calculateRewards({
      transactions: [
        makeTx('t1', 'uncategorized', 100000),
        makeTx('t2', 'uncategorized', -50000),
      ],
      previousMonthSpending: 0,
      cardRule: simplePlan,
    });
    // Only the positive transaction should count
    expect(output.totalSpending).toBe(100000);
    expect(output.totalReward).toBe(1000);
  });

  test('zero amount transactions are skipped', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'uncategorized', 0)],
      previousMonthSpending: 0,
      cardRule: simplePlan,
    });
    expect(output.totalReward).toBe(0);
    expect(output.rewards).toHaveLength(0);
  });

  test('non-KRW currency transactions are skipped', () => {
    const tx: CategorizedTransaction = {
      id: 't1',
      date: '2026-02-01',
      merchant: '테스트',
      amount: 100000,
      currency: 'USD',
      category: 'uncategorized',
      subcategory: undefined,
      confidence: 1.0,
    };
    const output = calculateRewards({
      transactions: [tx],
      previousMonthSpending: 0,
      cardRule: simplePlan,
    });
    expect(output.totalReward).toBe(0);
  });

  test('rule with null rate and null fixedAmount produces 0 reward', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'dining', 100000)],
      previousMonthSpending: 0,
      cardRule: nullRateFixture,
    });
    const dining = output.rewards.find((r) => r.category === 'dining');
    expect(dining).toBeDefined();
    expect(dining!.reward).toBe(0);
  });

  test('normalizeRate: percentage form (5) is converted to decimal (0.05)', () => {
    // 5% rate on 10000 = 500 reward
    const output = calculateRewards({
      transactions: [makeTx('t1', 'dining', 10000)],
      previousMonthSpending: 0,
      cardRule: subcategoryFixture,  // dining rate=2 → 200, cafe rate=5
    });
    const dining = output.rewards.find((r) => r.category === 'dining');
    expect(dining!.reward).toBe(200); // 10000 * 0.02 = 200
  });
});

describe('calculateRewards - fixed reward types', () => {
  test('won_per_day unit: fixed amount applies only once per day', () => {
    const output = calculateRewards({
      transactions: [
        { ...makeTx('t1', 'telecom', 55000), date: '2026-02-01' },
        { ...makeTx('t2', 'telecom', 30000), date: '2026-02-01' },
        { ...makeTx('t3', 'telecom', 40000), date: '2026-02-02' },
      ],
      previousMonthSpending: 0,
      cardRule: fixedRewardPerDayFixture,
    });
    // Day 1: first tx gets 3000, second tx gets 0 (same day)
    // Day 2: gets 3000
    const telecom = output.rewards.find((r) => r.category === 'telecom');
    expect(telecom!.reward).toBe(6000);
  });

  test('mileage type uses same math as points', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'travel', 50000)],
      previousMonthSpending: 0,
      cardRule: mileageFixture,
    });
    // 2% of 50000 = 1000
    const travel = output.rewards.find((r) => r.category === 'travel');
    expect(travel!.reward).toBe(1000);
    expect(travel!.rewardType).toBe('mileage');
  });
});

describe('calculateRewards - multiple transactions accumulating toward monthly cap', () => {
  test('monthly cap accumulation across multiple transactions', () => {
    // mr-life tier1: convenience_store rate=10%, monthlyCap=10000
    // tx1: 50000 * 10% = 5000 (remaining cap: 5000)
    // tx2: 30000 * 10% = 3000 (but only 5000 remaining → 3000 fits)
    // tx3: 50000 * 10% = 5000 (but only 2000 remaining → 2000)
    const output = calculateRewards({
      transactions: [
        makeTx('t1', 'convenience_store', 50000),
        makeTx('t2', 'convenience_store', 30000),
        makeTx('t3', 'convenience_store', 50000),
      ],
      previousMonthSpending: 300000,
      cardRule: mrLife,
    });
    const cat = output.rewards.find((r) => r.category === 'convenience_store');
    expect(cat!.reward).toBe(10000);
    expect(cat!.capReached).toBe(true);
  });
});

describe('calculateRewards - broad category rule blocked by subcategorized transaction', () => {
  test('broad dining rule does not match cafe subcategory transaction', () => {
    const broadOnlyFixture: CardRuleSet = {
      card: {
        id: 'fixture-broad-only-card',
        issuer: 'fixture',
        name: 'Fixture Broad Only Card',
        nameKo: '일반 외식 전용 카드',
        type: 'credit',
        annualFee: { domestic: 0, international: 0 },
        url: 'https://example.com/broad-only-fixture',
        lastUpdated: '2026-04-19',
        source: 'manual',
      },
      performanceTiers: [{ id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null }],
      performanceExclusions: [],
      rewards: [
        {
          category: 'dining',
          type: 'discount',
          tiers: [{ performanceTier: 'tier0', rate: 5, monthlyCap: null, perTransactionCap: null }],
        },
      ],
      globalConstraints: {
        monthlyTotalDiscountCap: null,
        minimumAnnualSpending: null,
      },
    };
    // Transaction with subcategory='cafe' should NOT match the broad dining rule
    const output = calculateRewards({
      transactions: [makeTx('t1', 'dining', 20000, '스타벅스', false, 'cafe')],
      previousMonthSpending: 0,
      cardRule: broadOnlyFixture,
    });
    const cafe = output.rewards.find((r) => r.category === 'dining.cafe');
    expect(cafe).toBeDefined();
    expect(cafe!.reward).toBe(0);
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

  test('subcategory-specific merchant misses result in 0 reward when broad rule is blocked', () => {
    const output = calculateRewards({
      transactions: [makeTx('t1', 'dining', 20000, '스타벅스 강남', false, 'cafe')],
      previousMonthSpending: 0,
      cardRule: subcategoryFixture,
    });
    const cafe = output.rewards.find((reward) => reward.category === 'dining.cafe');
    expect(cafe).toBeDefined();
    // Broad dining rule is blocked because tx has subcategory='cafe'
    // Specific cafe rule doesn't match because merchant doesn't contain '메가커피'
    expect(cafe!.reward).toBe(0);
  });
});
