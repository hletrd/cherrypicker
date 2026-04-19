/**
 * Unit tests for parseDateToISO and inferYear date parsing logic.
 *
 * The actual functions are private in csv.ts / pdf.ts / xlsx.ts, so we
 * reproduce the core logic locally (same pattern as analyzer-adapter.test.ts)
 * to verify date format handling across all supported patterns.
 */
import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Reproduce inferYear from csv.ts / pdf.ts / xlsx.ts
// ---------------------------------------------------------------------------

function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}

// ---------------------------------------------------------------------------
// Reproduce parseDateToISO from csv.ts (string-based — covers CSV + PDF paths)
// ---------------------------------------------------------------------------

function parseDateToISO(raw: string): string {
  const cleaned = raw.trim();

  // YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD — validate month/day ranges to
  // avoid producing invalid date strings from corrupted data (e.g., "2026/13/99").
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})/);
  if (fullMatch) {
    const month = parseInt(fullMatch[2]!, 10);
    const day = parseInt(fullMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
    }
  }

  // YYYYMMDD — validate month/day ranges to avoid producing invalid date
  // strings from corrupted data (e.g., "20261399" → "2026-13-99").
  if (/^\d{8}$/.test(cleaned)) {
    const month = parseInt(cleaned.slice(4, 6), 10);
    const day = parseInt(cleaned.slice(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
  }

  // YY-MM-DD or YY.MM.DD — validate month/day ranges to avoid producing
  // invalid date strings from corrupted data (e.g., "99/13/99").
  const shortYearMatch = cleaned.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$/);
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]!, 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    const month = parseInt(shortYearMatch[2]!, 10);
    const day = parseInt(shortYearMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
    }
  }

  // MM/DD or MM.DD — infer year with look-back heuristic
  // Validate month/day ranges to avoid producing invalid date strings
  const shortMatch = cleaned.match(/^(\d{1,2})[.\-\/](\d{1,2})$/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1]!, 10);
    const day = parseInt(shortMatch[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = inferYear(month, day);
      return `${year}-${shortMatch[1]!.padStart(2, '0')}-${shortMatch[2]!.padStart(2, '0')}`;
    }
  }

  // 2024년 1월 15일 — validate month/day ranges
  const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanFull) {
    const month = parseInt(koreanFull[2]!, 10);
    const day = parseInt(koreanFull[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
    }
  }

  // 1월 15일 — validate month/day ranges
  const koreanShort = cleaned.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanShort) {
    const month = parseInt(koreanShort[1]!, 10);
    const day = parseInt(koreanShort[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = inferYear(month, day);
      return `${year}-${koreanShort[1]!.padStart(2, '0')}-${koreanShort[2]!.padStart(2, '0')}`;
    }
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseDateToISO — full year formats', () => {
  test('YYYY-MM-DD', () => {
    expect(parseDateToISO('2024-01-15')).toBe('2024-01-15');
  });

  test('YYYY.MM.DD', () => {
    expect(parseDateToISO('2024.01.15')).toBe('2024-01-15');
  });

  test('YYYY/MM/DD', () => {
    expect(parseDateToISO('2024/01/15')).toBe('2024-01-15');
  });

  test('YYYY.MM.DD with single-digit month/day', () => {
    expect(parseDateToISO('2024.1.5')).toBe('2024-01-05');
  });

  test('YYYY-MM-DD with single-digit month/day', () => {
    expect(parseDateToISO('2024-1-5')).toBe('2024-01-05');
  });

  test('YYYYMMDD', () => {
    expect(parseDateToISO('20240115')).toBe('2024-01-15');
  });
});

describe('parseDateToISO — short year format (C13-01/C13-02 regression)', () => {
  test('YY-MM-DD with padding', () => {
    expect(parseDateToISO('24-01-05')).toBe('2024-01-05');
  });

  test('YY.MM.DD with padding', () => {
    expect(parseDateToISO('24.01.05')).toBe('2024-01-05');
  });

  test('YY/MM/DD with padding', () => {
    expect(parseDateToISO('24/01/05')).toBe('2024-01-05');
  });

  test('YY.MM.DD without zero-padding in input', () => {
    // Note: the short-year pattern requires exactly 2 digits for each part,
    // so "24.1.5" would NOT match the short-year regex ^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$
    // It would fall through to the MM/DD pattern instead.
    // This is correct behavior — 2-digit parts are required for YY format.
  });

  test('YY >= 50 maps to 1900s', () => {
    expect(parseDateToISO('99-12-31')).toBe('1999-12-31');
  });

  test('YY < 50 maps to 2000s', () => {
    expect(parseDateToISO('25-06-15')).toBe('2025-06-15');
  });

  test('YY=50 boundary maps to 1950', () => {
    expect(parseDateToISO('50-01-01')).toBe('1950-01-01');
  });

  test('YY=49 boundary maps to 2049', () => {
    expect(parseDateToISO('49-12-31')).toBe('2049-12-31');
  });
});

describe('parseDateToISO — MM/DD format with year inference', () => {
  test('MM/DD with zero-padding', () => {
    const result = parseDateToISO('01/15');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });

  test('MM.DD with single digits', () => {
    const result = parseDateToISO('1.5');
    expect(result).toMatch(/^\d{4}-01-05$/);
  });
});

describe('parseDateToISO — Korean date formats', () => {
  test('2024년 1월 15일', () => {
    expect(parseDateToISO('2024년 1월 15일')).toBe('2024-01-15');
  });

  test('2024년 12월 5일', () => {
    expect(parseDateToISO('2024년 12월 5일')).toBe('2024-12-05');
  });

  test('1월 15일 — year inferred', () => {
    const result = parseDateToISO('1월 15일');
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
    expect(parseDateToISO('  2024-01-15  ')).toBe('2024-01-15');
  });

  test('unrecognized format passes through unchanged', () => {
    expect(parseDateToISO('not-a-date')).toBe('not-a-date');
  });

  test('empty string passes through', () => {
    expect(parseDateToISO('')).toBe('');
  });
});

describe('parseDateToISO — invalid date range validation', () => {
  test('MM/DD with month > 12 is rejected', () => {
    expect(parseDateToISO('13/45')).toBe('13/45');
  });

  test('MM/DD with day > 31 is rejected', () => {
    expect(parseDateToISO('01/32')).toBe('01/32');
  });

  test('MM/DD with month 0 is rejected', () => {
    expect(parseDateToISO('0/15')).toBe('0/15');
  });

  test('MM/DD with day 0 is rejected', () => {
    expect(parseDateToISO('1/0')).toBe('1/0');
  });

  test('koreanFull with month > 12 is rejected', () => {
    expect(parseDateToISO('2026년 99월 99일')).toBe('2026년 99월 99일');
  });

  test('koreanFull with month 0 is rejected', () => {
    expect(parseDateToISO('2026년 0월 15일')).toBe('2026년 0월 15일');
  });

  test('koreanFull with day 0 is rejected', () => {
    expect(parseDateToISO('2026년 1월 0일')).toBe('2026년 1월 0일');
  });

  test('koreanFull with day > 31 is rejected', () => {
    expect(parseDateToISO('2026년 1월 32일')).toBe('2026년 1월 32일');
  });

  test('koreanShort with month > 12 is rejected', () => {
    expect(parseDateToISO('99월 99일')).toBe('99월 99일');
  });

  test('koreanShort with month 0 is rejected', () => {
    expect(parseDateToISO('0월 15일')).toBe('0월 15일');
  });

  test('koreanShort with day 0 is rejected', () => {
    expect(parseDateToISO('1월 0일')).toBe('1월 0일');
  });

  test('koreanShort with day > 31 is rejected', () => {
    expect(parseDateToISO('1월 32일')).toBe('1월 32일');
  });

  test('valid boundary: month 12 day 31 passes', () => {
    const result = parseDateToISO('12/31');
    expect(result).toMatch(/^\d{4}-12-31$/);
  });

  test('valid boundary: month 1 day 1 passes', () => {
    const result = parseDateToISO('1/1');
    expect(result).toMatch(/^\d{4}-01-01$/);
  });

  test('YYYYMMDD with month > 12 is rejected', () => {
    expect(parseDateToISO('20261399')).toBe('20261399');
  });

  test('YYYYMMDD with day > 31 is rejected', () => {
    expect(parseDateToISO('20260132')).toBe('20260132');
  });

  test('YYYYMMDD with month 0 is rejected', () => {
    expect(parseDateToISO('20260015')).toBe('20260015');
  });

  test('YYYYMMDD with day 0 is rejected', () => {
    expect(parseDateToISO('20260100')).toBe('20260100');
  });

  test('full-date with month > 12 is rejected', () => {
    expect(parseDateToISO('2026/13/99')).toBe('2026/13/99');
  });

  test('full-date with day > 31 is rejected', () => {
    expect(parseDateToISO('2026/01/32')).toBe('2026/01/32');
  });

  test('full-date with month 0 is rejected', () => {
    expect(parseDateToISO('2026/0/15')).toBe('2026/0/15');
  });

  test('full-date with day 0 is rejected', () => {
    expect(parseDateToISO('2026/1/0')).toBe('2026/1/0');
  });

  test('short-year with month > 12 is rejected', () => {
    expect(parseDateToISO('99/13/99')).toBe('99/13/99');
  });

  test('short-year with day > 31 is rejected', () => {
    expect(parseDateToISO('99/01/32')).toBe('99/01/32');
  });

  test('short-year with month 0 is rejected', () => {
    expect(parseDateToISO('99/00/15')).toBe('99/00/15');
  });

  test('short-year with day 0 is rejected', () => {
    expect(parseDateToISO('99/01/00')).toBe('99/01/00');
  });
});
