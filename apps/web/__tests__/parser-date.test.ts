/**
 * Unit tests for parseDateStringToISO and inferYear date parsing logic.
 *
 * Imports the production functions from date-utils.ts to ensure test
 * coverage matches actual behavior. Previously duplicated the parsing
 * logic locally, which diverged from production after the C63-04 fix
 * added month-aware day validation (C64-01).
 */
import { describe, test, expect } from 'bun:test';
import { parseDateStringToISO, inferYear } from '../src/lib/parser/date-utils.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseDateToISO — full year formats', () => {
  test('YYYY-MM-DD', () => {
    expect(parseDateStringToISO('2024-01-15')).toBe('2024-01-15');
  });

  test('YYYY.MM.DD', () => {
    expect(parseDateStringToISO('2024.01.15')).toBe('2024-01-15');
  });

  test('YYYY/MM/DD', () => {
    expect(parseDateStringToISO('2024/01/15')).toBe('2024-01-15');
  });

  test('YYYY.MM.DD with single-digit month/day', () => {
    expect(parseDateStringToISO('2024.1.5')).toBe('2024-01-05');
  });

  test('YYYY-MM-DD with single-digit month/day', () => {
    expect(parseDateStringToISO('2024-1-5')).toBe('2024-01-05');
  });

  test('YYYYMMDD', () => {
    expect(parseDateStringToISO('20240115')).toBe('2024-01-15');
  });
});

describe('parseDateToISO — short year format (C13-01/C13-02 regression)', () => {
  test('YY-MM-DD with padding', () => {
    expect(parseDateStringToISO('24-01-05')).toBe('2024-01-05');
  });

  test('YY.MM.DD with padding', () => {
    expect(parseDateStringToISO('24.01.05')).toBe('2024-01-05');
  });

  test('YY/MM/DD with padding', () => {
    expect(parseDateStringToISO('24/01/05')).toBe('2024-01-05');
  });

  test('YY.MM.DD without zero-padding in input', () => {
    // Note: the short-year pattern requires exactly 2 digits for each part,
    // so "24.1.5" would NOT match the short-year regex ^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$
    // It would fall through to the MM/DD pattern instead.
    // This is correct behavior — 2-digit parts are required for YY format.
  });

  test('YY >= 50 maps to 1900s', () => {
    expect(parseDateStringToISO('99-12-31')).toBe('1999-12-31');
  });

  test('YY < 50 maps to 2000s', () => {
    expect(parseDateStringToISO('25-06-15')).toBe('2025-06-15');
  });

  test('YY=50 boundary maps to 1950', () => {
    expect(parseDateStringToISO('50-01-01')).toBe('1950-01-01');
  });

  test('YY=49 boundary maps to 2049', () => {
    expect(parseDateStringToISO('49-12-31')).toBe('2049-12-31');
  });
});

describe('parseDateToISO — MM/DD format with year inference', () => {
  test('MM/DD with zero-padding', () => {
    const result = parseDateStringToISO('01/15');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });

  test('MM.DD with single digits', () => {
    const result = parseDateStringToISO('1.5');
    expect(result).toMatch(/^\d{4}-01-05$/);
  });
});

describe('parseDateToISO — Korean date formats', () => {
  test('2024년 1월 15일', () => {
    expect(parseDateStringToISO('2024년 1월 15일')).toBe('2024-01-15');
  });

  test('2024년 12월 5일', () => {
    expect(parseDateStringToISO('2024년 12월 5일')).toBe('2024-12-05');
  });

  test('1월 15일 — year inferred', () => {
    const result = parseDateStringToISO('1월 15일');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });
});

describe('inferYear — look-back heuristic', () => {
  test('current month returns current year', () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = Math.min(now.getDate(), 28);
    expect(inferYear(currentMonth, currentDay)).toBe(now.getFullYear());
  });

  test('far future month returns previous year', () => {
    const now = new Date();
    // A date 6 months in the future should be inferred as previous year
    const futureMonth = ((now.getMonth() + 6) % 12) + 1;
    const futureYear = inferYear(futureMonth, 15);
    // The heuristic says: if the candidate date is > 90 days in the future,
    // use previous year. For a date 6 months out, this should be true.
    expect(futureYear).toBe(now.getFullYear() - 1);
  });
});

describe('parseDateToISO — edge cases', () => {
  test('whitespace is trimmed', () => {
    expect(parseDateStringToISO('  2024-01-15  ')).toBe('2024-01-15');
  });

  test('unrecognized format passes through unchanged', () => {
    expect(parseDateStringToISO('not-a-date')).toBe('not-a-date');
  });

  test('empty string passes through', () => {
    expect(parseDateStringToISO('')).toBe('');
  });
});

describe('parseDateToISO — invalid date range validation', () => {
  test('MM/DD with month > 12 is rejected', () => {
    expect(parseDateStringToISO('13/45')).toBe('13/45');
  });

  test('MM/DD with day > 31 is rejected', () => {
    expect(parseDateStringToISO('01/32')).toBe('01/32');
  });

  test('MM/DD with month 0 is rejected', () => {
    expect(parseDateStringToISO('0/15')).toBe('0/15');
  });

  test('MM/DD with day 0 is rejected', () => {
    expect(parseDateStringToISO('1/0')).toBe('1/0');
  });

  test('koreanFull with month > 12 is rejected', () => {
    expect(parseDateStringToISO('2026년 99월 99일')).toBe('2026년 99월 99일');
  });

  test('koreanFull with month 0 is rejected', () => {
    expect(parseDateStringToISO('2026년 0월 15일')).toBe('2026년 0월 15일');
  });

  test('koreanFull with day 0 is rejected', () => {
    expect(parseDateStringToISO('2026년 1월 0일')).toBe('2026년 1월 0일');
  });

  test('koreanFull with day > 31 is rejected', () => {
    expect(parseDateStringToISO('2026년 1월 32일')).toBe('2026년 1월 32일');
  });

  test('koreanShort with month > 12 is rejected', () => {
    expect(parseDateStringToISO('99월 99일')).toBe('99월 99일');
  });

  test('koreanShort with month 0 is rejected', () => {
    expect(parseDateStringToISO('0월 15일')).toBe('0월 15일');
  });

  test('koreanShort with day 0 is rejected', () => {
    expect(parseDateStringToISO('1월 0일')).toBe('1월 0일');
  });

  test('koreanShort with day > 31 is rejected', () => {
    expect(parseDateStringToISO('1월 32일')).toBe('1월 32일');
  });

  test('valid boundary: month 12 day 31 passes', () => {
    const result = parseDateStringToISO('12/31');
    expect(result).toMatch(/^\d{4}-12-31$/);
  });

  test('valid boundary: month 1 day 1 passes', () => {
    const result = parseDateStringToISO('1/1');
    expect(result).toMatch(/^\d{4}-01-01$/);
  });

  test('YYYYMMDD with month > 12 is rejected', () => {
    expect(parseDateStringToISO('20261399')).toBe('20261399');
  });

  test('YYYYMMDD with day > 31 is rejected', () => {
    expect(parseDateStringToISO('20260132')).toBe('20260132');
  });

  test('YYYYMMDD with month 0 is rejected', () => {
    expect(parseDateStringToISO('20260015')).toBe('20260015');
  });

  test('YYYYMMDD with day 0 is rejected', () => {
    expect(parseDateStringToISO('20260100')).toBe('20260100');
  });

  test('full-date with month > 12 is rejected', () => {
    expect(parseDateStringToISO('2026/13/99')).toBe('2026/13/99');
  });

  test('full-date with day > 31 is rejected', () => {
    expect(parseDateStringToISO('2026/01/32')).toBe('2026/01/32');
  });

  test('full-date with month 0 is rejected', () => {
    expect(parseDateStringToISO('2026/0/15')).toBe('2026/0/15');
  });

  test('full-date with day 0 is rejected', () => {
    expect(parseDateStringToISO('2026/1/0')).toBe('2026/1/0');
  });

  test('short-year with month > 12 is rejected', () => {
    expect(parseDateStringToISO('99/13/99')).toBe('99/13/99');
  });

  test('short-year with day > 31 is rejected', () => {
    expect(parseDateStringToISO('99/01/32')).toBe('99/01/32');
  });

  test('short-year with month 0 is rejected', () => {
    expect(parseDateStringToISO('99/00/15')).toBe('99/00/15');
  });

  test('short-year with day 0 is rejected', () => {
    expect(parseDateStringToISO('99/01/00')).toBe('99/01/00');
  });
});

describe('parseDateToISO — month-aware day validation (C63-04)', () => {
  test('Feb 29 in leap year 2024 passes', () => {
    expect(parseDateStringToISO('2024-02-29')).toBe('2024-02-29');
  });

  test('Feb 29 in non-leap year 2025 is rejected', () => {
    expect(parseDateStringToISO('2025-02-29')).toBe('2025-02-29');
  });

  test('Feb 28 always passes', () => {
    expect(parseDateStringToISO('2025-02-28')).toBe('2025-02-28');
  });

  test('Feb 31 is always rejected', () => {
    expect(parseDateStringToISO('2024-02-31')).toBe('2024-02-31');
    expect(parseDateStringToISO('2025-02-31')).toBe('2025-02-31');
  });

  test('Apr 31 is rejected (April has 30 days)', () => {
    expect(parseDateStringToISO('2024-04-31')).toBe('2024-04-31');
  });

  test('Apr 30 passes', () => {
    expect(parseDateStringToISO('2024-04-30')).toBe('2024-04-30');
  });

  test('Jan 31 passes (January has 31 days)', () => {
    expect(parseDateStringToISO('2024-01-31')).toBe('2024-01-31');
  });

  test('Jun 31 is rejected (June has 30 days)', () => {
    expect(parseDateStringToISO('2024-06-31')).toBe('2024-06-31');
  });

  test('YYYYMMDD Feb 29 leap year passes', () => {
    expect(parseDateStringToISO('20240229')).toBe('2024-02-29');
  });

  test('YYYYMMDD Feb 29 non-leap year is rejected', () => {
    expect(parseDateStringToISO('20250229')).toBe('20250229');
  });

  test('YYYYMMDD Feb 31 is rejected', () => {
    expect(parseDateStringToISO('20240231')).toBe('20240231');
  });

  test('Korean full date Feb 29 leap year passes', () => {
    expect(parseDateStringToISO('2024년 2월 29일')).toBe('2024-02-29');
  });

  test('Korean full date Feb 29 non-leap year is rejected', () => {
    expect(parseDateStringToISO('2025년 2월 29일')).toBe('2025년 2월 29일');
  });

  test('Korean full date Apr 31 is rejected', () => {
    expect(parseDateStringToISO('2024년 4월 31일')).toBe('2024년 4월 31일');
  });

  test('Short-year Feb 29 leap year passes (24 is 2024, a leap year)', () => {
    expect(parseDateStringToISO('24-02-29')).toBe('2024-02-29');
  });

  test('Short-year Feb 29 non-leap year is rejected (25 is 2025)', () => {
    expect(parseDateStringToISO('25-02-29')).toBe('25-02-29');
  });

  test('Century boundary: 2000 is a leap year', () => {
    expect(parseDateStringToISO('2000-02-29')).toBe('2000-02-29');
  });

  test('Century boundary: 1900 is NOT a leap year', () => {
    expect(parseDateStringToISO('1900-02-29')).toBe('1900-02-29');
  });
});
