import { describe, expect, test } from 'bun:test';
import {
  buildAnalysisContext,
  isValidIsoDate,
  isYearMonth,
  parseYearMonth,
  previousCalendarMonth,
} from '../src/lib/analysis-context.js';
import type { YearMonth } from '../src/lib/analysis-context.js';

function tx(id: string, date: string, amount = 10_000) {
  return { id, date, amount };
}

function assertTypeContract<T extends true>(_proof: T): void {}

describe('strict calendar helpers', () => {
  test.each([
    '2026-99-99',
    '2026-02-30',
    '2026-13-01',
    '2026-00-10',
    '2026-01-01garbage',
    '2026-1-01',
  ])('rejects invalid ISO date %s', (value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });

  test('accepts real leap days and rejects non-leap rollover', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
  });

  test('requires runtime refinement for the public YearMonth type', () => {
    assertTypeContract<'2026-1' extends YearMonth ? false : true>(true);
    assertTypeContract<'2026-99' extends YearMonth ? false : true>(true);
    assertTypeContract<'1-anything' extends YearMonth ? false : true>(true);

    expect(isYearMonth('2026-01')).toBe(true);
    expect(isYearMonth('2026-00')).toBe(false);
    expect(String(parseYearMonth('2026-01'))).toBe('2026-01');
    expect(() => parseYearMonth('2026-1')).toThrow(
      'Invalid YearMonth: 2026-1',
    );
  });

  test.each([
    ['0100-03', '0100-02'],
    ['0100-01', '0099-12'],
    ['0999-12', '0999-11'],
    ['1000-01', '0999-12'],
    ['2026-01', '2025-12'],
    ['2026-03', '2026-02'],
  ])('keeps the predecessor of %s inside YearMonth as %s', (input, expected) => {
    const predecessor = previousCalendarMonth(parseYearMonth(input));

    expect(String(predecessor)).toBe(expected);
    expect(isYearMonth(predecessor)).toBe(true);
  });

  test('rejects the non-representable predecessor of 0000-01', () => {
    expect(() =>
      previousCalendarMonth(parseYearMonth('0000-01')),
    ).toThrow('YearMonth 0000-01 has no representable previous month');
  });
});

describe('buildAnalysisContext', () => {
  test('uses only the exact previous calendar month', () => {
    const context = buildAnalysisContext([
      tx('jan', '2026-01-15', 30_000),
      tx('mar', '2026-03-10', 50_000),
    ])!;
    expect(String(context.latestMonth)).toBe('2026-03');
    expect(context.previousTransactions).toHaveLength(0);
    expect(context.previousSpendingBasis).toEqual({
      kind: 'missing-calendar-month',
      month: parseYearMonth('2026-02'),
      assumedAmount: 0,
    });
  });

  test('preserves an explicit user total across multi-month input', () => {
    const context = buildAnalysisContext(
      [
        tx('jan', '2026-01-15'),
        tx('feb', '2026-02-15'),
      ],
      300_000,
    )!;
    expect(context.previousSpendingBasis).toEqual({
      kind: 'user-total',
      amount: 300_000,
    });
  });

  test('excludes invalid dates from periods, counts, and monthly totals', () => {
    const context = buildAnalysisContext([
      tx('valid', '2026-03-10', 50_000),
      tx('bad-day', '2026-02-30', 90_000),
      tx('garbage', '9999-99-99-extra', 70_000),
    ])!;
    expect(context.validTransactions.map(({ id }) => id)).toEqual(['valid']);
    expect(context.invalidDateTransactions).toHaveLength(2);
    expect(context.latestTransactions).toHaveLength(1);
    expect(context.fullStatementPeriod).toEqual({
      start: '2026-03-10',
      end: '2026-03-10',
    });
    expect(context.monthlyBreakdown).toEqual([
      {
        month: parseYearMonth('2026-03'),
        spending: 50_000,
        transactionCount: 1,
      },
    ]);
  });

  test('fails before exposing an unsafe all-month dashboard total', () => {
    expect(() =>
      buildAnalysisContext([
        tx('june', '2026-06-30', Number.MAX_SAFE_INTEGER),
        tx('july', '2026-07-01', Number.MAX_SAFE_INTEGER),
      ]),
    ).toThrow(/total spending across months/);
  });
});
