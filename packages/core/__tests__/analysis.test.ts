import { describe, expect, test } from 'bun:test';
import {
  buildAnalysisContext,
  calculatePerformanceSpending,
  resolveCardPreviousSpending,
} from '../src/index.js';

describe('analysis calendar context', () => {
  test('proves each input date once while preserving projected calendar semantics', () => {
    const leapDay = { id: 'leap', date: '2024-02-29', amount: 10_000 };
    const december = { id: 'dec', date: '2025-12-31', amount: 20_000 };
    const januaryEarly = {
      id: 'jan-early',
      date: '2026-01-02',
      amount: 30_000,
    };
    const januaryLate = {
      id: 'jan-late',
      date: '2026-01-20',
      amount: 40_000,
    };
    const invalidDay = {
      id: 'invalid',
      date: '2026-02-30',
      amount: 90_000,
    };
    const input = [
      januaryLate,
      invalidDay,
      leapDay,
      januaryEarly,
      december,
    ];
    // Keep the global wrapper inside one synchronous callback: the runner
    // cannot interleave another test in this isolate before it is restored.
    const originalUtc = Date.UTC;
    const utcCalls: Array<Parameters<typeof Date.UTC>> = [];
    Date.UTC = (...args: Parameters<typeof Date.UTC>) => {
      utcCalls.push(args);
      return originalUtc(...args);
    };

    try {
      const context = buildAnalysisContext(input)!;

      expect(utcCalls).toHaveLength(input.length);
      expect(utcCalls).toEqual([
        [2026, 0, 20],
        [2026, 1, 30],
        [2024, 1, 29],
        [2026, 0, 2],
        [2025, 11, 31],
      ]);
      expect(context.validTransactions).toEqual([
        leapDay,
        december,
        januaryEarly,
        januaryLate,
      ]);
      expect(context.validTransactions[0]).toBe(leapDay);
      expect(context.validTransactions[1]).toBe(december);
      expect(context.validTransactions[2]).toBe(januaryEarly);
      expect(context.validTransactions[3]).toBe(januaryLate);
      expect(context.invalidDateTransactions).toEqual([invalidDay]);
      expect(context.invalidDateTransactions[0]).toBe(invalidDay);
      expect(context.latestMonth).toBe('2026-01');
      expect(context.latestTransactions).toEqual([
        januaryEarly,
        januaryLate,
      ]);
      expect(context.latestTransactions[0]).toBe(januaryEarly);
      expect(context.latestTransactions[1]).toBe(januaryLate);
      expect(context.previousTransactions).toEqual([december]);
      expect(context.previousTransactions[0]).toBe(december);
      expect(context.previousSpendingBasis).toEqual({
        kind: 'statement-month',
        month: '2025-12',
      });
      expect(context.statementPeriod).toEqual({
        start: '2026-01-02',
        end: '2026-01-20',
      });
      expect(context.fullStatementPeriod).toEqual({
        start: '2024-02-29',
        end: '2026-01-20',
      });
      expect(context.monthlyBreakdown).toEqual([
        { month: '2024-02', spending: 10_000, transactionCount: 1 },
        { month: '2025-12', spending: 20_000, transactionCount: 1 },
        { month: '2026-01', spending: 70_000, transactionCount: 2 },
      ]);
    } finally {
      Date.UTC = originalUtc;
    }
  });

  test('preserves empty, all-invalid, missing-month, and explicit-total behavior', () => {
    expect(buildAnalysisContext([])).toBeNull();
    expect(
      buildAnalysisContext([
        { date: '2026-02-29', amount: 10_000 },
        { date: 'not-a-date', amount: 20_000 },
      ]),
    ).toBeNull();

    const missingPrevious = buildAnalysisContext([
      { date: '2025-11-10', amount: 10_000 },
      { date: '2026-01-10', amount: 20_000 },
    ])!;
    expect(missingPrevious.previousTransactions).toEqual([]);
    expect(missingPrevious.previousSpendingBasis).toEqual({
      kind: 'missing-calendar-month',
      month: '2025-12',
      assumedAmount: 0,
    });

    const explicitTotal = buildAnalysisContext(
      [{ date: '2026-01-10', amount: 20_000 }],
      300_000,
    )!;
    expect(explicitTotal.previousSpendingBasis).toEqual({
      kind: 'user-total',
      amount: 300_000,
    });
  });

  test('selects December 0999 for a January 1000 context', () => {
    const december = { id: 'december', date: '0999-12-31', amount: 20_000 };
    const january = { id: 'january', date: '1000-01-02', amount: 30_000 };

    const context = buildAnalysisContext([january, december])!;

    expect(context.validTransactions).toEqual([december, january]);
    expect(context.validTransactions[0]).toBe(december);
    expect(context.validTransactions[1]).toBe(january);
    expect(context.latestMonth).toBe('1000-01');
    expect(context.latestTransactions).toEqual([january]);
    expect(context.previousTransactions).toEqual([december]);
    expect(context.previousTransactions[0]).toBe(december);
    expect(context.previousSpendingBasis).toEqual({
      kind: 'statement-month',
      month: '0999-12',
    });
    expect(context.monthlyBreakdown).toEqual([
      { month: '0999-12', spending: 20_000, transactionCount: 1 },
      { month: '1000-01', spending: 30_000, transactionCount: 1 },
    ]);
  });
});

describe('analysis money boundaries', () => {
  test('fails closed when a category exclusion depends on an unresolved category', () => {
    expect(
      calculatePerformanceSpending(
        [{
          amount: 300_000,
          category: 'uncategorized',
          confidence: 0,
        }],
        ['insurance'],
      ),
    ).toEqual({
      amount: 0,
      unknownExclusions: ['insurance'],
    });
  });

  test('preserves trusted direct callers and user-confirmed categories', () => {
    expect(
      calculatePerformanceSpending(
        [{ amount: 300_000, category: 'dining' }],
        ['insurance'],
      ),
    ).toEqual({ amount: 300_000, unknownExclusions: [] });
    expect(
      calculatePerformanceSpending(
        [{
          amount: 300_000,
          category: 'dining',
          confidence: 1,
        }],
        ['insurance'],
      ),
    ).toEqual({ amount: 300_000, unknownExclusions: [] });
  });

  test('rejects a monthly sum beyond the safe-integer boundary', () => {
    expect(() =>
      buildAnalysisContext([
        { date: '2026-07-01', amount: Number.MAX_SAFE_INTEGER },
        { date: '2026-07-02', amount: Number.MAX_SAFE_INTEGER },
      ]),
    ).toThrow(/monthly spending for 2026-07/);
  });

  test('rejects a cross-month total beyond the safe-integer boundary', () => {
    expect(() =>
      buildAnalysisContext([
        { date: '2026-06-30', amount: Number.MAX_SAFE_INTEGER },
        { date: '2026-07-01', amount: Number.MAX_SAFE_INTEGER },
      ]),
    ).toThrow(/total spending across months/);
  });

  test('rejects an eligible-performance sum beyond the safe boundary', () => {
    expect(() =>
      calculatePerformanceSpending(
        [
          {
            amount: Number.MAX_SAFE_INTEGER,
            category: 'dining',
          },
          {
            amount: Number.MAX_SAFE_INTEGER,
            category: 'dining',
          },
        ],
        [],
      ),
    ).toThrow(/eligible performance spending/);
  });

  test('rejects a previous-spending sum beyond the safe boundary', () => {
    expect(() =>
      resolveCardPreviousSpending(
        [],
        [
          {
            amount: Number.MAX_SAFE_INTEGER,
            category: 'dining',
          },
          {
            amount: Number.MAX_SAFE_INTEGER,
            category: 'dining',
          },
        ],
      ),
    ).toThrow(/previous spending total/);
  });

  test.each([
    Number.MAX_SAFE_INTEGER + 1,
    1.5,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid explicit previous spending %s', (amount) => {
    expect(() =>
      buildAnalysisContext(
        [{ date: '2026-07-01', amount: 1 }],
        amount,
      ),
    ).toThrow(/previousMonthSpending must be a non-negative safe integer/);
  });
});
