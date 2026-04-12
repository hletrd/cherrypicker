import { describe, expect, test } from 'bun:test';
import { generateHTMLReport } from '../src/report/generator.js';
import type { OptimizationResult, CategorizedTransaction } from '@cherrypicker/core';

const optimization: OptimizationResult = {
  assignments: [
    {
      category: 'uncategorized',
      categoryNameKo: '미분류',
      assignedCardId: 'simple-plan',
      assignedCardName: '심플플랜',
      spending: 100000,
      reward: 1000,
      rate: 0.01,
      alternatives: [],
    },
  ],
  totalReward: 1000,
  totalSpending: 100000,
  effectiveRate: 0.01,
  savingsVsSingleCard: 0,
  bestSingleCard: {
    cardId: 'simple-plan',
    cardName: '심플플랜',
    totalReward: 1000,
  },
  cardResults: [
    {
      cardId: 'simple-plan',
      cardName: '심플플랜',
      totalReward: 1000,
      totalSpending: 100000,
      effectiveRate: 0.01,
      byCategory: [],
      performanceTier: 'tier0',
      capsHit: [],
    },
  ],
};

const transactions: CategorizedTransaction[] = [
  {
    id: 't1',
    date: '2026-02-01',
    merchant: '<이마트>',
    amount: 100000,
    currency: 'KRW',
    category: 'uncategorized',
    confidence: 1,
  },
];

describe('generateHTMLReport', () => {
  test('renders summary values and escapes transaction content', () => {
    const html = generateHTMLReport(optimization, transactions);

    expect(html).toContain('100,000원');
    expect(html).toContain('1,000원');
    expect(html).toContain('심플플랜');
    expect(html).not.toContain('<이마트>');
  });
});
