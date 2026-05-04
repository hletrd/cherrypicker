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

/** Split CSV content into logical lines, handling multi-line quoted fields.
 *  RFC 4180 allows fields enclosed in double quotes to contain newline
 *  characters. Korean bank CSVs exported from Excel may include such fields
 *  (e.g., merchant names or memo fields with embedded line breaks). This
 *  function normalizes CRLF to LF, then reassembles lines that fall within
 *  quoted fields before splitting into logical lines.
 *
 *  Empty/whitespace-only logical lines are filtered out to match the
 *  behavior of the previous `content.split('\n').filter(l => l.trim())`
 *  pattern used throughout the CSV parsers. Parity with server-side
 *  splitCSVContent in packages/parser/src/csv/shared.ts (C67-01). */
function splitCSVContent(content: string, delimiter: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');

  const logicalLines: string[] = [];
  let pending = '';
  let inQuotes = false;

  for (const rawLine of rawLines) {
    if (inQuotes) {
      pending += '\n' + rawLine;
      let quoteCount = 0;
      for (let i = 0; i < rawLine.length; i++) {
        if (rawLine[i] === '"') {
          if (i + 1 < rawLine.length && rawLine[i + 1] === '"') { i++; }
          else { quoteCount++; }
        }
      }
      if (quoteCount % 2 === 1) {
        inQuotes = false;
        if (pending.trim()) logicalLines.push(pending);
        pending = '';
      }
    } else {
      let quoteCount = 0;
      for (let i = 0; i < rawLine.length; i++) {
        if (rawLine[i] === '"') {
          if (i + 1 < rawLine.length && rawLine[i + 1] === '"') { i++; }
          else { quoteCount++; }
        }
      }
      if (quoteCount % 2 === 1) {
        inQuotes = true;
        pending = rawLine;
      } else {
        if (rawLine.trim()) logicalLines.push(rawLine);
      }
    }
  }
  if (pending.trim()) logicalLines.push(pending);

  return logicalLines;
}

/** Shared date-parsing — delegates to the canonical implementation in
 *  date-utils.ts to avoid triplicating the logic across parsers (C19-01). */
import { parseDateStringToISO, isValidISODate, isValidYYMMDD, daysInMonth } from './date-utils.js';

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
  if (!raw.trim()) return null; // Early return for empty/whitespace-only input (parity with server-side C56-04)
  let cleaned = raw.trim()
    .replace(/^\+/, '') // Strip leading + sign used by some banks for positive amounts (C66-02)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48)) // full-width digits -> ASCII
    .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-') // full-width comma/dot/minus -> ASCII
    .replace(/（/g, '(').replace(/）/g, ')') // full-width parentheses -> ASCII
    .replace(/^KRW\s*/i, '') // ISO 4217 KRW currency prefix (C56-01)
    .replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
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
  // Strip trailing delimiters before matching — Korean bank exports may
  // append a period or slash to dates (e.g., "1/15/" or "1.15.") (C57-01).
  const stripped = value.replace(/[.\-\/．。]\s*$/, '');
  const match = stripped.match(/^\d{1,2}[\s]*[.\-\/．。][\s]*\d{1,2}$/);
  if (!match) return false;
  const parts = stripped.trim().split(/[.\-\/．。]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(new Date().getFullYear(), month);
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
  /^\d[\d,]*,\d[\d,]*원?$/, // 1,234 or 1,234,567 — requires comma separator (C60-01)
  /^-[\d,]+원?$/,        // -1,234 or -1,234원 (negative with comma)
  /^－[\d,]+원?$/,       // －1,234 — fullwidth-minus negative (C54-01)
  /^\([\d,]+\)$/,        // Parenthesized negatives: (1,234) → -1234
  /^마이너스[\d,]+원?$/, // 마이너스1,234 — prefix-based negative used by some banks
  /^\d{5,}원?$/,         // Bare 5+ digit integers: 10000 or 10000원 (C65-01, lowered from 8 to match PDF parser)
  /^KRW[\d,]+원?$/i,     // KRW10,000 — ISO 4217 currency prefix (C56-01)
  /^\d[\d,]*-$/,          // Trailing minus: 1,234- (negative amount, C68-01)
];

function isDateLike(value: string): boolean {
  const trimmed = value.trim();
  // Check isYYMMDDLike first for 6-digit strings to prevent DATE_PATTERNS'
  // /^\d{6}$/ from matching without month/day validation (C45-01).
  if (isValidYYMMDD(trimmed)) return true;
  // Strip trailing delimiters before matching — Korean bank exports may
  // append a period or slash to dates (e.g., "2024. 1. 15.") (C57-01).
  const stripped = trimmed.replace(/[.\-\/．。]\s*$/, '');
  return DATE_PATTERNS.some((p) => p.test(stripped)) || isDateLikeShort(trimmed);
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
  const lines = splitCSVContent(content, delimiter);
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
    // Scan 8 rows for data-inference — provides better coverage for files
    // with sparse early data (blank rows, sub-headers, metadata lines)
    // without meaningful performance impact (C54-02).
    const sampleRows = lines.slice(headerIdx + 1, headerIdx + 9);
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

  // Report when required columns were not found — prevents silent empty results
  // when both header matching and data-inference fail (C65-02).
  if (dateCol === -1 || amountCol === -1) {
    const missing: string[] = [];
    if (dateCol === -1) missing.push('날짜');
    if (amountCol === -1) missing.push('금액');
    errors.push({ message: `필수 컬럼을 찾을 수 없습니다: ${missing.join(', ')}` });
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
    // Enrich amount errors with raw row text for easier debugging, matching
    // the server-side isValidCSVAmount pattern in packages/parser/src/csv/shared.ts (C59-04).
    if (!isValidAmount(amount, amountRaw, i, errors)) {
      if (errors.length > 0 && errors[errors.length - 1]!.line === i + 1) {
        errors[errors.length - 1]!.raw = line;
      }
      continue;
    }

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
// Bank adapters — all 24 banks use the createBankAdapter() factory
// to eliminate duplicated parse logic (C61-02).
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
      const lines = splitCSVContent(content, delimiter);
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

        if (!dateRaw && !merchantRaw && !amountRaw) continue;

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

// Original 10 banks — previously hand-written, now using factory (C61-02).
const samsungAdapter = createBankAdapter({
  bankId: 'samsung',
  headerKeywords: ['이용일', '가맹점명', '이용금액', '할부', '업종'],
  dateHeader: '이용일',
  merchantHeader: '가맹점명',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
  categoryHeader: '업종',
});

const shinhanAdapter = createBankAdapter({
  bankId: 'shinhan',
  headerKeywords: ['이용일', '이용처', '이용금액', '할부개월수', '업종분류'],
  dateHeader: '이용일',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
  installmentsHeader: '할부개월수',
  categoryHeader: '업종분류',
});

const kbAdapter = createBankAdapter({
  bankId: 'kb',
  headerKeywords: ['거래일시', '가맹점명', '이용금액', '할부개월', '업종'],
  dateHeader: '거래일시',
  merchantHeader: '가맹점명',
  amountHeader: '이용금액',
  installmentsHeader: '할부개월',
  categoryHeader: '업종',
});

const hyundaiAdapter = createBankAdapter({
  bankId: 'hyundai',
  headerKeywords: ['이용일', '이용처', '이용금액', '할부', '비고'],
  dateHeader: '이용일',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
  memoHeader: '비고',
});

const lotteAdapter = createBankAdapter({
  bankId: 'lotte',
  headerKeywords: ['거래일', '이용가맹점', '이용금액', '할부', '업종'],
  dateHeader: '거래일',
  merchantHeader: '이용가맹점',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
  categoryHeader: '업종',
});

const hanaAdapter = createBankAdapter({
  bankId: 'hana',
  headerKeywords: ['이용일자', '가맹점명', '이용금액', '할부개월', '적요'],
  dateHeader: '이용일자',
  merchantHeader: '가맹점명',
  amountHeader: '이용금액',
  installmentsHeader: '할부개월',
  memoHeader: '적요',
});

const wooriAdapter = createBankAdapter({
  bankId: 'woori',
  headerKeywords: ['이용일자', '이용가맹점', '이용금액', '할부기간', '비고'],
  dateHeader: '이용일자',
  merchantHeader: '이용가맹점',
  amountHeader: '이용금액',
  installmentsHeader: '할부기간',
  memoHeader: '비고',
});

const nhAdapter = createBankAdapter({
  bankId: 'nh',
  headerKeywords: ['거래일', '이용처', '거래금액', '할부', '비고'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
  memoHeader: '비고',
});

const ibkAdapter = createBankAdapter({
  bankId: 'ibk',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부', '적요'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
  memoHeader: '적요',
});

const bcAdapter = createBankAdapter({
  bankId: 'bc',
  headerKeywords: ['이용일', '가맹점', '이용금액', '할부', '업종'],
  dateHeader: '이용일',
  merchantHeader: '가맹점',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
  categoryHeader: '업종',
});

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
