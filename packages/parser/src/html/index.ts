/** HTML table transaction parser.
 *  Parses HTML tables exported from Korean bank websites. Many banks offer
 *  "save as HTML" or "print to HTML" functionality that produces .html/.htm
 *  files containing transaction data in <table> elements.
 *
 *  Reuses SheetJS (xlsx) to parse HTML tables, matching the HTML-as-XLS
 *  detection path in the XLSX parser (C98-02). This provides consistent
 *  handling of merged cells, forward-fill, and header detection. */

import type { BankId, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectBank } from '../detect.js';
import { parseDateStringToISO, isValidISODate } from '../date-utils.js';
import { parseAmountString } from '../csv/shared.js';
import {
  findColumn,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  SUMMARY_ROW_PATTERN,
  isValidHeaderRow,
} from '../csv/column-matcher.js';

// SheetJS is imported as a CommonJS module
import xlsx from 'xlsx';

/** Fix malformed closing tags like </td   > commonly found in Korean exports */
function normalizeHTML(html: string): string {
  return html.replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>');
}

/** Parse HTML content and extract transactions from tables.
 *  Uses SheetJS to parse HTML tables, then applies the same header
 *  detection and column matching as the XLSX parser. */
export function parseHTML(content: string, bank?: BankId): ParseResult {
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  // Detect bank from content if not provided
  const resolvedBank: BankId | null = bank ?? detectBank(content).bank ?? null;

  // Normalize malformed closing tags
  const normalized = normalizeHTML(content);

  // Parse HTML with SheetJS
  let workbook: xlsx.WorkBook;
  try {
    workbook = xlsx.read(Buffer.from(normalized, 'utf-8'), { type: 'buffer', cellDates: false });
  } catch (err) {
    return {
      bank: resolvedBank,
      format: 'html',
      transactions: [],
      errors: [{ message: `HTML 테이블을 읽을 수 없습니다: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }

  if (workbook.SheetNames.length === 0) {
    return { bank: resolvedBank, format: 'html', transactions: [], errors: [{ message: 'HTML에서 테이블을 찾을 수 없습니다.' }] };
  }

  // Try all sheets, select the one with the most transactions
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

  return bestResult ?? { bank: resolvedBank, format: 'html', transactions: [], errors: [{ message: 'HTML 테이블에서 데이터를 읽을 수 없습니다.' }] };
}

/** Parse a single HTML sheet (table) for transactions. */
function parseHTMLSheet(sheet: xlsx.WorkSheet, bank: BankId | null): ParseResult {
  const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  if (rows.length === 0) {
    return { bank, format: 'html', transactions: [], errors: [{ message: '빈 테이블입니다.' }] };
  }

  // Find header row — scan up to 30 rows
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
      errors: [{ message: '헤더 행을 찾을 수 없습니다.' }],
    };
  }

  // Use shared findColumn for column detection
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
      errors: [{ message: `필수 컬럼을 찾을 수 없습니다: ${missing.join(', ')}` }],
    };
  }

  // Parse data rows
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => !c)) continue;

    const rowText = row.map((c) => String(c ?? '')).join(' ');
    if (SUMMARY_ROW_PATTERN.test(rowText)) continue;

    const dateRaw = String(row[dateCol] ?? '').trim();
    const merchantRaw = String(row[merchantCol] ?? '').trim();
    const amountRaw = String(row[amountCol] ?? '').trim();

    if (!dateRaw && !merchantRaw && !amountRaw) continue;

    // Parse amount
    const amount = parseAmountString(amountRaw);
    if (amount === null) {
      if (amountRaw) {
        errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}`, raw: rowText });
      }
      continue;
    }
    if (amount <= 0) continue;

    // Parse date
    const date = parseDateStringToISO(dateRaw);
    if (!isValidISODate(date) && dateRaw) {
      errors.push({ line: i + 1, message: `날짜를 해석할 수 없습니다: ${dateRaw}`, raw: rowText });
    }

    const tx: RawTransaction = {
      date,
      merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
      amount,
    };

    if (installCol !== -1 && row[installCol]) {
      const inst = parseInt(String(row[installCol]), 10);
      if (!Number.isNaN(inst) && inst > 1) tx.installments = inst;
    }

    if (categoryCol !== -1 && row[categoryCol]) {
      tx.category = String(row[categoryCol]).trim();
    }

    if (memoCol !== -1 && row[memoCol]) {
      tx.memo = String(row[memoCol]).trim();
    }

    transactions.push(tx);
  }

  return { bank, format: 'html', transactions, errors };
}