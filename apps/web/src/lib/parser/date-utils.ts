/**
 * Shared date utilities for the parser modules.
 *
 * Extracted from csv.ts, xlsx.ts, and pdf.ts to eliminate triplication
 * of the inferYear() heuristic — any future fix only needs to be applied
 * once here.
 */

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
