import { describe, expect, test } from 'vitest';
import {
  buildConstraints,
  greedyOptimize,
} from '../src/index.js';
import type {
  CardRuleSet,
  CategorizedTransaction,
} from '../src/index.js';

describe('public optimizer API', () => {
  test('carries caller-provided category labels into assignments', () => {
    const transactions: CategorizedTransaction[] = [
      {
        id: 'tx-1',
        date: '2026-07-01',
        merchant: '테스트 식당',
        amount: 10_000,
        currency: 'KRW',
        category: 'dining',
        confidence: 1,
        isOnline: false,
      },
    ];
    const cardRules: CardRuleSet[] = [
      {
        card: {
          id: 'public-api-card',
          issuer: 'fixture',
          name: 'Public API Card',
          nameKo: '공개 API 카드',
          type: 'credit',
          annualFee: { domestic: 0, international: 0 },
          url: 'https://example.com/public-api-card',
          lastUpdated: '2026-07-23',
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
            category: 'dining',
            type: 'discount',
            support: { status: 'supported' },
            tiers: [
              {
                performanceTier: 'tier0',
                rate: 1,
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
      },
    ];

    const constraints = buildConstraints(
      transactions,
      new Map([['public-api-card', 0]]),
      new Map([['dining', '외식']]),
    );
    const result = greedyOptimize(constraints, cardRules);

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.categoryNameKo).toBe('외식');
  });
});
