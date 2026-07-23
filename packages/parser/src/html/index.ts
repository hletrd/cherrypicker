/** HTML table transaction parser.
 *  Parses HTML tables exported from Korean bank websites. Many banks offer
 *  "save as HTML" or "print to HTML" functionality that produces .html/.htm
 *  files containing transaction data in <table> elements.
 *
 *  Reuses SheetJS (xlsx) to parse HTML tables, matching the HTML-as-XLS
 *  detection path in the XLSX parser (C98-02). This provides consistent
 *  handling of merged cells, forward-fill, and header detection. */

import type { BankId, ParseResult, RawTransaction } from '../types.js';
import { ParseError } from '../types.js';
import { detectBank } from '../detect.js';
import { parseAmount } from '../amount.js';
import { normalizeHTML } from '../csv/shared.js';
import { parseDateCell } from '../shared/date-cell.js';
import {
  createSheetMergeIndex,
  resolveSheetCell,
} from '../shared/sheet-cells.js';
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
} from '../csv/column-matcher.js';

// SheetJS is imported as an ES module
import xlsx from 'xlsx';

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
      errors: [new ParseError(`HTML 테이블을 읽을 수 없습니다: ${err instanceof Error ? err.message : String(err)}`)],
    };
  }

  if (workbook.SheetNames.length === 0) {
    return { bank: resolvedBank, format: 'html', transactions: [], errors: [new ParseError('HTML에서 테이블을 찾을 수 없습니다.')] };
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

  return bestResult ?? { bank: resolvedBank, format: 'html', transactions: [], errors: [new ParseError('HTML 테이블에서 데이터를 읽을 수 없습니다.')] };
}

/** Parse a single HTML sheet (table) for transactions. */
export function parseHTMLSheet(sheet: xlsx.WorkSheet, bank: BankId | null): ParseResult {
  const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  if (rows.length === 0) {
    return { bank, format: 'html', transactions: [], errors: [new ParseError('빈 테이블입니다.')] };
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
      errors: [new ParseError('헤더 행을 찾을 수 없습니다.')],
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
      errors: [new ParseError(`필수 컬럼을 찾을 수 없습니다: ${missing.join(', ')}`)],
    };
  }

  const mergeIndex = createSheetMergeIndex(sheet['!merges']);
  const consumedAmountSources = new Set<string>();

  // Parse data rows
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => !c)) {
      continue;
    }

    const rowText = row.map((c) => String(c ?? '')).join(' ');
    if (isSummaryRow(rowText)) {
      continue;
    }

    // Blank cells inherit values only when SheetJS confirms that the cell is
    // covered by an actual rowspan/colspan merge. Generic forward-fill can
    // turn spacer or note rows into fabricated transactions.
    const dateCell = resolveSheetCell(rows, i, dateCol, mergeIndex);
    const merchantCell = merchantCol === -1
      ? null
      : resolveSheetCell(rows, i, merchantCol, mergeIndex);
    const categoryCell = categoryCol === -1
      ? null
      : resolveSheetCell(rows, i, categoryCol, mergeIndex);
    const installCell = installCol === -1
      ? null
      : resolveSheetCell(rows, i, installCol, mergeIndex);
    const memoCell = memoCol === -1
      ? null
      : resolveSheetCell(rows, i, memoCol, mergeIndex);
    const amountCell = resolveSheetCell(rows, i, amountCol, mergeIndex);

    const dateRaw = dateCell.value;
    const merchantRaw = String(merchantCell?.value ?? '').trim();
    const categoryRaw = String(categoryCell?.value ?? '').trim();
    const installRaw = String(installCell?.value ?? '').trim();
    const memoRaw = String(memoCell?.value ?? '').trim();
    const amountRaw = amountCell.value;

    if (!String(dateRaw ?? '').trim() && !merchantRaw && !String(amountRaw ?? '').trim()) continue;
    if (amountCell.fromMerge && consumedAmountSources.has(amountCell.sourceKey)) continue;

    // Parse amount
    const amount = parseAmount(amountRaw);
    if (amount === null) {
      if (amountRaw) {
        errors.push(new ParseError(`금액을 해석할 수 없습니다: ${amountRaw}`, { line: i + 1, raw: rowText  }));
      }
      continue;
    }
    if (amount <= 0) {
      errors.push(new ParseError(
        `지출로 처리되지 않는 금액입니다: ${merchantRaw || '알 수 없는 거래'} ${amount}원`,
        { line: i + 1, raw: rowText },
      ));
      continue;
    }

    // Parse date
    const parsedDate = parseDateCell(dateRaw);
    if (parsedDate.error || !/^\d{4}-\d{2}-\d{2}$/.test(parsedDate.value)) {
      errors.push(new ParseError(
        parsedDate.error ?? '날짜를 해석할 수 없습니다: 빈 값',
        { line: i + 1, raw: rowText },
      ));
      continue;
    }

    const tx: RawTransaction = {
      date: parsedDate.value,
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
    consumedAmountSources.add(amountCell.sourceKey);
  }

  return { bank, format: 'html', transactions, errors };
}
