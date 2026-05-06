/** Shared amount parsing utilities.
 *  Extracted from csv/shared.ts and xlsx/index.ts to provide a dedicated
 *  module for amount parsing, matching the web-side structure (C28-ARCH01).
 *
 *  Used by CSV, XLSX, PDF, HTML, and OFX parsers. */

import { parseAmountString as _parseAmountString } from './csv/shared.js';

/** Re-export the canonical string-based amount parser from csv/shared.ts.
 *  Handles full-width digits, Won signs, 마이너스 prefix, trailing minus,
 *  parenthesized negatives, KRW prefix, comma separators, and more.
 *  Returns null for unparseable inputs. */
export const parseAmountString = _parseAmountString;

/** Parse an amount value that may be a number or string.
 *  Handles numeric cell values (rounds to integer Won) and delegates
 *  string values to parseAmountString. Returns null for non-finite
 *  numbers, unparseable strings, and other types.
 *
 *  Shared across XLSX, PDF, and other parsers that receive raw cell
 *  values of unknown type (C28-CR01). */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw) : null;
  }
  if (typeof raw === 'string') {
    const parsed = _parseAmountString(raw);
    return parsed !== null && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
