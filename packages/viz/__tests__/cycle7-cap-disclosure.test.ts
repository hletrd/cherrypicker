import { describe, expect, test } from 'bun:test';
import type {
  CategorizedTransaction,
  OptimizationResult,
} from '@cherrypicker/core';
import {
  generateHTMLReport,
  printCardComparison,
  printOptimizationResult,
  type StandaloneReportContext,
} from '../src/index.js';

const result: OptimizationResult = {
  assignments: [
    {
      category: 'dining',
      categoryNameKo: '외식',
      assignedCardId: 'cap-card',
      assignedCardName: '한도 카드',
      spending: 1_000,
      transactionCount: 1,
      reward: 100,
      rate: 0.1,
      alternatives: [],
    },
  ],
  totalReward: 100,
  totalSpending: 1_000,
  unassignedSpending: 0,
  unassignedTransactionCount: 0,
  effectiveRate: 0.1,
  savingsVsSingleCard: 0,
  bestSingleCard: {
    cardId: 'cap-card',
    cardName: '한도 카드',
    totalReward: 100,
  },
  cardResults: [
    {
      cardId: 'cap-card',
      cardName: '한도 카드',
      totalReward: 100,
      totalSpending: 1_000,
      effectiveRate: 0.1,
      byCategory: [],
      performanceTier: 'tier0',
      capsHit: [
        {
          category: 'clipped-purchase',
          capType: 'per_transaction',
          capAmount: 100,
          actualReward: 120,
          appliedReward: 100,
        },
        {
          category: 'exact-global',
          capType: 'monthly_total',
          capAmount: 100,
          actualReward: 100,
          appliedReward: 100,
        },
        {
          category: 'exact-rule',
          capType: 'monthly_category',
          capAmount: 100,
          actualReward: 100,
          appliedReward: 100,
        },
        {
          category: 'clipped-global',
          capType: 'monthly_total',
          capAmount: 100,
          actualReward: 120,
          appliedReward: 100,
        },
      ],
    },
  ],
  portfolioCapLosses: [{
    transactionId: 'cap-transaction',
    transactionOccurrence: 0,
    category: 'dining',
    counterfactualCardId: 'cap-card',
    counterfactualCardName: '한도 카드',
    selectedCardId: 'cap-card',
    selectedCardName: '한도 카드',
    counterfactualReward: 120,
    selectedReward: 20,
    grossSuppressedReward: 120,
    replacementReward: 20,
    netLostReward: 100,
    causes: [{
      ruleId: 'blocked-rule',
      capGroup: 'blocked-rule',
      capType: 'monthly_category',
      capAmount: 100,
      rewardBeforeCap: 120,
      rewardAfterCap: 0,
    }],
  }],
};

const transactions: CategorizedTransaction[] = [
  {
    id: 'cap-transaction',
    date: '2026-07-01',
    merchant: '한도 가맹점',
    amount: 1_000,
    currency: 'KRW',
    category: 'dining',
    confidence: 1,
  },
];

const reportContext: StandaloneReportContext = {
  latestStatementPeriod: { start: '2026-07-01', end: '2026-07-01' },
  fullStatementPeriod: { start: '2026-07-01', end: '2026-07-01' },
  latestTransactionCount: 1,
  fullTransactionCount: 1,
  parserExclusions: [],
  calendarExclusions: [],
  previousSpendingBasis: { kind: 'default-zero' },
  unsupportedIssues: [],
};

function captureConsoleLog(run: () => void): string {
  const original = console.log;
  const writes: string[] = [];
  console.log = (...values: unknown[]) => {
    writes.push(values.map(String).join(' '));
  };
  try {
    run();
  } finally {
    console.log = original;
  }
  return writes.join('\n');
}

describe('exact versus clipped cap disclosure', () => {
  test('renders both rule caps when one category exhausts two cap groups', () => {
    const plural = structuredClone(result);
    plural.cardResults[0]!.capsHit = [
      {
        category: 'online_shopping',
        capType: 'monthly_category',
        capAmount: 5_000,
        actualReward: 5_000,
        appliedReward: 5_000,
        ruleId: 'reward-004',
        capGroup: 'reward-004',
      },
      {
        category: 'online_shopping',
        capType: 'monthly_category',
        capAmount: 10_000,
        actualReward: 10_000,
        appliedReward: 10_000,
        ruleId: 'reward-001',
        capGroup: 'reward-001',
      },
    ];

    const terminal = captureConsoleLog(() => {
      printCardComparison(plural.cardResults);
      printOptimizationResult(plural);
    });
    const html = generateHTMLReport(
      plural,
      transactions,
      new Map([['dining', '외식']]),
      reportContext,
    );

    expect(terminal).toContain(
      'online_shopping: 한도 5,000원 도달',
    );
    expect(terminal).toContain(
      'online_shopping: 한도 10,000원 도달',
    );
    expect(html).toContain(
      'online_shopping: 카테고리별 월 한도 5,000원 도달',
    );
    expect(html).toContain(
      'online_shopping: 카테고리별 월 한도 10,000원 도달',
    );
  });

  test('terminal separates portfolio loss from transaction-local reach copy', () => {
    const output = captureConsoleLog(() => {
      printCardComparison(result.cardResults);
      printOptimizationResult(result);
    });

    expect(output).toContain(
      'exact-global: 한도 100원 도달 (도달 거래에서 추가 차감 없음)',
    );
    expect(output).toContain(
      'exact-global: 한도 100원 도달 — 도달 거래에서 추가 차감 없음',
    );
    expect(output).toContain(
      'exact-rule: 한도 100원 도달 — 도달 거래에서 추가 차감 없음',
    );
    expect(output).toContain(
      'clipped-global: 한도 100원 도달 (도달 거래에서 20원 미적용)',
    );
    expect(output).toContain(
      'clipped-global: 한도 100원 도달 — 도달 거래에서 20원 미적용',
    );
    expect(output).toContain(
      '한도로 제한된 혜택 120원 · 다른 혜택으로 대체 20원 · 최종 100원 감소',
    );
    expect(output).not.toContain('혜택 손실 없음');
  });

  test('standalone report distinguishes exact reach from discarded reward', () => {
    const html = generateHTMLReport(
      result,
      transactions,
      new Map([['dining', '외식']]),
      reportContext,
    );

    expect(html).toContain(
      'clipped-purchase: 건당 한도 100원 도달 — 도달 거래에서 20원 미적용',
    );
    expect(html).toContain(
      'exact-global: 카드 월 통합 한도 100원 도달 — 도달 거래에서 추가 차감 없음',
    );
    expect(html).toContain(
      'exact-rule: 카테고리별 월 한도 100원 도달 — 도달 거래에서 추가 차감 없음',
    );
    expect(html).toContain(
      'clipped-global: 카드 월 통합 한도 100원 도달 — 도달 거래에서 20원 미적용',
    );
    expect(html).toContain(
      '한도로 제한된 혜택 120원 · 다른 혜택으로 대체 20원 · 최종 100원 감소',
    );
    expect(html).not.toContain('혜택 손실 없음');
  });

  test('legacy-unknown and current-empty portfolio telemetry make no no-loss claim', () => {
    for (const portfolioCapLosses of [undefined, []] as const) {
      const withoutLoss = structuredClone(result);
      withoutLoss.portfolioCapLosses = portfolioCapLosses;
      const output = captureConsoleLog(() => {
        printOptimizationResult(withoutLoss);
      });
      const html = generateHTMLReport(
        withoutLoss,
        transactions,
        new Map([['dining', '외식']]),
        reportContext,
      );

      expect(output).not.toContain('한도로 줄어든 최종 혜택');
      expect(html).not.toContain('한도로 줄어든 최종 혜택');
      expect(output).not.toContain('혜택 손실 없음');
      expect(html).not.toContain('혜택 손실 없음');
    }
  });
});
