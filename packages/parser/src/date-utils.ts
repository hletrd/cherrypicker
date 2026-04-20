/** Shared date utilities for server-side parsers.
 *  Centralized to avoid triplicating the logic across CSV, XLSX, and PDF
 *  parsers (C19-01/C34-05). The web-side equivalent is in
 *  apps/web/src/lib/parser/date-utils.ts. */

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
