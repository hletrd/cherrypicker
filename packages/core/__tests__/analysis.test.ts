import { describe, expect, test } from 'bun:test';
import {
  buildAnalysisContext,
  calculatePerformanceSpending,
  resolveCardPreviousSpending,
} from '../src/index.js';

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
