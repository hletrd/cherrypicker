import { ParseError } from '../types.js';
import { parseAmountString } from '../shared/amount.js';
import {
  splitDelimitedRecord,
  splitDelimitedRecords,
  splitDelimitedRecordsWithLines,
  type DelimitedLogicalRecord,
} from '../shared/delimiter.js';

export { parseAmountString } from '../shared/amount.js';

/** Shared utilities for CSV parsers.
 *  Extracted from 10 bank-specific adapters and the generic parser to
 *  eliminate duplicated splitLine/parseAmount/installment-parsing code
 *  across 11 files (C36-02). */

/** RFC 4180-style CSV line splitter. Handles quoted fields and doubled-quote
 *  escapes for any delimiter (comma, tab, pipe, semicolon). Previously only
 *  comma-delimited content used proper quote handling — other delimiters
 *  fell back to naive split, which broke when fields contained the delimiter
 *  character inside quotes (C13-01). */
export function splitCSVLine(line: string, delimiter: string): string[] {
  return splitDelimitedRecord(line, delimiter);
}

/** Split CSV content into logical lines, handling multi-line quoted fields.
 *  RFC 4180 allows fields enclosed in double quotes to contain newline
 *  characters. Korean bank CSVs exported from Excel may include such fields
 *  (e.g., merchant names or memo fields with embedded line breaks). This
 *  function normalizes CRLF to LF, then reassembles lines that fall within
 *  quoted fields before splitting into logical lines.
 *
 *  Empty/whitespace-only logical lines are filtered out to match the
 *  behavior of the previous `content.split('\n').filter(l => l.trim())`
 *  pattern used throughout the CSV parsers (C66-01). */
export function splitCSVContent(content: string, delimiter: string): string[] {
  return splitDelimitedRecords(content, delimiter);
}

export function splitCSVRecords(
  content: string,
  delimiter: string,
): DelimitedLogicalRecord[] {
  return splitDelimitedRecordsWithLines(content, delimiter);
}

/** Parse an amount string from CSV data. Delegates to parseAmountString
 *  for the actual parsing logic. Kept as a named export for backward
 *  compatibility with existing imports (C97-02). */
export function parseCSVAmount(raw: string): number | null {
  return parseAmountString(raw);
}

/** Validate that a parsed amount is usable for optimization: not null (parseable),
 *  not zero (balance inquiries, declined transactions), and not negative (refunds).
 *  Pushes an error and returns false if the amount is null (unparseable).
 *  Zero/negative amounts are silently skipped — they don't contribute to spending.
 *  Acts as a TypeScript type guard: when it returns true, `amount` is narrowed
 *  from `number | null` to `number` (C70-04). */
export function isValidCSVAmount(
  amount: number | null,
  amountRaw: string,
  lineIdx: number,
  errors: ParseError[],
): amount is number {
  if (amount === null) {
    if (amountRaw.trim()) {
      errors.push(new ParseError(`금액을 해석할 수 없습니다: ${amountRaw}`, { line: lineIdx + 1 }));
    }
    return false;
  }
  if (amount <= 0) {
    if (amountRaw.trim()) {
      errors.push(new ParseError(
        `지출로 처리되지 않는 금액입니다: ${amountRaw} ${amount}원`,
        { line: lineIdx + 1 },
      ));
    }
    return false;
  }
  return true;
}

/** Parse an amount string to a number. Handles all Korean Won amount formats:
 *  - Fullwidth digits (０-９), fullwidth comma/dot/minus, fullwidth parentheses
 *  - KRW currency prefix
 *  - Won sign (₩/￦) prefix and 원 suffix
 *  - 마이너스 prefix for negative amounts
 *  - Parenthesized negatives: (1,234) → -1234
 *  - Trailing minus: 1,234- → -1234
 *  - Leading plus: +1,234 → 1234
 *  - Comma-separated thousands: 1,234,567
 *  - Bare integers: 10000 or 10000원
 *
 *  Returns null for unparseable inputs (NaN), matching the behavior of the
 *  per-parser amount parsing functions. Shared across CSV, XLSX, and PDF
 *  parsers to eliminate code duplication (C97-02). */
/** Parse an installment value from a CSV cell. Returns undefined for
 *  non-numeric values (e.g., "일시불" for lump-sum) which are common and
 *  expected — they mean no installment, not a parse error. Returns the
 *  installment count only when > 1. Extracted from 10 duplicated blocks
 *  across bank adapters (C24-01/C36-02). */
export function parseCSVInstallments(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const inst = parseInt(raw, 10);
  if (Number.isNaN(inst)) return undefined;
  return inst > 1 ? inst : undefined;
}

/** Fix malformed closing tags and strip dangerous content before SheetJS parsing.
 *  Removes script tags, event handlers, iframe/object/embed tags, and style blocks
 *  to prevent entity expansion bombs and unexpected SheetJS behavior (C20-SEC02).
 *  Shared between HTML and XLSX parsers to eliminate duplication (C100-04). */
export function normalizeHTML(html: string): string {
  return html
    // Strip script tags and their contents
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Strip style tags and their contents
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Strip iframe, object, embed tags
    .replace(/<(iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed)[^>]*>/gi, '')
    // Remove event handler attributes (onclick, onerror, etc.)
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`)/gi, '')
    .replace(/\son\w+\s*=\s*[^>\s]*/gi, '')
    // Strip javascript: pseudo-protocol URLs from href/src attributes
    // Defense-in-depth against XSS if HTML is ever rendered (C28-SEC01)
    .replace(/\s*(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s"'>]*)/gi, '')
    // Fix malformed closing tags
    .replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>')
    .replace(/<\/([a-z][a-z0-9]*)\s+>/gi, '</$1>');
}
