import type { CardRuleSet } from '@cherrypicker/rules';

export function makeCardRule(
  overrides: Partial<CardRuleSet['card']> = {},
): CardRuleSet {
  return {
    card: {
      id: 'shinhan-security-test',
      issuer: 'shinhan',
      name: 'Security Test',
      nameKo: '보안 테스트',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      lastUpdated: '2026-07-23',
      source: 'llm-scrape',
      ...overrides,
    },
    performanceTiers: [
      { id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null },
    ],
    performanceExclusions: [],
    rewards: [
      {
        id: 'general-discount',
        category: '*',
        type: 'discount',
        priority: 0,
        combination: 'exclusive',
        stackingGroup: 'general-discount',
        capGroup: 'general-discount',
        support: { status: 'supported' },
        tiers: [
          {
            performanceTier: 'tier0',
            rate: 5,
            monthlyCap: null,
            perTransactionCap: null,
          },
        ],
      },
    ],
    globalConstraints: {
      monthlyTotalDiscountCap: null,
      minimumAnnualSpending: null,
    },
  };
}
