import type { BankAdapter, BankId, ParseError, ParseResult, RawTransaction } from './types.js';
import { detectBank, detectCSVDelimiter } from './detect.js';
import {
  findColumn,
  normalizeHeader,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  SUMMARY_ROW_PATTERN,
  isValidHeaderRow,
} from './column-matcher.js';

// ---------------------------------------------------------------------------
// Shared helpers (used by all adapters)
// ---------------------------------------------------------------------------

/** RFC 4180-style CSV line splitter. Handles quoted fields and doubled-quote
 *  escapes for any delimiter (comma, tab, pipe, semicolon). Previously only
 *  comma-delimited content used proper quote handling — other delimiters
 *  fell back to naive split, which broke when fields contained the delimiter
 *  character inside quotes. Parity with server-side splitCSVLine (C13-01). */
function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

/** Shared date-parsing — delegates to the canonical implementation in
 *  date-utils.ts to avoid triplicating the logic across parsers (C19-01). */
import { parseDateStringToISO, isValidISODate, daysInMonth } from './date-utils.js';

// NOTE(C70-04): The helpers below (splitLine, parseAmount, parseInstallments,
// isValidAmount) duplicate logic from packages/parser/src/csv/shared.ts.
// Full dedup requires the D-01 architectural refactor (shared module between
// Bun and browser environments). When that refactor lands, replace these with
// imports from the shared module. The shared module has been updated to include
// whitespace stripping in parseCSVAmount and the isValidCSVAmount type guard.

function parseDateToISO(raw: string, errors?: ParseError[], lineIdx?: number): string {
  const result = parseDateStringToISO(raw);
  // Report unparseable dates as parse errors so users can see which
  // transactions have malformed dates (C71-04/C56-04).
  if (!isValidISODate(result) && raw.trim() && errors && lineIdx !== undefined) {
    errors.push({ line: lineIdx + 1, message: `날짜를 해석할 수 없습니다: ${raw.trim()}` });
  }
  return result;
}

/** Parse an amount string from CSV data. Returns null for unparseable inputs
 *  (NaN), matching the null-return pattern used by all other parsers (web PDF,
 *  web XLSX, server CSV, server XLSX, server PDF). The previous NaN return
 *  (C37-01) hid the risk of NaN propagation — the `number` return type could
 *  not enforce null checks at the call site. */
function parseAmount(raw: string): number | null {
  let cleaned = raw.trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48)) // full-width digits -> ASCII
    .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-') // full-width comma/dot/minus -> ASCII
    .replace(/（/g, '(').replace(/）/g, ')') // full-width parentheses -> ASCII
    .replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
  // Handle "마이너스" prefix — some Korean bank exports use this instead of
  // a negative sign or parentheses (parity with server-side parseCSVAmount
  // in packages/parser/src/csv/shared.ts C33-03). Must be checked after
  // stripping 원/₩ so that inputs like "마이너스1,234원" are correctly
  // detected, and parenthesized amounts like "(1,234원)" work correctly.
  const isManeuners = /^마이너스/.test(cleaned);
  if (isManeuners) cleaned = cleaned.replace(/^마이너스/, '');
  const isNegative = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1);
  // Use Math.round(parseFloat(...)) to match the xlsx parser's rounding behavior
  // (C21-03). Korean Won amounts are always integers, but formula-rendered CSV
  // cells may contain decimal remainders; rounding is more correct than truncation.
  const parsed = Math.round(parseFloat(cleaned));
  if (Number.isNaN(parsed)) return null;
  return isNegative ? -parsed : parsed;
}

/** Check if a parsed amount is valid (not null, not zero). Pushes an error
 *  and returns false if the amount is null (unparseable), so the caller can
 *  skip the transaction. Zero-amount rows are also skipped (balance inquiries,
 *  declined transactions) which don't contribute to optimization — matching
 *  the separated null-check + zero-skip pattern used by all other parsers
 *  (web PDF, web XLSX, server CSV) instead of combining NaN and zero checks
 *  in one function (C37-02).
 *
 *  Acts as a TypeScript type guard: when it returns true, the amount is
 *  narrowed from `number | null` to `number`. */
function isValidAmount(amount: number | null, amountRaw: string, lineIdx: number, errors: ParseError[]): amount is number {
  if (amount === null) {
    if (amountRaw.trim()) {
      errors.push({ line: lineIdx + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}` });
    }
    return false;
  }
  // Skip zero- and negative-amount rows (e.g., balance inquiries, declined
  // transactions, refunds). These don't contribute to spending optimization
  // and would inflate monthly spending totals (C42-01/C42-02).
  if (amount <= 0) return false;
  return true;
}

/** Parse an installment value from a CSV cell. Returns undefined for
 *  non-numeric values (e.g., "일시불" for lump-sum) which are common and
 *  expected — they mean no installment, not a parse error. Returns the
 *  installment count only when > 1. Extracted from 10 duplicated blocks
 *  across bank adapters (C24-01). */
function parseInstallments(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const inst = parseInt(raw, 10);
  if (Number.isNaN(inst)) return undefined; // "일시불" etc.
  return inst > 1 ? inst : undefined;
}

// ---------------------------------------------------------------------------
// Generic CSV parser
// ---------------------------------------------------------------------------

// NOTE: These patterns are used only for the isDateLike() column-detection
// heuristic in the generic CSV parser. They must be kept in sync with the
// date formats handled by parseDateStringToISO() in date-utils.ts. If a new
// date format is added there, add a corresponding pattern here.
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
 *  (F21-01). Also rejects decimal amounts like "12.34" (month 12, day 34
 *  fails daysInMonth) while accepting valid short dates like "1/15". */
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
 *  from the real date column (C45-01). Parity with server-side
 *  packages/parser/src/csv/generic.ts. */
function isYYMMDDLike(value: string): boolean {
  if (!/^\d{6}$/.test(value)) return false;
  const yy = parseInt(value.slice(0, 2), 10);
  const fullYear = yy >= 50 ? 1900 + yy : 2000 + yy;
  const month = parseInt(value.slice(2, 4), 10);
  const day = parseInt(value.slice(4, 6), 10);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(fullYear, month);
}

// Korean amount patterns — must recognize all formats that parseAmount
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

// Keyword category Sets removed — now imported from column-matcher.ts (C4-07).

function parseGenericCSV(content: string, bank: BankId | null): ParseResult {
  // BOM stripping is the responsibility of parseCSV() (the public entry
  // point). It is NOT repeated here to avoid redundant work — parseCSV()
  // always strips BOM before delegating to bank adapters or this function
  // (C73-04).
  const delimiter = detectCSVDelimiter(content);
  const lines = content.split('\n').filter((l) => l.trim());
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  if (lines.length === 0) {
    return { bank, format: 'csv', transactions: [], errors: [{ message: '빈 파일입니다.' }] };
  }

  // Find header row — uses shared isValidHeaderRow from column-matcher
  // (C4-01/C4-07) which requires keywords from at least 2 distinct categories.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cells = splitLine(lines[i] ?? '', delimiter);
    const hasNonNumeric = cells.some((c) => /[\uac00-\ud7afa-zA-Z]/.test(c));
    if (hasNonNumeric && isValidHeaderRow(cells.map((c) => c.trim()))) {
      headerIdx = i;
      break;
    }
  }

  // No row with known header keywords found — return an error instead of
  // falling back to row 0 (which is likely a metadata row). This matches
  // the behavior of bank-specific adapters (C78-03).
  if (headerIdx === -1) {
    return { bank, format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
  }

  const headers = splitLine(lines[headerIdx] ?? '', delimiter);

  let dateCol = -1;
  let merchantCol = -1;
  let amountCol = -1;
  let installmentsCol = -1;
  let categoryCol = -1;
  let memoCol = -1;

  // Use shared findColumn() from ColumnMatcher for consistent column detection
  // across all parsers. No exactName is available for generic parsing, so pass
  // undefined to skip the exact-match pass and go straight to regex matching.
  dateCol = findColumn(headers, undefined, DATE_COLUMN_PATTERN);
  merchantCol = findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN);
  amountCol = findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN);
  installmentsCol = findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN);
  categoryCol = findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN);
  memoCol = findColumn(headers, undefined, MEMO_COLUMN_PATTERN);

  if (dateCol === -1 || merchantCol === -1 || amountCol === -1) {
    const sampleRows = lines.slice(headerIdx + 1, headerIdx + 5);
    for (const row of sampleRows) {
      const cells = splitLine(row, delimiter);
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i] ?? '';
        if (dateCol === -1 && isDateLike(cell)) dateCol = i;
        else if (amountCol === -1 && isAmountLike(cell) && !isDateLike(cell)) amountCol = i;
      }
    }
    if (dateCol !== -1 && amountCol !== -1 && merchantCol === -1) {
      // Prefer a text-heavy column containing Korean characters — avoids
      // picking numeric columns like installments or card number suffixes.
      // Aligns with the server-side logic in packages/parser/src/csv/generic.ts
      // (C5-04).
      const reservedCols = new Set([dateCol, amountCol, installmentsCol, categoryCol, memoCol].filter((c) => c !== -1));
      for (let i = 0; i < headers.length; i++) {
        if (!reservedCols.has(i)) {
          const hasKorean = sampleRows.some((row) => {
            const cells = splitLine(row, delimiter);
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

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;

    // Skip summary/total rows
    if (SUMMARY_ROW_PATTERN.test(line)) continue;

    const cells = splitLine(line, delimiter);

    const dateRaw = dateCol !== -1 ? (cells[dateCol] ?? '') : '';
    const merchantRaw = merchantCol !== -1 ? (cells[merchantCol] ?? '') : '';
    const amountRaw = amountCol !== -1 ? (cells[amountCol] ?? '') : '';

    if (!dateRaw && !merchantRaw && !amountRaw) continue;

    const amount = parseAmount(amountRaw);
    // Use the shared isValidAmount() helper which handles both NaN and
    // zero-amount filtering (C26-02), matching the bank-specific adapters.
    if (!isValidAmount(amount, amountRaw, i, errors)) continue;

    const tx: RawTransaction = {
      date: parseDateToISO(dateRaw, errors, i),
      merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
      amount,
    };

    if (installmentsCol !== -1 && cells[installmentsCol]) {
      const inst = parseInstallments(cells[installmentsCol]);
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

// ---------------------------------------------------------------------------
// Bank adapters
// ---------------------------------------------------------------------------

const samsungAdapter: BankAdapter = {
  bankId: 'samsung',

  detect(content: string): boolean {
    return /삼성카드/.test(content) || /SAMSUNG\s*CARD/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    // Scan up to 30 rows for header — matching the generic parser's limit
    // (C81-02). Some bank exports have 10+ metadata rows before the header.
    // Use flexible matching: normalize cells and check for ANY known keyword
    // rather than requiring exact matches, matching server-side factory
    // behavior with normalizedKeywords.some() (F18-03).
    const SAMSUNG_KEYWORDS = ['이용일', '가맹점명', '이용금액', '할부', '업종'].map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => SAMSUNG_KEYWORDS.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'samsung', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '이용일', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '가맹점명', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부', INSTALLMENTS_COLUMN_PATTERN);
    const categoryIdx = findColumn(headers, '업종', CATEGORY_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'samsung', format: 'csv', transactions, errors };
  },
};

const shinhanAdapter: BankAdapter = {
  bankId: 'shinhan',

  detect(content: string): boolean {
    return /신한카드/.test(content) || /SHINHAN/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    const SHINHAN_KEYWORDS = ['이용일', '이용처', '이용금액', '할부개월수', '업종분류'].map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => SHINHAN_KEYWORDS.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'shinhan', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '이용일', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '이용처', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부개월수', INSTALLMENTS_COLUMN_PATTERN);
    const categoryIdx = findColumn(headers, '업종분류', CATEGORY_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'shinhan', format: 'csv', transactions, errors };
  },
};

const kbAdapter: BankAdapter = {
  bankId: 'kb',

  detect(content: string): boolean {
    return /KB국민카드/.test(content) || /국민카드/.test(content) || /kbcard/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];
    const KB_HEADERS = ['거래일시', '가맹점명', '이용금액', '할부개월', '업종'];

    let headerIdx = -1;
    const KB_HEADERS_NORM = KB_HEADERS.map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => KB_HEADERS_NORM.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'kb', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '거래일시', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '가맹점명', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부개월', INSTALLMENTS_COLUMN_PATTERN);
    const categoryIdx = findColumn(headers, '업종', CATEGORY_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'kb', format: 'csv', transactions, errors };
  },
};

const hyundaiAdapter: BankAdapter = {
  bankId: 'hyundai',

  detect(content: string): boolean {
    return /현대카드/.test(content) || /HYUNDAICARD/.test(content) || /hdcard/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];
    const HYUNDAI_HEADERS = ['이용일', '이용처', '이용금액', '할부', '비고'];

    let headerIdx = -1;
    const HYUNDAI_HEADERS_NORM = HYUNDAI_HEADERS.map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => HYUNDAI_HEADERS_NORM.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'hyundai', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '이용일', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '이용처', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부', INSTALLMENTS_COLUMN_PATTERN);
    const memoIdx = findColumn(headers, '비고', MEMO_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'hyundai', format: 'csv', transactions, errors };
  },
};

const lotteAdapter: BankAdapter = {
  bankId: 'lotte',

  detect(content: string): boolean {
    return /롯데카드/.test(content) || /LOTTE\s*CARD/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    const LOTTE_KEYWORDS = ['거래일', '이용가맹점', '이용금액', '할부', '업종'].map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => LOTTE_KEYWORDS.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'lotte', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '거래일', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '이용가맹점', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부', INSTALLMENTS_COLUMN_PATTERN);
    const categoryIdx = findColumn(headers, '업종', CATEGORY_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'lotte', format: 'csv', transactions, errors };
  },
};

const hanaAdapter: BankAdapter = {
  bankId: 'hana',

  detect(content: string): boolean {
    return /하나카드/.test(content) || /HANA\s*CARD/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    const HANA_KEYWORDS = ['이용일자', '가맹점명', '이용금액', '할부개월', '적요'].map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => HANA_KEYWORDS.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'hana', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '이용일자', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '가맹점명', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부개월', INSTALLMENTS_COLUMN_PATTERN);
    const memoIdx = findColumn(headers, '적요', MEMO_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'hana', format: 'csv', transactions, errors };
  },
};

const wooriAdapter: BankAdapter = {
  bankId: 'woori',

  detect(content: string): boolean {
    return /우리카드/.test(content) || /wooricard/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];
    const WOORI_HEADERS = ['이용일자', '이용가맹점', '이용금액', '할부기간', '비고'];

    let headerIdx = -1;
    const WOORI_HEADERS_NORM = WOORI_HEADERS.map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => WOORI_HEADERS_NORM.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'woori', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '이용일자', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '이용가맹점', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부기간', INSTALLMENTS_COLUMN_PATTERN);
    const memoIdx = findColumn(headers, '비고', MEMO_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'woori', format: 'csv', transactions, errors };
  },
};

const nhAdapter: BankAdapter = {
  bankId: 'nh',

  detect(content: string): boolean {
    return /NH농협/.test(content) || /농협카드/.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    const NH_KEYWORDS = ['거래일', '이용처', '거래금액', '할부', '비고'].map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => NH_KEYWORDS.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'nh', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '거래일', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '이용처', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '거래금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부', INSTALLMENTS_COLUMN_PATTERN);
    const memoIdx = findColumn(headers, '비고', MEMO_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'nh', format: 'csv', transactions, errors };
  },
};

const ibkAdapter: BankAdapter = {
  bankId: 'ibk',

  detect(content: string): boolean {
    return /IBK기업은행/.test(content) || /기업은행/.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];
    const IBK_HEADERS = ['거래일', '가맹점', '거래금액', '할부', '적요'];

    let headerIdx = -1;
    const IBK_HEADERS_NORM = IBK_HEADERS.map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => IBK_HEADERS_NORM.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'ibk', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '거래일', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '가맹점', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '거래금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부', INSTALLMENTS_COLUMN_PATTERN);
    const memoIdx = findColumn(headers, '적요', MEMO_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'ibk', format: 'csv', transactions, errors };
  },
};

const bcAdapter: BankAdapter = {
  bankId: 'bc',

  detect(content: string): boolean {
    return /BC카드/.test(content) || /비씨카드/.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    const BC_KEYWORDS = ['이용일', '가맹점', '이용금액', '할부', '업종'].map(h => normalizeHeader(h));
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const normalizedCells = cells.map(c => normalizeHeader(c));
      if (normalizedCells.some((c) => BC_KEYWORDS.includes(c)) && isValidHeaderRow(cells.map(c => c.trim()))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'bc', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = findColumn(headers, '이용일', DATE_COLUMN_PATTERN);
    const merchantIdx = findColumn(headers, '가맹점', MERCHANT_COLUMN_PATTERN);
    const amountIdx = findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN);
    const installIdx = findColumn(headers, '할부', INSTALLMENTS_COLUMN_PATTERN);
    const categoryIdx = findColumn(headers, '업종', CATEGORY_COLUMN_PATTERN);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      // Skip summary/total rows (parity with server-side adapter-factory C23-01)
      if (SUMMARY_ROW_PATTERN.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw, errors, i),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'bc', format: 'csv', transactions, errors };
  },
};

// ---------------------------------------------------------------------------
// Additional bank adapters (14 banks matching server-side adapter-factory)
// Uses a factory helper to avoid 14 near-identical adapter objects (C40-01).
// ---------------------------------------------------------------------------

interface BankCSVConfig {
  bankId: BankId;
  headerKeywords: string[];
  dateHeader?: string;
  merchantHeader?: string;
  amountHeader?: string;
  installmentsHeader?: string;
  categoryHeader?: string;
  memoHeader?: string;
}

function createBankAdapter(config: BankCSVConfig): BankAdapter {
  const {
    bankId,
    headerKeywords,
    dateHeader,
    merchantHeader,
    amountHeader,
    installmentsHeader,
    categoryHeader,
    memoHeader,
  } = config;

  const normalizedKeywords = headerKeywords.map((k) => normalizeHeader(k));

  return {
    bankId,

    detect(content: string): boolean {
      const { bank } = detectBank(content);
      return bank === bankId;
    },

    parseCSV(content: string): ParseResult {
      const delimiter = detectCSVDelimiter(content);
      const lines = content.split('\n').filter((l) => l.trim());
      const errors: ParseError[] = [];
      const transactions: RawTransaction[] = [];

      let headerIdx = -1;
      for (let i = 0; i < Math.min(30, lines.length); i++) {
        const cells = splitLine(lines[i] ?? '', delimiter);
        const normalizedCells = cells.map((c) => normalizeHeader(c));
        if (normalizedCells.some((c) => normalizedKeywords.includes(c)) && isValidHeaderRow(cells.map((c) => c.trim()))) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) {
        return { bank: bankId, format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
      }

      const headers = splitLine(lines[headerIdx] ?? '', delimiter);
      const dateCol = findColumn(headers, dateHeader, DATE_COLUMN_PATTERN);
      const merchantCol = findColumn(headers, merchantHeader, MERCHANT_COLUMN_PATTERN);
      const amountCol = findColumn(headers, amountHeader, AMOUNT_COLUMN_PATTERN);
      const installCol = findColumn(headers, installmentsHeader, INSTALLMENTS_COLUMN_PATTERN);
      const categoryCol = findColumn(headers, categoryHeader, CATEGORY_COLUMN_PATTERN);
      const memoCol = findColumn(headers, memoHeader, MEMO_COLUMN_PATTERN);

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (!line.trim()) continue;
        if (SUMMARY_ROW_PATTERN.test(line)) continue;
        const cells = splitLine(line, delimiter);

        const dateRaw = dateCol !== -1 ? (cells[dateCol] ?? '') : '';
        const merchantRaw = merchantCol !== -1 ? (cells[merchantCol] ?? '') : '';
        const amountRaw = amountCol !== -1 ? (cells[amountCol] ?? '') : '';

        if (!dateRaw && !merchantRaw) continue;

        const amount = parseAmount(amountRaw);
        if (!isValidAmount(amount, amountRaw, i, errors)) continue;

        const tx: RawTransaction = {
          date: parseDateToISO(dateRaw, errors, i),
          merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
          amount,
        };

        if (installCol !== -1 && cells[installCol]) {
          const inst = parseInstallments(cells[installCol]);
          if (inst !== undefined) tx.installments = inst;
        }
        if (categoryCol !== -1 && cells[categoryCol]) tx.category = cells[categoryCol];
        if (memoCol !== -1 && cells[memoCol]) tx.memo = cells[memoCol];

        transactions.push(tx);
      }

      return { bank: bankId, format: 'csv', transactions, errors };
    },
  };
}

const kakaoAdapter = createBankAdapter({
  bankId: 'kakao',
  headerKeywords: ['거래일시', '이용처', '이용금액'],
  dateHeader: '거래일시',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
});

const tossAdapter = createBankAdapter({
  bankId: 'toss',
  headerKeywords: ['거래일', '이용처', '이용금액'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
});

const kbankAdapter = createBankAdapter({
  bankId: 'kbank',
  headerKeywords: ['거래일', '이용처', '거래금액'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '거래금액',
});

const bnkAdapter = createBankAdapter({
  bankId: 'bnk',
  headerKeywords: ['거래일', '가맹점', '이용금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
});

const dgbAdapter = createBankAdapter({
  bankId: 'dgb',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

const suhyupAdapter = createBankAdapter({
  bankId: 'suhyup',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

const jbAdapter = createBankAdapter({
  bankId: 'jb',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

const kwangjuAdapter = createBankAdapter({
  bankId: 'kwangju',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

const jejuAdapter = createBankAdapter({
  bankId: 'jeju',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

const scAdapter = createBankAdapter({
  bankId: 'sc',
  headerKeywords: ['거래일', '이용처', '이용금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
});

const mgAdapter = createBankAdapter({
  bankId: 'mg',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

const cuAdapter = createBankAdapter({
  bankId: 'cu',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

const kdbAdapter = createBankAdapter({
  bankId: 'kdb',
  headerKeywords: ['거래일', '이용처', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

const epostAdapter = createBankAdapter({
  bankId: 'epost',
  headerKeywords: ['거래일', '이용처', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

// ---------------------------------------------------------------------------
// Adapter registry & main parseCSV export
// ---------------------------------------------------------------------------

const ADAPTERS: BankAdapter[] = [
  hyundaiAdapter,
  kbAdapter,
  ibkAdapter,
  wooriAdapter,
  samsungAdapter,
  shinhanAdapter,
  lotteAdapter,
  hanaAdapter,
  nhAdapter,
  bcAdapter,
  kakaoAdapter,
  tossAdapter,
  kbankAdapter,
  bnkAdapter,
  dgbAdapter,
  suhyupAdapter,
  jbAdapter,
  kwangjuAdapter,
  jejuAdapter,
  scAdapter,
  mgAdapter,
  cuAdapter,
  kdbAdapter,
  epostAdapter,
];

export function parseCSV(content: string, bank?: BankId): ParseResult {
  // Strip UTF-8 BOM if present — Windows-generated CSV exports commonly
  // include a BOM character (0xEF 0xBB 0xBF / U+FEFF) that would cause
  // header detection to fail because indexOf('이용일') won't match
  // '\uFEFF이용일'. The XLSX parser handles BOM in isHTMLContent(); the
  // CSV parser needs the same treatment at the entry point (C52-01).
  const cleanContent = content.replace(/^\uFEFF/, '');

  let resolvedBank: BankId | null = bank ?? null;

  if (!resolvedBank) {
    const { bank: detected } = detectBank(cleanContent);
    resolvedBank = detected;
  }

  // Try bank-specific adapter first
  if (resolvedBank) {
    const adapter = ADAPTERS.find((a) => a.bankId === resolvedBank);
    if (adapter?.parseCSV) {
      try {
        return adapter.parseCSV(cleanContent);
      } catch (err) {
        // Fall through to generic parser, but record the failure in the result
        // (matching the server-side pattern in packages/parser/src/csv/index.ts)
        const fallbackResult = parseGenericCSV(cleanContent, resolvedBank);
        fallbackResult.errors.unshift({
          message: `${adapter.bankId} 어댑터 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
        });
        return fallbackResult;
      }
    }
  }

  // Detect by content signature
  const signatureFailures: string[] = [];
  for (const adapter of ADAPTERS) {
    if (adapter.detect(cleanContent) && adapter.parseCSV) {
      try {
        return adapter.parseCSV(cleanContent);
      } catch (err) {
        const msg = `${adapter.bankId} 어댑터(자동 감지) 파싱 실패: ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`[cherrypicker] Bank adapter ${adapter.bankId} (detect) failed:`, err);
        signatureFailures.push(msg);
      }
    }
  }

  // Fall back to generic parser — wrap in try/catch for defensive consistency
  // with the bank-specific adapter path above (C30-02).
  try {
    const result = parseGenericCSV(cleanContent, resolvedBank);
    // Collect any signature-detection adapter failures into the result
    for (const msg of signatureFailures) {
      result.errors.unshift({ message: msg });
    }
    return result;
  } catch (err) {
    return {
      bank: resolvedBank,
      format: 'csv',
      transactions: [],
      errors: [
        ...signatureFailures.map(msg => ({ message: msg })),
        { message: `제네릭 파서 실패: ${err instanceof Error ? err.message : String(err)}` },
      ],
    };
  }
}
