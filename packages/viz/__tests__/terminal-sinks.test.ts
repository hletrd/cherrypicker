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
});
