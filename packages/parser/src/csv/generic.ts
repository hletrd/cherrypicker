import type { BankId, ParseError, ParseResult, RawTransaction } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';
import { parseDateStringToISO, isValidISODate, daysInMonth } from '../date-utils.js';
import { splitCSVLine, parseCSVAmount, parseCSVInstallments, isValidCSVAmount } from './shared.js';
import {
  normalizeHeader,
  findColumn,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  SUMMARY_ROW_PATTERN,
  HEADER_KEYWORDS,
  isValidHeaderRow,
} from './column-matcher.js';

// Korean date patterns — must cover all formats that parseDateStringToISO
// handles. Kept in sync with the web-side DATE_PATTERNS (C1-01).
// Note: the short-date pattern (MM/DD) is NOT included here because it
// matches decimal amounts like "3.5" or "12.34". Short dates are validated
// separately by isDateLikeShort() with month/day range checks (F20-02).
const DATE_PATTERNS = [
  /^\d{4}[\s]*[.\-\/．。][\s]*\d{1,2}[\s]*[.\-\/．。][\s]*\d{1,2}$/,  // 2024-01-15, 2024．01．15 (C22-01)
  /^\d{4}[\s]*[.\-\/．。][\s]*\d{1,2}[\s]*[.\-\/．。][\s]*\d{1,2}\s+\d/,  // datetime: 2024-01-15 10:30:00 (C28-01)
  /^\d{2}[\s]*[.\-\/．。][\s]*\d{2}[\s]*[.\-\/．。][\s]*\d{2}$/,       // 24-01-15, 24．01．15 (C22-01)
  /^\d{4}\d{2}\d{2}$/,                                           // 20240115
  // YYMMDD (6-digit) is NOT included here because /^\d{6}$/ matches any
  // 6-digit number (transaction IDs, phone suffixes), causing false-positive
  // column detection. Validated separately by isYYMMDDLike() (C45-01).
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/,                          // 2024년 1월 15일
  /^\d{1,2}월\s*\d{1,2}일$/,                                    // 1월 15일
  // YYMMDD is validated by isYYMMDDLike() to prevent false positives on
  // 6-digit transaction IDs (C45-01). Listed here for completeness — the
  // isDateLike() function delegates to isYYMMDDLike() for this pattern.
  /^\d{6}$/,                                                      // 240115 (validated by isYYMMDDLike)
];

/** Validate short-date format (MM/DD or MM.DD) with month-aware day range
 *  checks. Uses daysInMonth() from date-utils.ts for correct validation
 *  of impossible dates like "2/31" (Feb 31), "4/31" (Apr 31), matching
 *  the PDF parser's isValidShortDate approach which uses MAX_DAYS_PER_MONTH
 *  (F21-01). Also rejects decimal amounts like "3.5" (month 3, day 5
 *  passes daysInMonth) and "12.34" (month 12, day 34 fails). */
function isDateLikeShort(value: string): boolean {
  const match = value.match(/^\d{1,2}[\s]*[.\-\/．。][\s]*\d{1,2}$/);
  if (!match) return false;
  const parts = value.trim().split(/[.\-\/．。]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(new Date().getFullYear(), month);
}

/** Validate YYMMDD format (6-digit compact date) with month/day range
 *  checks. Prevents false-positive column detection when a CSV column
 *  contains 6-digit transaction IDs (e.g., "123456", "999999") that
 *  would otherwise match /^\d{6}$/ and steal the date column assignment
 *  from the real date column (C45-01). */
function isYYMMDDLike(value: string): boolean {
  if (!/^\d{6}$/.test(value)) return false;
  const yy = parseInt(value.slice(0, 2), 10);
  const fullYear = yy >= 50 ? 1900 + yy : 2000 + yy;
  const month = parseInt(value.slice(2, 4), 10);
  const day = parseInt(value.slice(4, 6), 10);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(fullYear, month);
}

// Korean amount patterns — must recognize all formats that parseCSVAmount
// handles, including Won sign prefixes (C7-06).
// C45-02: Patterns require at least one comma (thousand separator) or Won
// sign for short digit sequences to prevent false positives on strings
// like "12-34" (card number fragments) or "1-2" being misidentified as
// amounts during column detection.
const AMOUNT_PATTERNS = [
  /^₩-?[\d,]+원?$/,     // ₩1,234 or ₩1,234원 (Won sign prefix)
  /^￦-?[\d,]+원?$/,     // ￦1,234 (fullwidth Won sign)
  /^₩?\d[\d,]*원?$/,     // ₩500 or 1,234원 — requires comma or Won sign
  /^-[\d,]+원?$/,        // -1,234 or -1,234원 (negative with comma)
  /^－[\d,]+원?$/,       // －1,234 — fullwidth-minus negative (C54-01)
  /^\([\d,]+\)$/,        // Parenthesized negatives: (1,234) → -1234
  /^마이너스[\d,]+원?$/, // 마이너스1,234 — prefix-based negative used by some banks
  /^\d{5,}원?$/,         // Bare 5+ digit integers: 50000 or 50000원 (C49-01)
];

function isDateLike(value: string): boolean {
  const trimmed = value.trim();
  // Check isYYMMDDLike first for 6-digit strings to prevent DATE_PATTERNS'
  // /^\d{6}$/ from matching without month/day validation (C45-01).
  if (isYYMMDDLike(trimmed)) return true;
  return DATE_PATTERNS.some((p) => p.test(trimmed)) || isDateLikeShort(trimmed);
}

function isAmountLike(value: string): boolean {
  return AMOUNT_PATTERNS.some((p) => p.test(value.trim()));
}

// Use shared parseDateStringToISO from date-utils.ts for date parsing.
// The local parseDateToISO was removed in favor of the centralized
// implementation to avoid divergence (C35-03).

export function parseGenericCSV(content: string, bank: BankId | null): ParseResult {
  const delimiter = detectCSVDelimiter(content);
  const lines = content.split('\n').filter((l) => l.trim());
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  if (lines.length === 0) {
    return { bank, format: 'csv', transactions: [], errors: [{ message: '빈 파일입니다.' }] };
  }

  // Find header row — scan up to 30 rows for Korean bank exports that have
  // long metadata preambles (bank name, statement period, card number).
  // A valid header row must contain at least one known header keyword AND
  // keywords from at least 2 distinct categories (date, merchant, amount)
  // to avoid matching summary rows that only have amount keywords (C1-01).
  // Uses shared isValidHeaderRow from column-matcher (C4-07).
  let headerIdx = -1;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cells = splitCSVLine(lines[i] ?? '', delimiter);
    const hasNonNumeric = cells.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric && isValidHeaderRow(cells.map((c) => c.trim()))) {
      headerIdx = i;
      break;
    }
  }

  // No valid header row found — return error instead of defaulting to row 0
  if (headerIdx === -1) {
    return { bank, format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
  }

  const headers = splitCSVLine(lines[headerIdx] ?? '', delimiter);

  // Identify column roles
  let dateCol = -1;
  let merchantCol = -1;
  let amountCol = -1;
  let installmentsCol = -1;
  let categoryCol = -1;
  let memoCol = -1;

  // First pass: look for header keywords — use shared findColumn() from
  // ColumnMatcher for consistency with the adapter-factory and XLSX parser.
  // No exactName is available for generic parsing, so pass undefined to skip
  // the exact-match pass and go straight to regex matching.
  dateCol = findColumn(headers, undefined, DATE_COLUMN_PATTERN);
  merchantCol = findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN);
  amountCol = findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN);
  installmentsCol = findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN);
  categoryCol = findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN);
  memoCol = findColumn(headers, undefined, MEMO_COLUMN_PATTERN);

  // Second pass: infer from data if headers didn't match
  if (dateCol === -1 || merchantCol === -1 || amountCol === -1) {
    // Scan 8 rows for data-inference — provides better coverage for files
    // with sparse early data (blank rows, sub-headers, metadata lines)
    // without meaningful performance impact (C54-02).
    const sampleRows = lines.slice(headerIdx + 1, headerIdx + 9);
    for (const row of sampleRows) {
      const cells = splitCSVLine(row, delimiter);
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i] ?? '';
        if (dateCol === -1 && isDateLike(cell)) dateCol = i;
        else if (amountCol === -1 && isAmountLike(cell) && !isDateLike(cell)) amountCol = i;
      }
    }
    // Merchant is likely a text-heavy column containing Korean characters.
    // Prefer the first column (not date/amount/installments/category/memo)
    // where sample data contains Korean text (C4-03). This avoids picking
    // numeric columns like installments or card number suffixes.
    if (dateCol !== -1 && amountCol !== -1 && merchantCol === -1) {
      const reservedCols = new Set([dateCol, amountCol, installmentsCol, categoryCol, memoCol].filter((c) => c !== -1));
      for (let i = 0; i < headers.length; i++) {
        if (!reservedCols.has(i)) {
          // Check if any sample data in this column contains Korean characters
          const hasKorean = sampleRows.some((row) => {
            const cells = splitCSVLine(row, delimiter);
            return /[가-힣]/.test(cells[i] ?? '');
          });
          if (hasKorean) {
            merchantCol = i;
            break;
          }
        }
      }
      // Fallback: pick the first non-reserved column even without Korean
      if (merchantCol === -1) {
        for (let i = 0; i < headers.length; i++) {
          if (!reservedCols.has(i)) {
            merchantCol = i;
            break;
          }
        }
      }
    }
  }

  // Parse data rows
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;

    // Skip summary/total rows
    if (SUMMARY_ROW_PATTERN.test(line)) continue;

    const cells = splitCSVLine(line, delimiter);

    const dateRaw = dateCol !== -1 ? (cells[dateCol] ?? '') : '';
    const merchantRaw = merchantCol !== -1 ? (cells[merchantCol] ?? '') : '';
    const amountRaw = amountCol !== -1 ? (cells[amountCol] ?? '') : '';

    if (!dateRaw && !merchantRaw && !amountRaw) continue;

    const rowText = line;
    const amount = parseCSVAmount(amountRaw);
    // Use shared isValidCSVAmount for unified validation — handles null
    // (unparseable), zero (balance inquiries), and negative (refunds)
    // amounts in one call, matching the web-side isValidAmount pattern.
    // Include raw row text for easier debugging, matching XLSX parser error format.
    if (!isValidCSVAmount(amount, amountRaw, i, errors)) {
      // isValidCSVAmount already pushes the error; enrich the last error with raw text
      if (errors.length > 0 && errors[errors.length - 1]!.line === i + 1) {
        errors[errors.length - 1]!.raw = rowText;
      }
      continue;
    }

    const parsedDate = parseDateStringToISO(dateRaw);
    // Report unparseable dates as parse errors so users can see which
    // transactions have malformed dates, matching the web-side parser
    // behavior in apps/web/src/lib/parser/csv.ts (C71-04).
    if (!isValidISODate(parsedDate) && dateRaw.trim()) {
      errors.push({ line: i + 1, message: `날짜를 해석할 수 없습니다: ${dateRaw.trim()}` });
    }

    const tx: RawTransaction = {
      date: parsedDate,
      merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
      amount,
    };

    if (installmentsCol !== -1 && cells[installmentsCol]) {
      const inst = parseCSVInstallments(cells[installmentsCol]);
      if (inst !== undefined) tx.installments = inst;
    }

    if (categoryCol !== -1 && cells[categoryCol]) {
      tx.category = cells[categoryCol];
    }

    if (memoCol !== -1 && cells[memoCol]) {
      tx.memo = cells[memoCol];
    }

    transactions.push(tx);
  }

  return { bank, format: 'csv', transactions, errors };
}
