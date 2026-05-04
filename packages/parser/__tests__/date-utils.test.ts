import { describe, test, expect } from 'bun:test';
import { parseDateStringToISO, daysInMonth, isValidDayForMonth, inferYear, isValidISODate } from '../src/date-utils.js';

describe('daysInMonth', () => {
  test('returns 28 for Feb in non-leap year', () => {
    expect(daysInMonth(2023, 2)).toBe(28);
  });

  test('returns 29 for Feb in leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  test('returns 28 for Feb in century non-leap year', () => {
    expect(daysInMonth(1900, 2)).toBe(28);
  });

  test('returns 29 for Feb in 400-year leap year', () => {
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  test('returns 31 for January', () => {
    expect(daysInMonth(2024, 1)).toBe(31);
  });

  test('returns 30 for April', () => {
    expect(daysInMonth(2024, 4)).toBe(30);
  });
});

describe('isValidDayForMonth', () => {
  test('accepts valid day', () => {
    expect(isValidDayForMonth(2024, 1, 15)).toBe(true);
  });

  test('rejects day 0', () => {
    expect(isValidDayForMonth(2024, 1, 0)).toBe(false);
  });

  test('rejects Feb 30', () => {
    expect(isValidDayForMonth(2024, 2, 30)).toBe(false);
  });

  test('rejects Feb 29 in non-leap year', () => {
    expect(isValidDayForMonth(2023, 2, 29)).toBe(false);
  });

  test('accepts Feb 29 in leap year', () => {
    expect(isValidDayForMonth(2024, 2, 29)).toBe(true);
  });

  test('rejects Apr 31', () => {
    expect(isValidDayForMonth(2024, 4, 31)).toBe(false);
  });

  test('month 13 rolls to January via Date constructor', () => {
    // isValidDayForMonth doesn't validate month range — that's the caller's
    // job (parseDateStringToISO validates month 1-12 before calling this).
    // JavaScript's Date constructor rolls month 13 to Jan next year, so
    // daysInMonth(2024, 13) returns 31 and day 15 is "valid" within that.
    // This is acceptable because callers always check month range first.
    expect(isValidDayForMonth(2024, 13, 15)).toBe(true);
  });
});

describe('parseDateStringToISO', () => {
  test('parses YYYY-MM-DD', () => {
    expect(parseDateStringToISO('2024-01-15')).toBe('2024-01-15');
  });

  test('parses YYYY.MM.DD', () => {
    expect(parseDateStringToISO('2024.01.15')).toBe('2024-01-15');
  });

  test('parses YYYY/MM/DD', () => {
    expect(parseDateStringToISO('2024/01/15')).toBe('2024-01-15');
  });

  test('parses YYYY.MM.DD with single-digit month/day', () => {
    expect(parseDateStringToISO('2024.1.5')).toBe('2024-01-05');
  });

  test('parses YYYYMMDD compact format', () => {
    expect(parseDateStringToISO('20240115')).toBe('2024-01-15');
  });

  // C32-02: YYMMDD compact date format (6 digits without delimiters)
  test('parses YYMMDD compact format (240115 → 2024-01-15)', () => {
    expect(parseDateStringToISO('240115')).toBe('2024-01-15');
  });

  test('parses YYMMDD with pre-50 year as 2000s', () => {
    expect(parseDateStringToISO('240115')).toBe('2024-01-15');
    expect(parseDateStringToISO('010315')).toBe('2001-03-15');
  });

  test('parses YYMMDD with post-50 year as 1900s', () => {
    expect(parseDateStringToISO('990115')).toBe('1999-01-15');
    expect(parseDateStringToISO('780630')).toBe('1978-06-30');
  });

  test('rejects YYMMDD with invalid month', () => {
    // Month 13 is invalid — should return raw string
    expect(parseDateStringToISO('241301')).toBe('241301');
  });

  test('rejects YYMMDD with invalid day', () => {
    // Feb 30 is invalid
    expect(parseDateStringToISO('240230')).toBe('240230');
  });

  test('rejects YYMMDD with Apr 31', () => {
    expect(parseDateStringToISO('240431')).toBe('240431');
  });

  test('YYMMDD does not collide with YYYYMM (first 6 of 8-digit)', () => {
    // 202401 is NOT YYMMDD (would be year 20, month 24, day 01 — invalid month)
    // But 240115 IS valid YYMMDD (year 2024, month 01, day 15)
    // The 8-digit check runs first, so 8-digit dates won't fall through
    expect(parseDateStringToISO('20240115')).toBe('2024-01-15'); // 8-digit wins
    expect(parseDateStringToISO('240115')).toBe('2024-01-15'); // 6-digit
  });

  test('parses YY-MM-DD (2-digit year)', () => {
    expect(parseDateStringToISO('24-01-15')).toBe('2024-01-15');
  });

  test('parses YY-MM-DD with pre-50 year as 2000s', () => {
    expect(parseDateStringToISO('24-01-15')).toBe('2024-01-15');
  });

  test('parses YY-MM-DD with post-50 year as 1900s', () => {
    expect(parseDateStringToISO('99-01-15')).toBe('1999-01-15');
  });

  test('parses MM/DD format (year inferred)', () => {
    // The result depends on current date, so just check format
    const result = parseDateStringToISO('01/15');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });

  test('parses MM.DD format (year inferred)', () => {
    const result = parseDateStringToISO('1.5');
    expect(result).toMatch(/^\d{4}-01-05$/);
  });

  test('parses Korean full date: 2024년 1월 15일', () => {
    expect(parseDateStringToISO('2024년 1월 15일')).toBe('2024-01-15');
  });

  test('parses Korean short date: 1월 15일 (year inferred)', () => {
    const result = parseDateStringToISO('1월 15일');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });

  test('rejects invalid month 13', () => {
    expect(parseDateStringToISO('2024-13-01')).toBe('2024-13-01');
  });

  test('rejects Feb 30', () => {
    expect(parseDateStringToISO('2024-02-30')).toBe('2024-02-30');
  });

  test('rejects Apr 31', () => {
    expect(parseDateStringToISO('2024-04-31')).toBe('2024-04-31');
  });

  test('accepts Feb 29 in leap year', () => {
    expect(parseDateStringToISO('2024-02-29')).toBe('2024-02-29');
  });

  test('rejects Feb 29 in non-leap year', () => {
    expect(parseDateStringToISO('2023-02-29')).toBe('2023-02-29');
  });

  test('returns raw string for unrecognized format', () => {
    expect(parseDateStringToISO('not-a-date')).toBe('not-a-date');
  });

  test('trims whitespace', () => {
    expect(parseDateStringToISO('  2024-01-15  ')).toBe('2024-01-15');
  });

  test('handles empty string', () => {
    expect(parseDateStringToISO('')).toBe('');
  });

  // Full-width dot (U+FF0E) and ideographic full stop (U+3002) support (C22-01)
  test('parses YYYY．MM．DD with full-width dot', () => {
    expect(parseDateStringToISO('2024．01．15')).toBe('2024-01-15');
  });

  test('parses YYYY。MM。DD with ideographic full stop', () => {
    expect(parseDateStringToISO('2024。01。15')).toBe('2024-01-15');
  });

  test('parses YY．MM．DD with full-width dot', () => {
    expect(parseDateStringToISO('24．01．15')).toBe('2024-01-15');
  });

  test('parses MM．DD with full-width dot (year inferred)', () => {
    const result = parseDateStringToISO('1．15');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });

  test('parses mixed dot types YYYY．MM.DD', () => {
    expect(parseDateStringToISO('2024．01.15')).toBe('2024-01-15');
  });

  // Datetime strings — the non-anchored fullMatch regex extracts just the date
  // portion, which is correct behavior for CSV/XLSX cells containing times.
  test('parses datetime YYYY-MM-DD HH:MM:SS by extracting date portion', () => {
    expect(parseDateStringToISO('2024-01-15 10:30:00')).toBe('2024-01-15');
  });

  test('parses datetime YYYY.MM.DD HH:MM by extracting date portion', () => {
    expect(parseDateStringToISO('2024.01.15 14:30')).toBe('2024-01-15');
  });

  test('parses datetime with full-width dot by extracting date portion', () => {
    expect(parseDateStringToISO('2024．01．15 09:00')).toBe('2024-01-15');
  });

  test('parses datetime with single-digit month/day', () => {
    expect(parseDateStringToISO('2024-1-5 08:00')).toBe('2024-01-05');
  });

  // C57-01: Trailing delimiter stripping — Korean bank exports commonly
  // append a period to dates like "2024. 1. 15." or a slash like "1/15/".
  test('parses YYYY.MM.DD with trailing period (C57-01)', () => {
    expect(parseDateStringToISO('2024. 1. 15.')).toBe('2024-01-15');
  });

  test('parses YYYY.MM.DD with trailing dot (no space)', () => {
    expect(parseDateStringToISO('2024.01.15.')).toBe('2024-01-15');
  });

  test('parses YYYY/MM/DD with trailing slash', () => {
    expect(parseDateStringToISO('2024/01/15/')).toBe('2024-01-15');
  });

  test('parses YYYY-MM-DD with trailing hyphen', () => {
    expect(parseDateStringToISO('2024-01-15-')).toBe('2024-01-15');
  });

  test('parses YY.MM.DD with trailing period', () => {
    expect(parseDateStringToISO('24.01.15.')).toBe('2024-01-15');
  });

  test('parses MM/DD with trailing slash (year inferred)', () => {
    const result = parseDateStringToISO('1/15/');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });

  test('parses MM.DD with trailing period (year inferred)', () => {
    const result = parseDateStringToISO('1.15.');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });

  test('parses full-width dot date with trailing full-width dot', () => {
    expect(parseDateStringToISO('2024．01．15．')).toBe('2024-01-15');
  });
});

// ---------------------------------------------------------------------------
// isValidISODate tests
// ---------------------------------------------------------------------------

describe('isValidISODate', () => {
  test('accepts valid ISO date', () => {
    expect(isValidISODate('2024-01-15')).toBe(true);
  });

  test('accepts leap year date', () => {
    expect(isValidISODate('2024-02-29')).toBe(true);
  });

  test('rejects date without leading zeros', () => {
    expect(isValidISODate('2024-1-5')).toBe(false);
  });

  test('rejects raw date string', () => {
    expect(isValidISODate('2024.01.15')).toBe(false);
  });

  test('rejects Korean date format', () => {
    expect(isValidISODate('2024년 1월 15일')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidISODate('')).toBe(false);
  });

  test('rejects garbage string', () => {
    expect(isValidISODate('not-a-date')).toBe(false);
  });

  test('rejects date with extra content', () => {
    expect(isValidISODate('2024-01-15 extra')).toBe(false);
  });
});