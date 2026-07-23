import { describe, expect, test } from 'bun:test';
import {
  buildAnalysisContext,
  isValidIsoDate,
  isYearMonth,
  previousCalendarMonth,
} from '../src/lib/analysis-context.js';

function tx(id: string, date: string, amount = 10_000) {
  return { id, date, amount };
}

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

  test('validates YearMonth and rolls January across the year boundary', () => {
    expect(isYearMonth('2026-01')).toBe(true);
    expect(isYearMonth('2026-00')).toBe(false);
    expect(previousCalendarMonth('2026-01')).toBe('2025-12');
    expect(previousCalendarMonth('2026-03')).toBe('2026-02');
  });
});

describe('buildAnalysisContext', () => {
  test('uses only the exact previous calendar month', () => {
    const context = buildAnalysisContext([
      tx('jan', '2026-01-15', 30_000),
      tx('mar', '2026-03-10', 50_000),
    ])!;
    expect(context.latestMonth).toBe('2026-03');
    expect(context.previousTransactions).toHaveLength(0);
    expect(context.previousSpendingBasis).toEqual({
      kind: 'missing-calendar-month',
      month: '2026-02',
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
      { month: '2026-03', spending: 50_000, transactionCount: 1 },
    ]);
  });
});
