import { describe, expect, test } from 'bun:test';
import type {
  CategorizedTransaction,
  OptimizationResult,
} from '@cherrypicker/core';
import {
  printCardComparison,
  printOptimizationResult,
  printSpendingSummary,
} from '../src/index.js';

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

describe('public terminal sinks', () => {
  test('remove catalog control sequences before values reach tables and detail rows', () => {
    const osc8 =
      '\u001b]8;;https://example.invalid\u0007LINK\u001b]8;;\u0007';
    const osc52 = '\u001b]52;c;Y2xpcGJvYXJk\u0007CLIP';
    const csi = '\u001b[31mCOLOR\u001b[0m';
    const lineAndC1 = 'CR\rLF\nC1\u0085END';
    const c1Csi = '\u009b31mC1COLOR\u009b0m';
    const bidi = 'LEFT\u202eRIGHT\u2066END\u2069';

    const transactions: CategorizedTransaction[] = [
      {
        id: 'tx-1',
        date: '2026-01-01',
        merchant: 'merchant',
        amount: 10_000,
        currency: 'KRW',
        category: 'hostile',
        confidence: 1,
      },
    ];
    const result: OptimizationResult = {
      assignments: [
        {
          category: 'hostile',
          categoryNameKo: bidi,
          assignedCardId: 'card-a',
          assignedCardName: osc8,
          spending: 10_000,
          reward: 100,
          rate: 0.01,
          alternatives: [
            {
              cardId: 'card-b',
              cardName: c1Csi,
              reward: 50,
              rate: 0.005,
            },
          ],
        },
      ],
      totalReward: 100,
      totalSpending: 10_000,
      effectiveRate: 0.01,
      savingsVsSingleCard: 0,
      bestSingleCard: {
        cardId: 'card-a',
        cardName: osc52,
        totalReward: 100,
      },
      cardResults: [
        {
          cardId: 'card-a',
          cardName: osc8,
          totalReward: 100,
          totalSpending: 10_000,
          effectiveRate: 0.01,
          byCategory: [],
          performanceTier: csi,
          capsHit: [
            {
              category: lineAndC1,
              capType: 'monthly_category',
              capAmount: 100,
              actualReward: 120,
              appliedReward: 100,
            },
          ],
        },
      ],
    };

    const output = captureConsoleLog(() => {
      printSpendingSummary(
        transactions,
        new Map([['hostile', osc8]]),
      );
      printCardComparison(result.cardResults);
      printOptimizationResult(result);
    });

    // cli-table3 may emit its own formatting. These are the exact injected
    // sequences and payloads, which must not survive the sink boundary.
    expect(output).not.toContain('https://example.invalid');
    expect(output).not.toContain('Y2xpcGJvYXJk');
    expect(output).not.toContain('\u001b[31m');
    expect(output).not.toMatch(/[\r\u0085\u009b\u009d\u202e\u2066\u2069]/);
    expect(output).not.toContain('CR\nLF');

    expect(output).toContain('LINK');
    expect(output).toContain('CLIP');
    expect(output).toContain('COLOR');
    expect(output).toContain('CR LF C1 END');
    expect(output).toContain('LEFTRIGHTEND');
  });

  test.each([
    [
      'same category',
      [
        {
          id: 'tx-max',
          date: '2026-01-01',
          merchant: 'max',
          amount: Number.MAX_SAFE_INTEGER,
          currency: 'KRW',
          category: 'shopping',
          confidence: 1,
        },
        {
          id: 'tx-two',
          date: '2026-01-02',
          merchant: 'two',
          amount: 2,
          currency: 'KRW',
          category: 'shopping',
          confidence: 1,
        },
      ],
    ],
    [
      'different categories',
      [
        {
          id: 'tx-max',
          date: '2026-01-01',
          merchant: 'max',
          amount: Number.MAX_SAFE_INTEGER,
          currency: 'KRW',
          category: 'shopping',
          confidence: 1,
        },
        {
          id: 'tx-two',
          date: '2026-01-02',
          merchant: 'two',
          amount: 2,
          currency: 'KRW',
          category: 'dining',
          confidence: 1,
        },
      ],
    ],
  ] as const)(
    'fails before logging a partial summary for an unsafe %s total',
    (_name, transactions) => {
      const original = console.log;
      const writes: string[] = [];
      console.log = (...values: unknown[]) => {
        writes.push(values.map(String).join(' '));
      };
      try {
        expect(() =>
          printSpendingSummary(
            [...transactions] as CategorizedTransaction[],
            new Map(),
          ),
        ).toThrow('안전한 정수 범위');
      } finally {
        console.log = original;
      }
      expect(writes).toEqual([]);
    },
  );

  test('prints an exact-safe total while filtering zero amounts and refunds', () => {
    const transactions: CategorizedTransaction[] = [
      {
        id: 'tx-near-max',
        date: '2026-01-01',
        merchant: 'near max',
        amount: Number.MAX_SAFE_INTEGER - 2,
        currency: 'KRW',
        category: 'shopping',
        confidence: 1,
      },
      {
        id: 'tx-two',
        date: '2026-01-02',
        merchant: 'two',
        amount: 2,
        currency: 'KRW',
        category: 'shopping',
        confidence: 1,
      },
      {
        id: 'tx-zero',
        date: '2026-01-03',
        merchant: 'zero',
        amount: 0,
        currency: 'KRW',
        category: 'shopping',
        confidence: 1,
      },
      {
        id: 'tx-refund',
        date: '2026-01-04',
        merchant: 'refund',
        amount: -100,
        currency: 'KRW',
        category: 'shopping',
        confidence: 1,
      },
    ];

    const output = captureConsoleLog(() => {
      printSpendingSummary(transactions, new Map());
    });

    expect(output).toContain(
      `${Number.MAX_SAFE_INTEGER.toLocaleString('ko-KR')}원`,
    );
    expect(output.match(/\b2\b/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test('labels recommendation benefits as gross monthly rewards', () => {
    const result: OptimizationResult = {
      assignments: [],
      totalReward: 100,
      totalSpending: 10_000,
      effectiveRate: 0.01,
      savingsVsSingleCard: 20,
      bestSingleCard: {
        cardId: 'card-a',
        cardName: '카드 A',
        totalReward: 80,
      },
      cardResults: [],
    };
    const output = captureConsoleLog(() => printOptimizationResult(result));

    expect(output).toContain('연회비 차감 전 월간 총혜택');
    expect(output).toContain('포함된 모든 카드를 사용할 수 있다고 가정');
    expect(output).not.toContain('추가 절약');
  });
});
