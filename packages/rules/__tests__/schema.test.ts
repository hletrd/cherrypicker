import { describe, test, expect } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'path';
import { stringify } from 'yaml';
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
      id: 'reward-001',
      category: 'dining',
      subcategory: 'restaurant',
      label: '외식 할인',
      type: 'discount',
      priority: 1,
      combination: 'exclusive',
      stackingGroup: 'base',
      capGroup: 'reward-001',
      support: { status: 'supported' },
      tiers: [
        { performanceTier: 'tier1', rate: 5.0, monthlyCap: 10000, perTransactionCap: null },
      ],
      conditions: {
        specificMerchants: ['테스트식당'],
        weekdays: [0, 6],
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
      ...fixedAmountRule.rewards[0]!,
      category: 'transportation',
      subcategory: undefined,
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
    expect(result.data.rewards[0]?.tiers[0]?.value).toEqual({
      kind: 'fuel_per_liter',
      amount: 100,
    });
  });

  test('derives fractional mileage rates as mileage-per-spend values', () => {
    const fractionalMileageRule = structuredClone(validCardRuleSet);
    fractionalMileageRule.rewards[0] = {
      ...fractionalMileageRule.rewards[0]!,
      category: 'travel',
      subcategory: undefined,
      type: 'mileage',
      tiers: [
        {
          performanceTier: 'tier1',
          rate: null,
          fixedAmount: 0.5,
          unit: 'mile_per_1500won',
          monthlyCap: null,
          perTransactionCap: null,
        },
      ],
    };

    const result = cardRuleSetSchema.parse(fractionalMileageRule);
    expect(result.rewards[0]?.tiers[0]?.value).toEqual({
      kind: 'mileage_per_spend',
      amount: 0.5,
    });
  });

  test('publishes authored percentage points as a discriminated value', () => {
    const result = cardRuleSetSchema.parse(validCardRuleSet);
    expect(result.rewards[0]?.tiers[0]?.value).toEqual({
      kind: 'percentage',
      amount: 5,
    });
  });

  test('round-trips canonical parsed output idempotently', () => {
    const first = cardRuleSetSchema.parse(validCardRuleSet);
    const second = cardRuleSetSchema.parse(first);

    expect(second).toEqual(first);
  });

  test('rejects serialized values that disagree with authored reward fields', () => {
    const canonical = cardRuleSetSchema.parse(validCardRuleSet);
    const tampered = structuredClone(canonical);
    tampered.rewards[0]!.tiers[0]!.value = {
      kind: 'percentage',
      amount: 50,
    };

    expect(cardRuleSetSchema.safeParse(tampered).success).toBe(false);
  });

  test('requires the explicit selection, cap, and support contract', () => {
    for (const field of [
      'id',
      'priority',
      'combination',
      'stackingGroup',
      'capGroup',
      'support',
    ] as const) {
      const bad = structuredClone(validCardRuleSet);
      delete (bad.rewards[0] as Record<string, unknown>)[field];
      expect(cardRuleSetSchema.safeParse(bad).success).toBe(false);
    }
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

  test.each([
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
  ])('rejects impossible lastUpdated calendar date %s', (lastUpdated) => {
    const bad = {
      ...validCardRuleSet,
      card: { ...validCardRuleSet.card, lastUpdated },
    };
    expect(cardRuleSetSchema.safeParse(bad).success).toBe(false);
  });

  test('accepts a real leap-day lastUpdated value', () => {
    const leapDay = {
      ...validCardRuleSet,
      card: { ...validCardRuleSet.card, lastUpdated: '2024-02-29' },
    };
    expect(cardRuleSetSchema.safeParse(leapDay).success).toBe(true);
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

  test.each([100.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid percentage-point rate %s',
    (rate) => {
      const bad = structuredClone(validCardRuleSet);
      bad.rewards[0]!.tiers[0]!.rate = rate;
      expect(cardRuleSetSchema.safeParse(bad).success).toBe(false);
    },
  );

  test('rejects unsafe monetary integers', () => {
    const bad = structuredClone(validCardRuleSet);
    bad.rewards[0]!.tiers[0]!.monthlyCap = Number.MAX_SAFE_INTEGER + 1;
    expect(cardRuleSetSchema.safeParse(bad).success).toBe(false);
  });

  test('rejects unknown reward units and condition fields', () => {
    const unknownUnit = structuredClone(validCardRuleSet);
    unknownUnit.rewards[0]!.tiers[0]!.rate = null;
    unknownUnit.rewards[0]!.tiers[0]!.fixedAmount = 100;
    unknownUnit.rewards[0]!.tiers[0]!.unit = 'won_per_visit';
    expect(cardRuleSetSchema.safeParse(unknownUnit).success).toBe(false);

    const unknownCondition = structuredClone(validCardRuleSet);
    Object.assign(unknownCondition.rewards[0]!.conditions!, {
      excludeOnline: true,
    });
    expect(cardRuleSetSchema.safeParse(unknownCondition).success).toBe(false);
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

  test('rejects tier with both rate and fixedAmount (mutual exclusion)', () => {
    const bad = structuredClone(validCardRuleSet);
    bad.rewards[0]!.tiers[0]!.rate = 5;
    bad.rewards[0]!.tiers[0]!.fixedAmount = 100;
    const result = cardRuleSetSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test('canonicalizes rate=0 plus fixedAmount>0 to a fixed value', () => {
    const ok = structuredClone(validCardRuleSet);
    ok.rewards[0]!.tiers[0]!.rate = 0;
    ok.rewards[0]!.tiers[0]!.fixedAmount = 100;
    const result = cardRuleSetSchema.safeParse(ok);
    expect(result.success).toBe(true);
    expect(result.data!.rewards[0]!.tiers[0]!.rate).toBeNull();
    expect(result.data!.rewards[0]!.tiers[0]!.fixedAmount).toBe(100);
    expect(result.data!.rewards[0]!.tiers[0]!.value).toEqual({
      kind: 'fixed_per_transaction',
      amount: 100,
    });
  });

  test('allows tier with rate>0 and fixedAmount=0', () => {
    const ok = structuredClone(validCardRuleSet);
    ok.rewards[0]!.tiers[0]!.rate = 5;
    ok.rewards[0]!.tiers[0]!.fixedAmount = 0;
    const result = cardRuleSetSchema.safeParse(ok);
    expect(result.success).toBe(true);
    expect(result.data!.rewards[0]!.tiers[0]!.rate).toBe(5);
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

  test('loads LOCA 365 subscription as the canonical 1,500-won fixed value', async () => {
    const rule = await loadCardRule(join(cardsDir, 'lotte/loca-365.yaml'));
    const subscription = rule.rewards.find(
      (reward) => reward.id === 'reward-007',
    )!;
    const tier = subscription.tiers.find(
      (entry) => entry.performanceTier === 'tier1',
    );

    expect(tier).toMatchObject({
      rate: null,
      fixedAmount: 1_500,
      value: {
        kind: 'fixed_per_transaction',
        amount: 1_500,
      },
    });
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
  test('returns nested authoring rules in ASCII card ID order', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rules-order-'));
    try {
      const firstCreatedDirectory = join(directory, 'a-first-created');
      const secondCreatedDirectory = join(directory, 'z-second-created');
      await mkdir(firstCreatedDirectory);
      await mkdir(secondCreatedDirectory);

      const zCard = structuredClone(validCardRuleSet);
      zCard.card.id = 'fixture-z-card';
      const aCard = structuredClone(validCardRuleSet);
      aCard.card.id = 'fixture-a-card';

      // Creation and path order intentionally disagree with card ID order.
      await writeFile(
        join(firstCreatedDirectory, 'first.yaml'),
        stringify(zCard),
      );
      await writeFile(
        join(secondCreatedDirectory, 'second.yaml'),
        stringify(aCard),
      );

      const rules = await loadAllCardRules(directory);
      expect(rules.map((rule) => rule.card.id)).toEqual([
        'fixture-a-card',
        'fixture-z-card',
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

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
