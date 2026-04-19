/**
 * Unit tests for the toCoreCardRuleSets type adapter logic.
 *
 * The actual adapter is a private function in analyzer.ts, so we test
 * the narrowing logic by reproducing the same validation sets and rules.
 */
import { describe, test, expect } from 'bun:test';

// Mirrors the VALID_SOURCES set from analyzer.ts
const VALID_SOURCES = new Set(['manual', 'llm-scrape', 'web']);
// Mirrors the VALID_REWARD_TYPES set from analyzer.ts
const VALID_REWARD_TYPES = new Set(['discount', 'points', 'cashback', 'mileage']);

// Minimal fixture matching the web CardRuleSet shape
interface WebCardRuleSet {
  card: { id: string; source: string; [k: string]: unknown };
  rewards: Array<{
    type: string;
    tiers: Array<{ unit?: string | null; [k: string]: unknown }>;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
}

// The adapter logic — mirrors toCoreCardRuleSets from analyzer.ts
function toCoreCardRuleSets(rules: WebCardRuleSet[]) {
  return rules.map((rule) => ({
    ...rule,
    card: {
      ...rule.card,
      source: VALID_SOURCES.has(rule.card.source)
        ? (rule.card.source as 'manual' | 'llm-scrape' | 'web')
        : 'web',
    },
    rewards: rule.rewards.map((r) => ({
      ...r,
      type: VALID_REWARD_TYPES.has(r.type)
        ? (r.type as 'discount' | 'points' | 'cashback' | 'mileage')
        : 'discount',
      tiers: r.tiers.map((t) => ({
        ...t,
        unit: t.unit ?? null,
      })),
    })),
  }));
}

describe('toCoreCardRuleSets type adapter', () => {
  const baseRule: WebCardRuleSet = {
    card: { id: 'test-card', source: 'manual', nameKo: '테스트' },
    rewards: [{
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: 1, monthlyCap: null, perTransactionCap: null }],
    }],
  };

  test('valid source values pass through unchanged', () => {
    for (const src of ['manual', 'llm-scrape', 'web']) {
      const result = toCoreCardRuleSets([{ ...baseRule, card: { ...baseRule.card, source: src } }]);
      expect(result[0]!.card.source).toBe(src);
    }
  });

  test('unknown source value falls back to "web"', () => {
    const result = toCoreCardRuleSets([{ ...baseRule, card: { ...baseRule.card, source: 'unknown-source' } }]);
    expect(result[0]!.card.source).toBe('web');
  });

  test('empty string source falls back to "web"', () => {
    const result = toCoreCardRuleSets([{ ...baseRule, card: { ...baseRule.card, source: '' } }]);
    expect(result[0]!.card.source).toBe('web');
  });

  test('valid reward types pass through unchanged', () => {
    for (const type of ['discount', 'points', 'cashback', 'mileage']) {
      const result = toCoreCardRuleSets([{
        ...baseRule,
        rewards: [{ type, tiers: [{ rate: 1, monthlyCap: null, perTransactionCap: null }] }],
      }]);
      expect(result[0]!.rewards[0]!.type).toBe(type);
    }
  });

  test('unknown reward type falls back to "discount"', () => {
    const result = toCoreCardRuleSets([{
      ...baseRule,
      rewards: [{ type: 'unknown-type', tiers: [{ rate: 1, monthlyCap: null, perTransactionCap: null }] }],
    }]);
    expect(result[0]!.rewards[0]!.type).toBe('discount');
  });

  test('null unit is normalized to null', () => {
    const result = toCoreCardRuleSets([{
      ...baseRule,
      rewards: [{ type: 'discount', tiers: [{ rate: 1, monthlyCap: null, perTransactionCap: null, unit: null }] }],
    }]);
    expect(result[0]!.rewards[0]!.tiers[0]!.unit).toBeNull();
  });

  test('undefined unit is normalized to null', () => {
    const result = toCoreCardRuleSets([{
      ...baseRule,
      rewards: [{ type: 'discount', tiers: [{ rate: 1, monthlyCap: null, perTransactionCap: null, unit: undefined }] }],
    }]);
    expect(result[0]!.rewards[0]!.tiers[0]!.unit).toBeNull();
  });

  test('string unit is preserved', () => {
    const result = toCoreCardRuleSets([{
      ...baseRule,
      rewards: [{ type: 'discount', tiers: [{ rate: null, monthlyCap: null, perTransactionCap: null, unit: 'won_per_day', fixedAmount: 3000 }] }],
    }]);
    expect(result[0]!.rewards[0]!.tiers[0]!.unit).toBe('won_per_day');
  });

  test('all other fields are preserved unchanged', () => {
    const rule: WebCardRuleSet = {
      card: { id: 'preserve-test', source: 'manual', extra: 'field' },
      rewards: [{
        type: 'points',
        category: 'dining',
        tiers: [{ performanceTier: 'tier1', rate: 3, monthlyCap: 5000, perTransactionCap: null, unit: null }],
      }],
      extraField: true,
    };
    const result = toCoreCardRuleSets([rule]);
    expect(result[0]!.card.id).toBe('preserve-test');
    expect(result[0]!.card.extra).toBe('field');
    expect(result[0]!.rewards[0]!.category).toBe('dining');
    expect(result[0]!.extraField).toBe(true);
  });
});
