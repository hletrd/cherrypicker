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

const categoryLabels = new Map([['uncategorized', '미분류']]);

describe('generateHTMLReport', () => {
  test('renders summary values and escapes transaction content', () => {
    const html = generateHTMLReport(optimization, transactions, categoryLabels);

    expect(html).toContain('100,000원');
    expect(html).toContain('1,000원');
    expect(html).toContain('심플플랜');
    expect(html).not.toContain('<이마트>');
  });

  test('escapes HTML entities including quotes, slashes, and null bytes', () => {
    const evilOptimization: OptimizationResult = {
      ...optimization,
      bestSingleCard: { cardId: 'evil', cardName: "O'Brien / Test \\0", totalReward: 0 },
      cardResults: [
        {
          cardId: 'evil',
          cardName: "O'Brien / Test \\0",
          totalReward: 0,
          totalSpending: 0,
          effectiveRate: 0,
          byCategory: [],
          performanceTier: 'tier0',
          capsHit: [],
        },
      ],
    };
    const html = generateHTMLReport(evilOptimization, transactions, categoryLabels);
    expect(html).toContain('O&#39;Brien');   // single quote escaped
    expect(html).toContain('&#92;');         // backslash escaped
    expect(html).not.toContain("O'Brien");   // raw single quote not present
  });
});
