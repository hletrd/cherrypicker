import { describe, expect, test } from 'bun:test';
import {
  buildAnalysisContext,
  calculatePerformanceSpending,
  resolveCardPreviousSpending,
} from '../src/index.js';

describe('analysis money boundaries', () => {
  test('rejects a monthly sum beyond the safe-integer boundary', () => {
    expect(() =>
      buildAnalysisContext([
        { date: '2026-07-01', amount: Number.MAX_SAFE_INTEGER },
        { date: '2026-07-02', amount: Number.MAX_SAFE_INTEGER },
      ]),
    ).toThrow(/monthly spending for 2026-07/);
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
