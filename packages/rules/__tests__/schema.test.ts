import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import {
  cardRuleSetSchema,
  categoriesFileSchema,
} from '../src/schema.js';
import {
  loadCardRule,
  loadAllCardRules,
  loadCategories,
} from '../src/loader.js';

const dataDir = join(import.meta.dir, '../data');
const cardsDir = join(dataDir, 'cards');

// ── Minimal valid card rule set fixture ──────────────────────────────────────
const validCardRuleSet = {
  card: {
    id: 'test-card-001',
    issuer: 'testbank',
    name: 'Test Card',
    nameKo: '테스트카드',
    type: 'credit',
    annualFee: { domestic: 15000, international: 20000 },
    lastUpdated: '2026-01-01',
    source: 'manual',
  },
  performanceTiers: [
    { id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null },
    { id: 'tier1', label: '30만원 이상', minSpending: 300000, maxSpending: null },
  ],
  performanceExclusions: ['tax_payment'],
  rewards: [
    {
      category: 'dining',
      subcategory: 'restaurant',
      label: '외식 할인',
      type: 'discount',
      tiers: [
        { performanceTier: 'tier1', rate: 5.0, monthlyCap: 10000, perTransactionCap: null },
      ],
      conditions: {
        specificMerchants: ['테스트식당'],
        note: '주말만 적용',
      },
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
    note: '월 통합 한도 없음',
  },
};

describe('cardRuleSetSchema - valid data', () => {
  test('validates a correct card rule set', () => {
    const result = cardRuleSetSchema.safeParse(validCardRuleSet);
    expect(result.success).toBe(true);
  });

  test('parsed data has correct card id', () => {
    const result = cardRuleSetSchema.safeParse(validCardRuleSet);
    if (!result.success) throw new Error(result.error.message);
    expect(result.data.card.id).toBe('test-card-001');
  });

  test('parsed data has correct number of tiers', () => {
    const result = cardRuleSetSchema.safeParse(validCardRuleSet);
    if (!result.success) throw new Error(result.error.message);
    expect(result.data.performanceTiers).toHaveLength(2);
  });

  test('preserves subcategory, labels, and conditions metadata', () => {
    const result = cardRuleSetSchema.safeParse(validCardRuleSet);
    if (!result.success) throw new Error(result.error.message);
    expect(result.data.rewards[0]?.subcategory).toBe('restaurant');
    expect(result.data.rewards[0]?.label).toBe('외식 할인');
    expect(result.data.rewards[0]?.conditions?.note).toBe('주말만 적용');
    expect(result.data.globalConstraints.note).toBe('월 통합 한도 없음');
  });

  test('preserves fixedAmount/unit tiers without coercing null rate to zero', () => {
    const fixedAmountRule = structuredClone(validCardRuleSet);
    fixedAmountRule.rewards[0] = {
      category: 'transportation',
      type: 'cashback',
      tiers: [
        {
          performanceTier: 'tier1',
          rate: null,
          fixedAmount: 100,
          unit: 'won_per_liter',
          monthlyCap: 30000,
          perTransactionCap: null,
        },
      ],
    };

    const result = cardRuleSetSchema.safeParse(fixedAmountRule);
    if (!result.success) throw new Error(result.error.message);
    expect(result.data.rewards[0]?.tiers[0]?.rate).toBeNull();
    expect(result.data.rewards[0]?.tiers[0]?.fixedAmount).toBe(100);
    expect(result.data.rewards[0]?.tiers[0]?.unit).toBe('won_per_liter');
  });
});

describe('cardRuleSetSchema - invalid data', () => {
  test('rejects missing card.id', () => {
    const bad = structuredClone(validCardRuleSet);
    // @ts-ignore
    delete bad.card.id;
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects invalid card type', () => {
    const bad = { ...validCardRuleSet, card: { ...validCardRuleSet.card, type: 'debit' } };
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects invalid lastUpdated format', () => {
    const bad = { ...validCardRuleSet, card: { ...validCardRuleSet.card, lastUpdated: '01-01-2026' } };
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects empty rewards array', () => {
    const bad = { ...validCardRuleSet, rewards: [] };
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects empty performanceTiers array', () => {
    const bad = { ...validCardRuleSet, performanceTiers: [] };
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects negative annualFee', () => {
    const bad = {
      ...validCardRuleSet,
      card: { ...validCardRuleSet.card, annualFee: { domestic: -1000, international: 0 } },
    };
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects invalid reward type', () => {
    const bad = structuredClone(validCardRuleSet);
    // @ts-ignore
    bad.rewards[0].type = 'voucher';
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects empty reward tiers array', () => {
    const bad = structuredClone(validCardRuleSet);
    bad.rewards[0]!.tiers = [];
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects negative rate in rewardTierRate', () => {
    const bad = structuredClone(validCardRuleSet);
    bad.rewards[0]!.tiers[0]!.rate = -5;
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects missing globalConstraints', () => {
    const bad = { ...validCardRuleSet };
    // @ts-ignore
    delete bad.globalConstraints;
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects non-integer minSpending in performanceTier', () => {
    const bad = structuredClone(validCardRuleSet);
    bad.performanceTiers[0]!.minSpending = 300000.5;
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects missing source field', () => {
    const bad = structuredClone(validCardRuleSet);
    // @ts-ignore
    delete bad.card.source;
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('rejects invalid source value', () => {
    const bad = { ...validCardRuleSet, card: { ...validCardRuleSet.card, source: 'scraped' as any } };
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('loadCardRule', () => {
  test('loads shinhan/simple-plan.yaml successfully', async () => {
    const rule = await loadCardRule(join(cardsDir, 'shinhan/simple-plan.yaml'));
    expect(rule.card.id).toBe('shinhan-simple-plan');
    expect(rule.card.issuer).toBe('shinhan');
    expect(rule.performanceTiers.length).toBeGreaterThan(0);
    expect(rule.rewards.length).toBeGreaterThan(0);
  });

  test('loaded card has correct type enum', async () => {
    const rule = await loadCardRule(join(cardsDir, 'shinhan/simple-plan.yaml'));
    expect(['credit', 'check', 'prepaid']).toContain(rule.card.type);
  });

  test('loaded card lastUpdated matches ISO format', async () => {
    const rule = await loadCardRule(join(cardsDir, 'shinhan/simple-plan.yaml'));
    expect(rule.card.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('loads fixed-amount unit rewards without losing their semantics', async () => {
    const rule = await loadCardRule(join(cardsDir, 'lotte/digiloca-auto.yaml'));
    const tier = rule.rewards[0]?.tiers.find((entry) => entry.performanceTier === 'tier1');
    expect(tier?.rate).toBeNull();
    expect(tier?.fixedAmount).toBe(100);
    expect(tier?.unit).toBe('won_per_liter');
  });

  test('loads subcategory-specific rewards intact', async () => {
    const rule = await loadCardRule(join(cardsDir, 'mg/plus-blue.yaml'));
    expect(rule.rewards.find((reward) => reward.subcategory === 'restaurant')).toBeDefined();
    expect(rule.rewards.find((reward) => reward.subcategory === 'cafe')).toBeDefined();
  });

  test('loads web-sourced cards without rejecting their metadata', async () => {
    const rule = await loadCardRule(join(cardsDir, 'lotte/digiloca-auto.yaml'));
    expect(rule.card.source).toBe('web');
  });

  test('loads prepaid cards when the dataset marks them explicitly', async () => {
    const rule = await loadCardRule(join(cardsDir, 'shinhan/pick-e.yaml'));
    expect(rule.card.type).toBe('prepaid');
  });

  test('throws on non-existent file', async () => {
    await expect(loadCardRule(join(cardsDir, 'shinhan/nonexistent-card.yaml'))).rejects.toThrow();
  });
});

describe('loadAllCardRules', () => {
  test('loads the full supported dataset from data/cards', async () => {
    const rules = await loadAllCardRules(cardsDir);
    expect(rules.length).toBeGreaterThan(650);
  }, 30000);

  test('all loaded rules have valid card ids', async () => {
    const rules = await loadAllCardRules(cardsDir);
    for (const rule of rules) {
      expect(rule.card.id).toBeTruthy();
      expect(typeof rule.card.id).toBe('string');
    }
  }, 30000);

  test('all loaded rules have at least one performance tier', async () => {
    const rules = await loadAllCardRules(cardsDir);
    for (const rule of rules) {
      expect(rule.performanceTiers.length).toBeGreaterThan(0);
    }
  }, 30000);

  test('all loaded rules have at least one reward rule', async () => {
    const rules = await loadAllCardRules(cardsDir);
    for (const rule of rules) {
      expect(rule.rewards.length).toBeGreaterThan(0);
    }
  }, 30000);
});

describe('loadCategories', () => {
  test('loads categories.yaml successfully', async () => {
    const nodes = await loadCategories(join(dataDir, 'categories.yaml'));
    expect(nodes.length).toBeGreaterThan(0);
  });

  test('loaded categories include dining node', async () => {
    const nodes = await loadCategories(join(dataDir, 'categories.yaml'));
    const dining = nodes.find((n) => n.id === 'dining');
    expect(dining).toBeDefined();
    expect(dining!.labelKo).toBe('외식');
    expect(dining!.labelEn).toBe('Dining');
  });

  test('dining node has subcategories', async () => {
    const nodes = await loadCategories(join(dataDir, 'categories.yaml'));
    const dining = nodes.find((n) => n.id === 'dining');
    expect(dining!.subcategories).toBeDefined();
    expect(dining!.subcategories!.length).toBeGreaterThan(0);
  });

  test('convenience_store is a top-level node with keywords', async () => {
    const nodes = await loadCategories(join(dataDir, 'categories.yaml'));
    const cs = nodes.find((n) => n.id === 'convenience_store');
    expect(cs).toBeDefined();
    expect(cs!.keywords.length).toBeGreaterThan(0);
    expect(cs!.keywords).toContain('CU');
  });
});

describe('categoriesFileSchema', () => {
  test('validates correct categories structure', () => {
    const data = {
      categories: [
        {
          id: 'dining',
          labelKo: '외식',
          labelEn: 'Dining',
          keywords: ['식당', '음식점'],
        },
      ],
    };
    const result = categoriesFileSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('rejects missing labelKo', () => {
    const data = {
      categories: [
        {
          id: 'dining',
          labelEn: 'Dining',
          keywords: ['식당'],
        },
      ],
    };
    const result = categoriesFileSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('rejects missing categories key', () => {
    const result = categoriesFileSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });
});
