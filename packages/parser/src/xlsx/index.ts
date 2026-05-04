import { readFile } from 'fs/promises';
import type { BankId, ParseResult } from '../types.js';
import { detectBank } from '../detect.js';
import { getBankColumnConfig, type ColumnConfig } from './adapters/index.js';
import { parseDateStringToISO, isValidDayForMonth } from '../date-utils.js';
import {
  normalizeHeader,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
} from '../csv/column-matcher.js';

// SheetJS is imported as a CommonJS module
import xlsx from 'xlsx';

// ---------------------------------------------------------------------------
// HTML-as-XLS detection & normalization
// Korean card companies often export HTML tables with .xls extension.
// ---------------------------------------------------------------------------

function isHTMLContent(buffer: Buffer): boolean {
  const head = buffer.slice(0, 512).toString('utf-8').trimStart().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
}

/** Fix malformed closing tags like </td   > commonly found in Korean card exports */
function normalizeHTML(html: string): string {
  return html.replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>');
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

function parseDateToISO(raw: unknown): string {
  if (typeof raw === 'number') {
    if (raw < 1 || raw > 100000) return String(raw);
    // Excel serial date number
    const date = xlsx.SSF.parse_date_code(raw);
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
      return String(raw);
    }
  }
  if (typeof raw === 'string') {
    return parseDateStringToISO(raw);
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
    let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
    // Handle parenthesized negatives: (1234) → -1234
    const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isNeg) cleaned = cleaned.slice(1, -1);
    if (!cleaned) return null;
    // Use Math.round(parseFloat(...)) to match the numeric path's rounding
    // behavior and the web-side parser (C21-03/C34-02). parseInt truncates
    // decimal remainders which can produce off-by-1 Won errors.
    const n = Math.round(parseFloat(cleaned));
    if (Number.isNaN(n)) return null;
    return isNeg ? -n : n;
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

export async function parseXLSX(filePath: string, bank?: BankId): Promise<ParseResult> {
  const buffer = await readFile(filePath);

  // Detect HTML-as-XLS (Korean card companies export HTML with .xls extension)
  let workbook: xlsx.WorkBook;
  let htmlBankHint: BankId | null = null;

  if (isHTMLContent(buffer)) {
    const html = normalizeHTML(buffer.toString('utf-8'));
    htmlBankHint = detectBank(html).bank;
    workbook = xlsx.read(Buffer.from(html, 'utf-8'), { type: 'buffer', cellDates: false });
  } else {
    workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false });
  }

  if (workbook.SheetNames.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트를 찾을 수 없습니다.' }] };
  }

  // Try all sheets, select the one with the most transactions (matches
  // web-side behavior in apps/web/src/lib/parser/xlsx.ts C50-07).
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
      bestResult = result;
    }
  }

  return bestResult ?? { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트 데이터를 읽을 수 없습니다.' }] };
}

// ---------------------------------------------------------------------------
// Header keyword vocabulary (matches frontend)
// ---------------------------------------------------------------------------

const HEADER_KEYWORDS = [
  '이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '매출일',
  '이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호',
  '이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액',
];

// Keyword categories for header detection — hoisted to module scope to avoid
// recreating Sets on every parse call. Matches the generic CSV parser.
const DATE_KEYWORDS: ReadonlySet<string> = new Set(['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '매출일']);
const MERCHANT_KEYWORDS: ReadonlySet<string> = new Set(['이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호']);
const AMOUNT_KEYWORDS: ReadonlySet<string> = new Set(['이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액']);

function parseXLSXSheet(
  sheet: xlsx.WorkSheet,
  bank: BankId | undefined,
  htmlBankHint: BankId | null,
): ParseResult {
  // Convert to 2D array
  const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

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

  // Find header row — scan up to 30 rows for banks with long preambles.
  // Require keywords from at least 2 distinct categories (date, merchant,
  // amount) to avoid matching summary rows with only amount keywords.
  // Matches the web-side xlsx.ts (C86-05) and both generic CSV parsers.
  let headerRowIdx = -1;
  let headers: string[] = [];

  // Module-level keyword Sets (hoisted above parseXLSXSheet) avoid
  // recreating on every call.
  const xlsxDateKeywords = DATE_KEYWORDS;
  const xlsxMerchantKeywords = MERCHANT_KEYWORDS;
  const xlsxAmountKeywords = AMOUNT_KEYWORDS;

  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i] ?? [];
    const rowStrings = row.map((c) => String(c ?? '').trim());
    const matchCount = rowStrings.filter((c) => HEADER_KEYWORDS.includes(c)).length;
    if (matchCount >= 2) {
      const matchedCategories = [xlsxDateKeywords, xlsxMerchantKeywords, xlsxAmountKeywords]
        .filter(catSet => rowStrings.some((c) => catSet.has(c)))
        .length;
      if (matchedCategories >= 2) {
        headerRowIdx = i;
        headers = rowStrings;
        break;
      }
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

  // Try bank-specific config name first; if not found, fall back to regex
  // pattern from the shared ColumnMatcher module. Uses normalizeHeader() to
  // tolerate whitespace and parenthetical suffixes in column names.
  const findCol = (configName: string | undefined, pattern: RegExp): number => {
    if (configName) {
      const normalizedConfig = normalizeHeader(configName);
      const idx = headers.findIndex((h) => normalizeHeader(h) === normalizedConfig);
      if (idx !== -1) return idx;
    }
    return headers.findIndex((h) => pattern.test(normalizeHeader(h)));
  };

  const dateCol = findCol(config?.date, DATE_COLUMN_PATTERN);
  const merchantCol = findCol(config?.merchant, MERCHANT_COLUMN_PATTERN);
  const amountCol = findCol(config?.amount, AMOUNT_COLUMN_PATTERN);
  const installCol = findCol(config?.installments, INSTALLMENTS_COLUMN_PATTERN);
  const categoryCol = findCol(config?.category, CATEGORY_COLUMN_PATTERN);
  const memoCol = findCol(config?.memo, MEMO_COLUMN_PATTERN);

  const transactions: import('../types.js').RawTransaction[] = [];
  const errors: import('../types.js').ParseError[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => !c)) continue;

    // Skip summary/total rows
    const rowText = row.map((c) => String(c ?? '')).join(' ');
    if (/합계|총계|소계|total|sum/i.test(rowText)) continue;

    const dateRaw = dateCol !== -1 ? row[dateCol] : '';
    const merchantRaw = merchantCol !== -1 ? row[merchantCol] : '';
    const amountRaw = amountCol !== -1 ? row[amountCol] : '';

    if (!dateRaw && !merchantRaw) continue;

    const amount = parseAmount(amountRaw);
    if (amount === null) {
      if (String(amountRaw ?? '').trim()) {
        errors.push({
          line: i + 1,
          message: `Cannot parse amount: ${String(amountRaw)}`,
          raw: rowText,
        });
      }
      continue;
    }
    // Skip zero- and negative-amount rows (e.g., balance inquiries, declined
    // transactions, refunds). These don't contribute to spending optimization
    // and would inflate monthly spending totals (C42-01/C42-02). All other
    // parsers (CSV, web CSV/XLSX/PDF) apply the same filter.
    if (amount <= 0) continue;

    const tx = {
      date: parseDateToISO(dateRaw),
      merchant: String(merchantRaw ?? '').replace(/^"(.*)"$/, '$1').trim(),
      amount,
      ...(installCol !== -1 && row[installCol]
        ? { installments: parseInstallments(row[installCol]) }
        : {}),
      ...(categoryCol !== -1 && row[categoryCol]
        ? { category: String(row[categoryCol]).trim() }
        : {}),
      ...(memoCol !== -1 && row[memoCol]
        ? { memo: String(row[memoCol]).trim() }
        : {}),
    };

    transactions.push(tx);
  }

  return { bank: resolvedBank, format: 'xlsx', transactions, errors };
}
