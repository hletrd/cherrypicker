/** Shared utilities for CSV parsers.
 *  Extracted from 10 bank-specific adapters and the generic parser to
 *  eliminate duplicated splitLine/parseAmount/installment-parsing code
 *  across 11 files (C36-02). */

/** RFC 4180 compliant CSV line splitter. Handles quoted fields and
 *  doubled-quote escapes for comma-delimited content; falls back to
 *  simple split for other delimiters. */
export function splitCSVLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') return line.split(delimiter).map((v) => v.trim());
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
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
 *  strips Korean Won suffix and comma separators. */
export function parseCSVAmount(raw: string): number | null {
  let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
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
