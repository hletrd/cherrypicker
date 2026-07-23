import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
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
    expect(html).not.toContain("O'Brien");   // raw single quote not present
  });

  test('authorizes exactly the fixed inline stylesheet and disables scripts', () => {
    const html = generateHTMLReport(optimization, transactions, categoryLabels);
    const styleMatches = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
    const csp = html.match(
      /<meta http-equiv="Content-Security-Policy" content="([^"]+)" \/>/,
    )?.[1];

    expect(styleMatches).toHaveLength(1);
    const style = styleMatches[0]?.[1];
    expect(style).toBeDefined();
    const expectedHash = createHash('sha256')
      .update(style!, 'utf8')
      .digest('base64');

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain(`style-src 'sha256-${expectedHash}'`);
    expect(csp).not.toContain("'unsafe-inline'");
    expect(html).not.toContain('{{STYLE_SHA256}}');
    expect(html).not.toMatch(/<script\b/i);
  });

  test('uses the CherryPicker identity throughout the generated report', () => {
    const html = generateHTMLReport(optimization, transactions, categoryLabels);

    expect(html).toContain('<title>CherryPicker 분석 보고서</title>');
    expect(html).toContain('<h1>CherryPicker 분석 보고서</h1>');
    expect(html).toContain(
      '<p>CherryPicker — 한국 신용카드 최적화 도구',
    );
    expect(html).not.toContain('CardPick');
  });
});
