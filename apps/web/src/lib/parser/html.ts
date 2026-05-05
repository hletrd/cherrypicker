/** HTML table transaction parser — web-side.
 *  Parity with server-side packages/parser/src/html/index.ts (C98-02).
 *  Uses SheetJS to parse HTML tables, then applies shared header detection
 *  and column matching. Includes forward-fill for merged cells (C100-01). */

import type { BankId, ParseResult, RawTransaction } from './types.js';
import { ParseError } from './types.js';
import { detectBank } from './detect.js';
import { parseDateStringToISO, isValidISODate } from './date-utils.js';
import { parseCSVAmount } from './csv.js';
import {
  findColumn,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  isSummaryRow,
  isValidHeaderRow,
} from './column-matcher.js';

// SheetJS is imported as a CommonJS module
import * as xlsx from 'xlsx';

/** Fix malformed closing tags like </td   > */
export function normalizeHTML(html: string): string {
  return html.replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>');
}

/** Parse HTML content and extract transactions from tables. */
export function parseHTML(content: string, bank?: BankId): ParseResult {
  const resolvedBank: BankId | null = bank ?? detectBank(content).bank ?? null;

  const normalized = normalizeHTML(content);

  let workbook: xlsx.WorkBook;
  try {
    const encoder = new TextEncoder();
    workbook = xlsx.read(encoder.encode(normalized), { type: 'array', cellDates: false });
  } catch (err) {
    return {
      bank: resolvedBank,
      format: 'html',
      transactions: [],
      errors: [new ParseError(`HTML 테이블을 읽을 수 없습니다: ${err instanceof Error ? err.message : String(err)}`)],
    };
  }

  if (workbook.SheetNames.length === 0) {
    return { bank: resolvedBank, format: 'html', transactions: [], errors: [new ParseError('HTML에서 테이블을 찾을 수 없습니다.')] };
  }

  let bestResult: ParseResult | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const result = parseHTMLSheet(sheet, resolvedBank);
    if (result.transactions.length > 0) {
      if (!bestResult || result.transactions.length > bestResult.transactions.length) {
        bestResult = result;
      }
    } else if (!bestResult) {
      bestResult = result;
    }
  }

  return bestResult ?? { bank: resolvedBank, format: 'html', transactions: [], errors: [new ParseError('HTML 테이블에서 데이터를 읽을 수 없습니다.')] };
}

/** Parse a single HTML sheet for transactions.
 *  Includes forward-fill for merged cells — Korean bank HTML exports
 *  commonly merge cells across rows (C100-01, parity with server-side). */
function parseHTMLSheet(sheet: xlsx.WorkSheet, bank: BankId | null): ParseResult {
  const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  if (rows.length === 0) {
    return { bank, format: 'html', transactions: [], errors: [new ParseError('빈 테이블입니다.')] };
  }

  let headerRowIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i] ?? [];
    const rowStrings = row.map((c) => String(c ?? '').trim());
    const hasNonNumeric = rowStrings.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric && isValidHeaderRow(rowStrings)) {
      headerRowIdx = i;
      headers = rowStrings;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      bank,
      format: 'html',
      transactions: [],
      errors: [new ParseError('헤더 행을 찾을 수 없습니다.')],
    };
  }

  const dateCol = findColumn(headers, undefined, DATE_COLUMN_PATTERN);
  const merchantCol = findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN);
  const amountCol = findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN);
  const installCol = findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN);
  const categoryCol = findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN);
  const memoCol = findColumn(headers, undefined, MEMO_COLUMN_PATTERN);

  if (dateCol === -1 || amountCol === -1) {
    const missing: string[] = [];
    if (dateCol === -1) missing.push('날짜');
    if (amountCol === -1) missing.push('금액');
    return {
      bank,
      format: 'html',
      transactions: [],
      errors: [new ParseError(`필수 컬럼을 찾을 수 없습니다: ${missing.join(', ')}`)],
    };
  }

  // Forward-fill tracking for merged cells (C100-01, parity with server-side).
  let lastDate: unknown = '';
  let lastMerchant: unknown = '';
  let lastCategory: unknown = '';
  let lastInstallments: unknown = '';
  let lastMemo: unknown = '';
  let lastAmount: unknown = '';

  // Helper: check if a cell has non-empty, non-whitespace content.
  function isNonEmpty(val: unknown): boolean {
    return val !== '' && val != null && String(val).trim() !== '';
  }

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => !c)) continue;

    const rowText = row.map((c) => String(c ?? '')).join(' ');
    if (isSummaryRow(rowText)) continue;

    // Forward-fill for all columns — update last-value only when cell has
    // non-empty content; skip summary row values; use last-value as fallback.
    // Matches server-side HTML parser logic (C100-01).

    // Date column forward-fill
    const rawDateValue = dateCol !== -1 ? row[dateCol] : '';
    if (dateCol !== -1 && isNonEmpty(rawDateValue)) {
      if (!isSummaryRow(String(rawDateValue))) {
        lastDate = rawDateValue;
      }
    }
    const dateRaw = String(dateCol !== -1 ? (isNonEmpty(rawDateValue) ? rawDateValue : lastDate) : '').trim();

    // Merchant column forward-fill
    const rawMerchantValue = merchantCol !== -1 ? row[merchantCol] : '';
    if (merchantCol !== -1 && isNonEmpty(rawMerchantValue)) {
      if (!isSummaryRow(String(rawMerchantValue))) {
        lastMerchant = rawMerchantValue;
      }
    }
    const merchantRaw = String(merchantCol !== -1 ? (isNonEmpty(rawMerchantValue) ? rawMerchantValue : lastMerchant) : '').trim();

    // Category column forward-fill
    const rawCategoryValue = categoryCol !== -1 ? row[categoryCol] : '';
    if (categoryCol !== -1 && isNonEmpty(rawCategoryValue)) {
      if (!isSummaryRow(String(rawCategoryValue))) {
        lastCategory = rawCategoryValue;
      }
    }
    const categoryRaw = String(categoryCol !== -1 ? (isNonEmpty(rawCategoryValue) ? rawCategoryValue : lastCategory) : '').trim();

    // Installments column forward-fill
    const rawInstallValue = installCol !== -1 ? row[installCol] : '';
    if (installCol !== -1 && isNonEmpty(rawInstallValue)) {
      if (!isSummaryRow(String(rawInstallValue))) {
        lastInstallments = rawInstallValue;
      }
    }
    const installRaw = String(installCol !== -1 ? (isNonEmpty(rawInstallValue) ? rawInstallValue : lastInstallments) : '').trim();

    // Memo column forward-fill
    const rawMemoValue = memoCol !== -1 ? row[memoCol] : '';
    if (memoCol !== -1 && isNonEmpty(rawMemoValue)) {
      if (!isSummaryRow(String(rawMemoValue))) {
        lastMemo = rawMemoValue;
      }
    }
    const memoRaw = String(memoCol !== -1 ? (isNonEmpty(rawMemoValue) ? rawMemoValue : lastMemo) : '').trim();

    // Amount column forward-fill
    const rawAmountValue = amountCol !== -1 ? row[amountCol] : '';
    if (amountCol !== -1 && isNonEmpty(rawAmountValue)) {
      if (!isSummaryRow(String(rawAmountValue))) {
        lastAmount = rawAmountValue;
      }
    }
    const amountRaw = String(amountCol !== -1 ? (isNonEmpty(rawAmountValue) ? rawAmountValue : lastAmount) : '').trim();

    if (!dateRaw && !merchantRaw && !amountRaw) continue;

    const amount = parseCSVAmount(amountRaw);
    if (amount === null) {
      if (amountRaw) {
        errors.push(new ParseError(`금액을 해석할 수 없습니다: ${amountRaw}`, { line: i + 1, raw: rowText }));
      }
      continue;
    }
    if (amount <= 0) continue;

    const date = parseDateStringToISO(dateRaw);
    if (!isValidISODate(date) && dateRaw) {
      errors.push(new ParseError(`날짜를 해석할 수 없습니다: ${dateRaw}`, { line: i + 1, raw: rowText }));
    }

    const tx: RawTransaction = {
      date,
      merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
      amount,
    };

    if (installCol !== -1 && installRaw) {
      const inst = parseInt(installRaw, 10);
      if (!Number.isNaN(inst) && inst > 1) tx.installments = inst;
    }

    if (categoryCol !== -1 && categoryRaw) {
      tx.category = categoryRaw;
    }

    if (memoCol !== -1 && memoRaw) {
      tx.memo = memoRaw;
    }

    transactions.push(tx);
  }

  return { bank, format: 'html', transactions, errors };
}