// ---------------------------------------------------------------------------
// Shared amount parser (extracted from csv.ts and pdf.ts — C27-COR03)
// ---------------------------------------------------------------------------

/**
 * Parse an amount string from Korean bank statement exports.
 * Handles full-width digits, Won signs, 마이너스 prefix, trailing minus,
 * parenthesized negatives, KRW prefix, and comma separators.
 * Returns null for unparseable inputs so callers can distinguish between
 * genuinely zero amounts and parse failures.
 */
/** Alias for parseAmount to match the server-side API shape.
 *  HTML and other parsers import this name for clarity (C29-HIGH-02). */
export const parseAmountString = parseAmount;

export function parseAmount(raw: string): number | null {
  if (!raw.trim()) return null; // Early return for empty/whitespace-only input (C84-02 parity with server-side)
  let cleaned = raw.trim()
    .replace(/^\+/, '') // Strip leading + sign used by some banks for positive amounts (C66-02)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48)) // full-width digits -> ASCII
    .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-').replace(/＋/g, '+') // full-width comma/dot/minus/plus -> ASCII
    .replace(/（/g, '(').replace(/）/g, ')') // full-width parentheses -> ASCII
    .replace(/^KRW\s*/i, '') // ISO 4217 KRW currency prefix (C56-01)
    .replace(/\s*원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
  // Handle "마이너스" prefix — some Korean bank exports use this instead of
  // a negative sign or parentheses (parity with server-side parseCSVAmount
  // in packages/parser/src/csv/shared.ts C33-03). Must be checked after
  // stripping 원/₩ so that inputs like "마이너스1,234원" are correctly
  // detected, and parenthesized amounts like "(1,234원)" work correctly.
  const isManeuners = /^마이너스/.test(cleaned);
  if (isManeuners) cleaned = cleaned.replace(/^마이너스/, '');
  // Handle trailing minus sign — some Korean bank exports use "1,234-"
  // instead of "-1,234" for negative amounts (C68-01).
  const hasTrailingMinus = /\d-$/.test(cleaned);
  if (hasTrailingMinus) cleaned = cleaned.replace(/-$/, '');
  const isNegative = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners || hasTrailingMinus;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1);
  // Reject strings with multiple decimal points (e.g., "1.2.3") or empty-after-dot (e.g., "1.")
  // These are not valid Korean Won amounts (C29-HIGH-01).
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  if (dotCount > 1 || cleaned.endsWith('.')) return null;
  if (!cleaned) return null; // Explicit empty guard for parity with server-side (C29-HIGH-01)
  // Reject malformed strings like "1-2-3" that parseFloat would silently accept (C31-CR01).
  // Allow trailing "원" (e.g., "1234원" → parseFloat returns 1234) which some bank
  // exports include inside parentheses like "(1,234 원)" (C72-01). Reject other
  // trailing characters like "1234abc" which indicate corrupted/malformed input.
  const numMatch = cleaned.match(/^[+-]?\d+(?:\.\d+)?/);
  if (!numMatch) return null;
  const afterNum = cleaned.slice(numMatch[0].length);
  if (/[\d.]/.test(afterNum)) return null;
  if (afterNum.trim() && afterNum.trim() !== '원') return null;
  // Use Math.round(parseFloat(...)) to match the xlsx parser's rounding behavior
  // (C21-03). Korean Won amounts are always integers, but formula-rendered CSV
  // cells may contain decimal remainders; rounding is more correct than truncation.
  const parsed = Math.round(parseFloat(cleaned));
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
  if (Math.abs(parsed) > Number.MAX_SAFE_INTEGER) return null;
  return isNegative ? -parsed : parsed;
}
