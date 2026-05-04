/** Shared date utilities for server-side parsers.
 *  Centralized to avoid triplicating the logic across CSV, XLSX, and PDF
 *  parsers (C19-01/C34-05/C35-03). The web-side equivalent is in
 *  apps/web/src/lib/parser/date-utils.ts. */

/** Return the number of days in a given month (1-12) for a given year.
 *  Uses the Date constructor which correctly handles leap years including
 *  the 100/400-year rules (C66-01). Exported for use by the XLSX serial-date
 *  validation path (C67-04). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Validate that a day number is within the valid range for the given
 *  year and month. Rejects impossible dates like Feb 31 or Apr 31 (C66-01).
 *  Exported for use by the XLSX serial-date validation path (C67-04). */
export function isValidDayForMonth(year: number, month: number, day: number): boolean {
  return day >= 1 && day <= daysInMonth(year, month);
}

/** Infer the year for a short-date (month/day only) using a look-back
 *  heuristic: if the date would be more than 3 months in the future,
 *  assume it belongs to the previous year. */
export function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
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
 *  Shared across the generic CSV parser and bank-specific CSV adapters to
 *  eliminate per-adapter duplication (C35-03). The XLSX and PDF parsers
 *  have their own parseDateToISO that additionally handle Excel serial
 *  date numbers before delegating string values here. */
export function parseDateStringToISO(raw: string): string {
  const cleaned = raw.trim();

  // YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})/);
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

  // YY-MM-DD or YY.MM.DD
  const shortYearMatch = cleaned.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$/);
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]!, 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    const month = parseInt(shortYearMatch[2]!, 10);
    const day = parseInt(shortYearMatch[3]!, 10);
    if (month >= 1 && month <= 12 && isValidDayForMonth(fullYear, month, day)) {
      return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
    }
  }

  // MM/DD or MM.DD — infer year with look-back heuristic
  const shortMatch = cleaned.match(/^(\d{1,2})[.\-\/](\d{1,2})$/);
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

  return cleaned;
}

/** Check if a string is a valid ISO 8601 date (YYYY-MM-DD).
 *  Used by parsers to detect unparseable dates returned by
 *  parseDateStringToISO() and report them as parse errors.
 *  Parity with web-side apps/web/src/lib/parser/date-utils.ts. */
export function isValidISODate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
