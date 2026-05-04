/**
 * Shared date utilities for the parser modules.
 *
 * Extracted from csv.ts, xlsx.ts, and pdf.ts to eliminate triplication
 * of the inferYear() heuristic and parseDateToISO() string-parsing logic —
 * any future fix only needs to be applied once here.
 */

/** Return the number of days in a given month (1-12) for a given year.
 *  Uses the Date constructor which correctly handles leap years including
 *  the 100/400-year rules (C63-04). Exported for use by the XLSX serial-date
 *  validation path (C67-04). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Validate that a day number is within the valid range for the given
 *  year and month. Rejects impossible dates like Feb 31 or Apr 31 (C63-04).
 *  Exported for use by the XLSX serial-date validation path (C67-04). */
export function isValidDayForMonth(year: number, month: number, day: number): boolean {
  return day >= 1 && day <= daysInMonth(year, month);
}

/** Infer the year for a short-date (month/day only) using a look-back
 *  heuristic: if the date would be more than 3 months in the future,
 *  assume it belongs to the previous year. This handles the common case
 *  of uploading a December statement in January.
 *
 *  Known limitation (C8-08): uses `new Date()` which is timezone-dependent.
 *  Near midnight on Dec 31 in UTC-X timezones, `now.getFullYear()` may
 *  already be the next year, causing the look-back to pick the current
 *  year when the previous year is intended. This is a narrow edge case
 *  (minutes around midnight, once per year) and does not affect the
 *  common usage pattern. */
export function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  // If the candidate is more than ~3 months in the future, use previous year
  if (candidate.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}

/** Parse a date string in various Korean credit card statement formats to
 *  ISO 8601 (YYYY-MM-DD). Handles:
 *  - YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
 *  - YYYYMMDD (compact)
 *  - YY-MM-DD, YY.MM.DD (2-digit year)
 *  - MM/DD, MM.DD (year inferred via inferYear)
 *  - Korean full: 2024년 1월 15일
 *  - Korean short: 1월 15일 (year inferred)
 *
 *  All branches validate month/day ranges to avoid producing invalid date
 *  strings from corrupted data. If no format matches, returns the input
 *  as-is.
 *
 *  Extracted from csv.ts, xlsx.ts, and pdf.ts to eliminate triplication
 *  (C19-01). The xlsx parser additionally handles Excel serial date numbers
 *  before delegating string values here. */
export function parseDateStringToISO(raw: string): string {
  // Strip trailing delimiter characters (. - / ． 。) that Korean bank exports
  // commonly append to dates (e.g., "2024. 1. 15." → "2024. 1. 15"). These
  // trailing delimiters are formatting punctuation, not part of the date value.
  // Without stripping, the fullMatch regex's implicit end-match would still
  // succeed (it's not $-anchored), but detection patterns in isDateLike() and
  // isValidDateCell() use $-anchored regexes and would fail (C57-01).
  const cleaned = raw.trim().replace(/[.\-\/．。]\s*$/, '');

  // YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD (with optional spaces around delimiters).
  // Also accepts full-width dot (U+FF0E) and ideographic full stop (U+3002) which
  // Korean bank exports occasionally use (C22-01).
  const fullMatch = cleaned.match(/^(\d{4})[\s]*[.\-\/．。][\s]*(\d{1,2})[\s]*[.\-\/．。][\s]*(\d{1,2})/);
  if (fullMatch) {
    const year = parseInt(fullMatch[1]!, 10);
    const month = parseInt(fullMatch[2]!, 10);
    const day = parseInt(fullMatch[3]!, 10);
    if (month >= 1 && month <= 12 && isValidDayForMonth(year, month, day)) {
      return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
    }
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(cleaned)) {
    const year = parseInt(cleaned.slice(0, 4), 10);
    const month = parseInt(cleaned.slice(4, 6), 10);
    const day = parseInt(cleaned.slice(6, 8), 10);
    if (month >= 1 && month <= 12 && isValidDayForMonth(year, month, day)) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
  }

  // YYMMDD — 6-digit compact date without delimiters (C32-02). Some Korean
  // bank exports use this format. Parsed as 2-digit year: >=50 → 1900s,
  // <50 → 2000s (matching YY-MM-DD handling).
  if (/^\d{6}$/.test(cleaned)) {
    const yy = parseInt(cleaned.slice(0, 2), 10);
    const fullYear = yy >= 50 ? 1900 + yy : 2000 + yy;
    const month = parseInt(cleaned.slice(2, 4), 10);
    const day = parseInt(cleaned.slice(4, 6), 10);
    if (month >= 1 && month <= 12 && isValidDayForMonth(fullYear, month, day)) {
      return `${fullYear}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
    }
  }

  // YY-MM-DD or YY.MM.DD (also accepts full-width dot variants C22-01)
  const shortYearMatch = cleaned.match(/^(\d{2})[.\-\/．。](\d{2})[.\-\/．。](\d{2})$/);
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]!, 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    const month = parseInt(shortYearMatch[2]!, 10);
    const day = parseInt(shortYearMatch[3]!, 10);
    if (month >= 1 && month <= 12 && isValidDayForMonth(fullYear, month, day)) {
      return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
    }
  }

  // MM/DD or MM.DD — infer year with look-back heuristic (also accepts full-width dot C22-01)
  const shortMatch = cleaned.match(/^(\d{1,2})[.\-\/．。](\d{1,2})$/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1]!, 10);
    const day = parseInt(shortMatch[2]!, 10);
    if (month >= 1 && month <= 12) {
      const year = inferYear(month, day);
      if (isValidDayForMonth(year, month, day)) {
        return `${year}-${shortMatch[1]!.padStart(2, '0')}-${shortMatch[2]!.padStart(2, '0')}`;
      }
    }
  }

  // Korean full date: 2024년 1월 15일
  const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanFull) {
    const year = parseInt(koreanFull[1]!, 10);
    const month = parseInt(koreanFull[2]!, 10);
    const day = parseInt(koreanFull[3]!, 10);
    if (month >= 1 && month <= 12 && isValidDayForMonth(year, month, day)) {
      return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
    }
  }

  // Korean short date: 1월 15일
  const koreanShort = cleaned.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanShort) {
    const month = parseInt(koreanShort[1]!, 10);
    const day = parseInt(koreanShort[2]!, 10);
    if (month >= 1 && month <= 12) {
      const year = inferYear(month, day);
      if (isValidDayForMonth(year, month, day)) {
        return `${year}-${koreanShort[1]!.padStart(2, '0')}-${koreanShort[2]!.padStart(2, '0')}`;
      }
    }
  }

  // No known date format matched the input (C70-03/C56-04). Return the raw
  // string as-is for backward compatibility. Downstream code that uses
  // date-based filtering (e.g., tx.date.startsWith(latestMonth)) will skip
  // this transaction automatically because the raw string won't match the
  // "YYYY-MM" prefix. Parsers report unparseable dates as ParseError objects
  // which surface in the UI, so console.warn is unnecessary and noisy.
  return cleaned;
}

/** Validate that a 6-digit string is a plausible YYMMDD date with valid
 *  month/day ranges. Prevents false-positive date detection when a column
 *  contains 6-digit transaction IDs (e.g., "123456", "999999") that would
 *  otherwise match /^\d{6}$/ and steal the date column assignment (C45-01).
 *  Shared across CSV, XLSX, and PDF parsers. Parity with server-side
 *  packages/parser/src/date-utils.ts (C60-05). */
export function isValidYYMMDD(value: string): boolean {
  if (!/^\d{6}$/.test(value)) return false;
  const yy = parseInt(value.slice(0, 2), 10);
  const fullYear = yy >= 50 ? 1900 + yy : 2000 + yy;
  const month = parseInt(value.slice(2, 4), 10);
  const day = parseInt(value.slice(4, 6), 10);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(fullYear, month);
}

/** Check if a string is a valid ISO 8601 date (YYYY-MM-DD).
 *  Used by parsers to detect unparseable dates returned by
 *  parseDateStringToISO() and report them as parse errors (C71-04). */
export function isValidISODate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
