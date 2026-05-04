import * as XLSX from 'xlsx';
import type { BankId, ParseError, ParseResult, RawTransaction } from './types.js';
import { detectBank } from './detect.js';
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
  isValidHeaderRow,
} from './column-matcher.js';

// ---------------------------------------------------------------------------
// Column config per bank (ported from packages/parser/src/xlsx/adapters)
// ---------------------------------------------------------------------------

interface ColumnConfig {
  date: string;
  merchant: string;
  amount: string;
  installments?: string;
  category?: string;
  memo?: string;
}

export const BANK_COLUMN_CONFIGS: Record<BankId, ColumnConfig> = {
  hyundai: {
    date: '이용일',
    merchant: '이용처',
    amount: '이용금액',
    installments: '할부',
    memo: '비고',
  },
  kb: {
    date: '거래일시',
    merchant: '가맹점명',
    amount: '이용금액',
    installments: '할부개월',
    category: '업종',
  },
  ibk: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
    memo: '적요',
  },
  woori: {
    date: '이용일자',
    merchant: '이용가맹점',
    amount: '이용금액',
    installments: '할부기간',
    memo: '비고',
  },
  samsung: {
    date: '이용일',
    merchant: '가맹점명',
    amount: '이용금액',
    installments: '할부',
    category: '업종',
  },
  shinhan: {
    date: '이용일',
    merchant: '이용처',
    amount: '이용금액',
    installments: '할부개월수',
    category: '업종분류',
  },
  lotte: {
    date: '거래일',
    merchant: '이용가맹점',
    amount: '이용금액',
    installments: '할부',
    category: '업종',
  },
  hana: {
    date: '이용일자',
    merchant: '가맹점명',
    amount: '이용금액',
    installments: '할부개월',
    memo: '적요',
  },
  nh: {
    date: '거래일',
    merchant: '이용처',
    amount: '거래금액',
    installments: '할부',
    memo: '비고',
  },
  bc: {
    date: '이용일',
    merchant: '가맹점',
    amount: '이용금액',
    installments: '할부',
    category: '업종',
  },
  kakao: {
    date: '거래일시',
    merchant: '이용처',
    amount: '이용금액',
  },
  toss: {
    date: '거래일',
    merchant: '이용처',
    amount: '이용금액',
  },
  kbank: {
    date: '거래일',
    merchant: '이용처',
    amount: '거래금액',
  },
  bnk: {
    date: '거래일',
    merchant: '가맹점',
    amount: '이용금액',
    installments: '할부',
  },
  dgb: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  suhyup: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  jb: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  kwangju: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  jeju: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  sc: {
    date: '거래일',
    merchant: '이용처',
    amount: '이용금액',
    installments: '할부',
  },
  mg: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  cu: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  kdb: {
    date: '거래일',
    merchant: '이용처',
    amount: '거래금액',
    installments: '할부',
  },
  epost: {
    date: '거래일',
    merchant: '이용처',
    amount: '거래금액',
    installments: '할부',
  },
};

function getBankColumnConfig(bankId: BankId): ColumnConfig {
  return BANK_COLUMN_CONFIGS[bankId];
}

// Keyword categories for header detection — hoisted to module scope to avoid
// recreating Sets on every parse call. Matches server-side XLSX parser.
// Keyword category Sets removed — now imported from column-matcher.ts (C4-07).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shared date-parsing — delegates string values to the canonical
 *  implementation in date-utils.ts to avoid triplicating the logic
 *  across parsers (C19-01). The xlsx parser additionally handles
 *  Excel serial date numbers before falling through to the shared
 *  string parser. */
import { parseDateStringToISO, isValidDayForMonth, isValidISODate } from './date-utils.js';

// Excel formula error strings — when `raw: true` is used in sheet_to_json,
// formula cells that produce errors are returned as these strings. Detecting
// them early produces a clearer error message. Parity with server-side
// XLSX parser in packages/parser/src/xlsx/index.ts (C14-01).
const EXCEL_ERROR_PATTERN = /^#(VALUE!|REF!|DIV\/0!|NAME\?|NULL!|NUM!|CALC!|N\/A)$/i;

function parseDateToISO(raw: unknown, errors?: ParseError[], lineIdx?: number): string {
  // Detect Excel formula error strings early — produce a specific error
  // message rather than trying to parse them as dates (C14-01).
  if (typeof raw === 'string' && EXCEL_ERROR_PATTERN.test(raw.trim())) {
    if (errors && lineIdx !== undefined) {
      errors.push({ line: lineIdx + 1, message: `셀 수식 오류: ${raw.trim()}` });
    }
    return raw.trim();
  }
  // Handle Date objects — SheetJS may return these when cellDates is enabled
  // or in certain edge cases. Matches server-side XLSX parser behavior (C10-01).
  if (raw instanceof Date) {
    if (!Number.isNaN(raw.getTime())) {
      const y = raw.getFullYear().toString().padStart(4, '0');
      const m = (raw.getMonth() + 1).toString().padStart(2, '0');
      const d = raw.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (errors && lineIdx !== undefined) {
      errors.push({ line: lineIdx + 1, message: `날짜를 해석할 수 없습니다: ${String(raw)}` });
    }
    return String(raw);
  }
  if (typeof raw === 'number') {
    // Guard against NaN, Infinity, and numbers that are clearly NOT dates.
    // Report error for out-of-range values (except 0 which is a common empty
    // cell default), matching server-side XLSX parser behavior (C11-02).
    if (!Number.isFinite(raw) || raw < 1 || raw > 100000) {
      if (errors && lineIdx !== undefined && raw !== 0) {
        errors.push({ line: lineIdx + 1, message: `날짜를 해석할 수 없습니다: ${raw}` });
      }
      return String(raw);
    }
    // Excel serial date number
    const date = XLSX.SSF.parse_date_code(raw);
    if (date) {
      // Validate month/day ranges using month-aware day validation (C67-04).
      // This ensures serial dates like "Feb 31" are rejected, matching the
      // string-parsing path which uses isValidDayForMonth() in date-utils.ts.
      if (date.m >= 1 && date.m <= 12 && isValidDayForMonth(date.y, date.m, date.d)) {
        const y = date.y.toString().padStart(4, '0');
        const m = date.m.toString().padStart(2, '0');
        const d = date.d.toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      // Invalid date from serial number — return as-is so the caller can detect
      // the malformed value, matching the string-path fallback behavior.
      if (errors && lineIdx !== undefined) {
        errors.push({ line: lineIdx + 1, message: `날짜를 해석할 수 없습니다: ${raw}` });
      }
      return String(raw);
    }
  }
  if (typeof raw === 'string') {
    const result = parseDateStringToISO(raw);
    // Report unparseable dates as parse errors so users can see which
    // transactions have malformed dates (C71-04/C56-04).
    if (!isValidISODate(result) && raw.trim() && errors && lineIdx !== undefined) {
      errors.push({ line: lineIdx + 1, message: `날짜를 해석할 수 없습니다: ${raw.trim()}` });
    }
    return result;
  }
  return String(raw ?? '');
}

function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    // Korean Won amounts must be integers — round to prevent decimal
    // values (e.g., from formula cells) from polluting reward math.
    return Number.isFinite(raw) ? Math.round(raw) : null;
  }
  if (typeof raw === 'string') {
    let cleaned = raw.trim()
      .replace(/^\+/, '') // Strip leading + sign used by some banks for positive amounts (C66-02)
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48)) // full-width digits -> ASCII
      .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-') // full-width comma/dot/minus -> ASCII
      .replace(/（/g, '(').replace(/）/g, ')') // full-width parentheses -> ASCII
      .replace(/^KRW\s*/i, '') // ISO 4217 KRW currency prefix (C56-01)
      .replace(/\s*원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
    // Handle "마이너스" prefix — some Korean bank exports use this instead of
    // a negative sign or parentheses (parity with server-side parseCSVAmount
    // in packages/parser/src/csv/shared.ts C33-03).
    const isManeuners = /^마이너스/.test(cleaned);
    if (isManeuners) cleaned = cleaned.replace(/^마이너스/, '');
    // Handle trailing minus sign — some Korean bank exports use "1,234-"
    // instead of "-1,234" for negative amounts (C68-01).
    const hasTrailingMinus = /\d-$/.test(cleaned);
    if (hasTrailingMinus) cleaned = cleaned.replace(/-$/, '');
    const isNegative = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners || hasTrailingMinus;
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1);
    if (!cleaned) return null;
    // Use Math.round(parseFloat(...)) to match the numeric path's rounding
    // behavior (C20-01). Korean Won amounts are always integers, but
    // formula cells may render as strings with decimal remainders.
    const parsed = Math.round(parseFloat(cleaned));
    if (Number.isNaN(parsed)) return null;
    return isNegative ? -parsed : parsed;
  }
  return null;
}

function parseInstallments(raw: unknown): number | undefined {
  if (typeof raw === 'number') return raw > 1 ? raw : undefined;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return !Number.isNaN(n) && n > 1 ? n : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// HTML-as-XLS detection & normalization
// Korean card companies often export HTML tables with .xls extension.
// ---------------------------------------------------------------------------

/** Check if the buffer contains HTML content (HTML-as-XLS).
 *  Decodes the first 512 bytes as UTF-8 and checks for HTML signatures.
 *  Korean card companies often export HTML tables with .xls extension.
 *
 *  Known limitation: the full buffer is decoded again in the caller when
 *  HTML is detected. TextDecoder doesn't support partial streaming in all
 *  browsers, so the 512-byte overlap is accepted as minor overhead bounded
 *  by the file size limit (C75-01/C74-03). */
function isHTMLContent(buffer: ArrayBuffer): boolean {
  // Decode first 512 bytes as UTF-8. Strip UTF-8 BOM (0xEF 0xBB 0xBF) if
  // present — some Korean card exports include a BOM, which would otherwise
  // prevent the startsWith checks from matching.
  // Known limitation: files encoded in EUC-KR (rare for .xls exports from
  // Korean card companies, which typically use UTF-8) will not be detected.
  const raw = new TextDecoder('utf-8').decode(buffer.slice(0, 512));
  const head = raw.replace(/^\uFEFF/, '').trimStart().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
}

/** Fix malformed closing tags like </td   > commonly found in Korean card exports */
function normalizeHTML(html: string): string {
  return html.replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>');
}

// ---------------------------------------------------------------------------
// Main XLSX parser (browser: accepts ArrayBuffer)
// ---------------------------------------------------------------------------

export function parseXLSX(buffer: ArrayBuffer, bank?: BankId): ParseResult {
  // Detect HTML-as-XLS (Korean card companies export HTML with .xls extension)
  let workbook: XLSX.WorkBook;
  let htmlBankHint: BankId | null = null;

  if (isHTMLContent(buffer)) {
    // Decode the full buffer. TextDecoder doesn't reliably support partial
    // streaming across all browsers, so the 512 bytes already decoded by
    // isHTMLContent are decoded again here — the overhead is bounded by
    // the file size limit (C75-01).
    const fullDecoded = new TextDecoder('utf-8').decode(buffer);
    const html = normalizeHTML(fullDecoded.replace(/^\uFEFF/, ''));
    htmlBankHint = detectBank(html).bank;
    // Pass HTML string directly to XLSX instead of re-encoding via TextEncoder.
    // Avoids creating a second full copy of the file content in memory (C1-P01).
    workbook = XLSX.read(html, { type: 'string', cellDates: false });
  } else {
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
  }

  if (workbook.SheetNames.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트를 찾을 수 없습니다.' }] };
  }

  // Try all sheets, select the one with the most transactions (C50-07).
  // This handles multi-sheet workbooks where a summary sheet might have
  // fewer transactions than a detail sheet. For typical single-sheet Korean
  // credit card exports, behavior is unchanged.
  let bestResult: ParseResult | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const result = parseXLSXSheet(sheet, bank, htmlBankHint);
    if (result.transactions.length > 0) {
      if (!bestResult || result.transactions.length > bestResult.transactions.length) {
        bestResult = result;
      }
    } else if (!bestResult) {
      bestResult = result; // Keep first empty sheet as fallback
    }
  }

  return bestResult ?? { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트 데이터를 읽을 수 없습니다.' }] };
}

function parseXLSXSheet(sheet: XLSX.WorkSheet, bank?: BankId, htmlBankHint?: BankId | null): ParseResult {
  // Convert to 2D array
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

  if (rows.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '빈 파일입니다.' }] };
  }

  // Detect bank from header rows if not provided
  let resolvedBank: BankId | null = bank ?? null;
  if (!resolvedBank) {
    if (htmlBankHint) {
      resolvedBank = htmlBankHint;
    } else {
      const headerText = rows
        .slice(0, 10)
        .map((r) => r.join(' '))
        .join(' ');
      const { bank: detected } = detectBank(headerText);
      resolvedBank = detected;
    }
  }

  // Find header row — first row with known column keywords
  let headerRowIdx = -1;
  let headers: string[] = [];

  // Uses shared isValidHeaderRow from column-matcher (C4-07) which requires
  // keywords from at least 2 distinct categories.

  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i] ?? [];
    const rowStrings = row.map((c) => String(c ?? '').trim());
    // Require at least one non-numeric cell to prevent purely-numeric rows
    // from being misidentified as headers. Matches the CSV generic parser's
    // hasNonNumeric guard pattern (C44-02). isValidHeaderRow already requires
    // keywords from 2+ categories, but this guard adds defense-in-depth.
    const hasNonNumeric = rowStrings.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric && isValidHeaderRow(rowStrings)) {
      headerRowIdx = i;
      headers = rowStrings;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      bank: resolvedBank,
      format: 'xlsx',
      transactions: [],
      errors: [{ message: '헤더 행을 찾을 수 없습니다.' }],
    };
  }

  // Get column config for this bank (or auto-detect from headers)
  const config = resolvedBank ? getBankColumnConfig(resolvedBank) : null;

  // Use shared findColumn from column-matcher for consistent column
  // matching across all parsers. Tries bank-specific config name first,
  // then falls back to regex pattern (C12-02).
  const dateCol = findColumn(headers, config?.date, DATE_COLUMN_PATTERN);
  const merchantCol = findColumn(headers, config?.merchant, MERCHANT_COLUMN_PATTERN);
  const amountCol = findColumn(headers, config?.amount, AMOUNT_COLUMN_PATTERN);
  const installCol = findColumn(headers, config?.installments, INSTALLMENTS_COLUMN_PATTERN);
  const categoryCol = findColumn(headers, config?.category, CATEGORY_COLUMN_PATTERN);
  const memoCol = findColumn(headers, config?.memo, MEMO_COLUMN_PATTERN);

  const transactions: RawTransaction[] = [];
  const errors: ParseError[] = [];

  // Track last non-empty values for merged cell forward-fill.
  // Korean bank XLSX exports commonly merge cells across installment
  // rows — SheetJS fills merged cells with empty strings. Forward-fill
  // extends to date, merchant, and category columns (matching server-side
  // parser in packages/parser/src/xlsx/index.ts).
  let lastDate: unknown = '';
  let lastMerchant: unknown = '';
  let lastCategory: unknown = '';
  let lastInstallments: unknown = '';
  let lastMemo: unknown = '';

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => !c)) continue;

    // Skip summary/total rows
    const rowText = row.map((c) => String(c ?? '')).join(' ');
    if (SUMMARY_ROW_PATTERN.test(rowText)) continue;

    // Forward-fill date column for merged cells.
    // Skip forward-fill for summary row values to prevent summary text
    // from contaminating subsequent data rows. Parity with server-side
    // XLSX parser in packages/parser/src/xlsx/index.ts (C47-01).
    const rawDateValue = dateCol !== -1 ? row[dateCol] : '';
    if (dateCol !== -1 && rawDateValue !== '' && rawDateValue != null) {
      const dateStr = String(rawDateValue);
      if (!SUMMARY_ROW_PATTERN.test(dateStr)) {
        lastDate = rawDateValue;
      }
    }
    const dateRaw = dateCol !== -1 ? (rawDateValue !== '' && rawDateValue != null ? rawDateValue : lastDate) : '';

    // Forward-fill merchant column for merged cells.
    // Skip forward-fill for summary row values (parity with server-side C47-01).
    const rawMerchantValue = merchantCol !== -1 ? row[merchantCol] : '';
    if (merchantCol !== -1 && rawMerchantValue !== '' && rawMerchantValue != null) {
      const merchantStr = String(rawMerchantValue);
      if (!SUMMARY_ROW_PATTERN.test(merchantStr)) {
        lastMerchant = rawMerchantValue;
      }
    }
    const merchantRaw = merchantCol !== -1
      ? (rawMerchantValue !== '' && rawMerchantValue != null ? rawMerchantValue : lastMerchant)
      : '';

    // Forward-fill category column for merged cells.
    // Skip forward-fill for summary row values (C52-06, parity with date/merchant).
    const rawCategoryValue = categoryCol !== -1 ? row[categoryCol] : '';
    if (categoryCol !== -1 && rawCategoryValue !== '' && rawCategoryValue != null) {
      const categoryStr = String(rawCategoryValue);
      if (!SUMMARY_ROW_PATTERN.test(categoryStr)) {
        lastCategory = rawCategoryValue;
      }
    }
    const categoryRaw = categoryCol !== -1
      ? (rawCategoryValue !== '' && rawCategoryValue != null ? rawCategoryValue : lastCategory)
      : '';

    // Forward-fill installments column for merged cells (C10-03).
    // Skip forward-fill for summary row values (C52-06, parity with date/merchant).
    const rawInstallValue = installCol !== -1 ? row[installCol] : '';
    if (installCol !== -1 && rawInstallValue !== '' && rawInstallValue != null) {
      const installStr = String(rawInstallValue);
      if (!SUMMARY_ROW_PATTERN.test(installStr)) {
        lastInstallments = rawInstallValue;
      }
    }
    const installRaw = installCol !== -1
      ? (rawInstallValue !== '' && rawInstallValue != null ? rawInstallValue : lastInstallments)
      : '';

    // Forward-fill memo column for merged cells (C15-01). Korean bank
    // XLSX exports may merge memo cells across installment sub-rows.
    // Skip forward-fill for summary row values (C52-06, parity with date/merchant).
    const rawMemoValue = memoCol !== -1 ? row[memoCol] : '';
    if (memoCol !== -1 && rawMemoValue !== '' && rawMemoValue != null) {
      const memoStr = String(rawMemoValue);
      if (!SUMMARY_ROW_PATTERN.test(memoStr)) {
        lastMemo = rawMemoValue;
      }
    }
    const memoRaw = memoCol !== -1
      ? (rawMemoValue !== '' && rawMemoValue != null ? rawMemoValue : lastMemo)
      : '';

    const amountRaw = amountCol !== -1 ? row[amountCol] : '';

    if (!dateRaw && !merchantRaw) continue;

    const amount = parseAmount(amountRaw);
    if (amount === null) {
      if (String(amountRaw ?? '').trim()) {
        errors.push({
          line: i + 1,
          message: `금액을 해석할 수 없습니다: ${String(amountRaw)}`,
          raw: rowText,
        });
      }
      continue;
    }
    // Skip zero- and negative-amount rows (e.g., balance inquiries, declined
    // transactions, refunds). These don't contribute to spending optimization
    // and would inflate monthly spending totals (C42-01/C42-02).
    if (amount <= 0) continue;

    const tx: RawTransaction = {
      date: parseDateToISO(dateRaw, errors, i),
      merchant: String(merchantRaw ?? '').replace(/^"(.*)"$/, '$1').trim(),
      amount,
      ...(installCol !== -1 && installRaw
        ? { installments: parseInstallments(String(installRaw)) }
        : {}),
      ...(categoryCol !== -1 && categoryRaw
        ? { category: String(categoryRaw).trim() }
        : {}),
      ...(memoCol !== -1 && memoRaw
        ? { memo: String(memoRaw).trim() }
        : {}),
    };

    transactions.push(tx);
  }

  return { bank: resolvedBank, format: 'xlsx', transactions, errors };
}
