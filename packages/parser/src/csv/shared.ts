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
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse an amount string from CSV data. Returns null for unparseable inputs
 *  (NaN), handles parenthesized negatives like (1,234) → -1234, uses
 *  Math.round(parseFloat(...)) for correct rounding (C21-03/C35-01), and
 *  strips Korean Won suffix, comma separators, and internal whitespace
 *  (C70-04 — matches the web CSV parser's behavior). */
export function parseCSVAmount(raw: string): number | null {
  let cleaned = raw.trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48)) // full-width digits ０-９ -> 0-9
    .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-') // full-width comma/dot/minus -> ASCII
    .replace(/（/g, '(').replace(/）/g, ')') // full-width parentheses -> ASCII
    .replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
  // Handle "마이너스" prefix — some Korean bank exports use this instead of
  // a negative sign or parentheses (C32-05). Must be checked before stripping.
  const isManeuners = /^마이너스/.test(cleaned);
  if (isManeuners) cleaned = cleaned.replace(/^마이너스/, '');
  const isNeg = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1);
  if (!cleaned) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
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
  errors: { line?: number; message: string; raw?: string }[],
): amount is number {
  if (amount === null) {
    if (amountRaw.trim()) {
      errors.push({ line: lineIdx + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}` });
    }
    return false;
  }
  if (amount <= 0) return false;
  return true;
}

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
