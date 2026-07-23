import { readFile } from 'fs/promises';
import type { BankId, ParseResult } from '../types.js';
import { ParseError } from '../types.js';
import { detectBank } from '../detect.js';
import { getBankColumnConfig, type ColumnConfig } from './adapters/index.js';
import { isValidISODate } from '../date-utils.js';
import { parseAmount } from '../amount.js';
import { normalizeHTML } from '../csv/shared.js';
import { parseDateCell } from '../shared/date-cell.js';
import {
  decodeStatementTextBytes,
  UnsupportedTextEncodingError,
} from '../shared/encoding.js';
import {
  isHTMLStatementBytes,
  type StatementTextPrefixDecoder,
} from '../shared/format-detection.js';
import {
  MAX_REQUIRED_FIELD_ROW_ERRORS,
  missingRequiredColumnLabels,
  normalizeRequiredMerchant,
  REQUIRED_MERCHANT_ERROR_CODE,
  REQUIRED_MERCHANT_ERROR_MESSAGE,
} from '../shared/required-fields.js';
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
  HEADER_KEYWORDS,
  isValidHeaderRow,
} from '../csv/column-matcher.js';

// SheetJS is imported as a CommonJS module
import xlsx from 'xlsx';

// ---------------------------------------------------------------------------
// HTML-as-XLS detection & normalization
// Korean card companies often export HTML tables with .xls extension.
// ---------------------------------------------------------------------------

export function isHTMLContent(
  buffer: Uint8Array,
  decodePrefix?: StatementTextPrefixDecoder,
): boolean {
  return isHTMLStatementBytes(buffer, decodePrefix);
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

// Excel formula error strings — when `raw: true` is used in sheet_to_json,
// formula cells that produce errors are returned as these strings rather
// than as numeric values. Detecting them early produces a clearer error
// message than the generic "날짜를 해석할 수 없습니다" (C14-01).
const EXCEL_ERROR_PATTERN = /^#(VALUE!|REF!|DIV\/0!|NAME\?|NULL!|NUM!|CALC!|N\/A)$/i;

export function parseDateToISO(
  raw: unknown,
  errors?: ParseError[],
  lineIdx?: number,
): string {
  const result = parseDateCell(raw);
  if (result.error && errors && lineIdx !== undefined) {
    errors.push(new ParseError(result.error, { line: lineIdx + 1 }));
  }
  return result.value;
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
  return parseXLSXBuffer(buffer, bank);
}

export function parseXLSXBuffer(buffer: Uint8Array, bank?: BankId): ParseResult {
  // Detect HTML-as-XLS (Korean card companies export HTML with .xls extension)
  let workbook: xlsx.WorkBook;
  let htmlBankHint: BankId | null = null;

  try {
    if (isHTMLContent(buffer)) {
      const html = normalizeHTML(decodeStatementTextBytes(buffer, 'html'));
      htmlBankHint = detectBank(html).bank;
      workbook = xlsx.read(html, { type: 'string', cellDates: false });
    } else {
      workbook = xlsx.read(Buffer.from(buffer), { type: 'buffer', cellDates: false });
    }
  } catch (err) {
    if (err instanceof UnsupportedTextEncodingError) throw err;
    return {
      bank: bank ?? null,
      format: 'xlsx',
      transactions: [],
      errors: [new ParseError(`XLSX 파일을 읽을 수 없습니다: ${err instanceof Error ? err.message : String(err)}`)],
    };
  }

  if (workbook.SheetNames.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [new ParseError('시트를 찾을 수 없습니다.')] };
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

  return bestResult ?? { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [new ParseError('시트 데이터를 읽을 수 없습니다.')] };
}

// Header keyword vocabulary and category Sets are imported from the shared
// column-matcher module (C4-07) to avoid duplication across 4 parser files.

function parseXLSXSheet(
  sheet: xlsx.WorkSheet,
  bank: BankId | undefined,
  htmlBankHint: BankId | null,
): ParseResult {
  // Convert to 2D array
  const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

  if (rows.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [new ParseError('빈 파일입니다.')] };
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
  // Uses shared isValidHeaderRow from column-matcher (C4-07) which requires
  // keywords from at least 2 distinct categories.
  let headerRowIdx = -1;
  let headers: string[] = [];

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
      errors: [new ParseError('헤더 행을 찾을 수 없습니다.')],
    };
  }

  // Get column config for this bank (or auto-detect from headers)
  const config = resolvedBank ? getBankColumnConfig(resolvedBank) : null;

  // Use shared findColumn from column-matcher for consistent column
  // matching across all parsers. Tries bank-specific config name first,
  // then falls back to regex pattern (F6-01).
  const dateCol = findColumn(headers, config?.date, DATE_COLUMN_PATTERN);
  const merchantCol = findColumn(headers, config?.merchant, MERCHANT_COLUMN_PATTERN);
  const amountCol = findColumn(headers, config?.amount, AMOUNT_COLUMN_PATTERN);
  const installCol = findColumn(headers, config?.installments, INSTALLMENTS_COLUMN_PATTERN);
  const categoryCol = findColumn(headers, config?.category, CATEGORY_COLUMN_PATTERN);
  const memoCol = findColumn(headers, config?.memo, MEMO_COLUMN_PATTERN);

  const missingColumns = missingRequiredColumnLabels({
    date: dateCol,
    merchant: merchantCol,
    amount: amountCol,
  });
  if (missingColumns.length > 0) {
    return {
      bank: resolvedBank,
      format: 'xlsx',
      transactions: [],
      errors: [new ParseError(`필수 컬럼을 찾을 수 없습니다: ${missingColumns.join(', ')}`)],
    };
  }

  const transactions: import('../types.js').RawTransaction[] = [];
  const errors: import('../types.js').ParseError[] = [];

  const mergeIndex = createSheetMergeIndex(sheet['!merges']);
  const consumedAmountSources = new Set<string>();
  let requiredMerchantErrorCount = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => !c)) {
      continue;
    }

    // Skip summary/total rows
    const rowText = row.map((c) => String(c ?? '')).join(' ');
    if (isSummaryRow(rowText)) {
      continue;
    }

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
    const merchantRaw = merchantCell?.value ?? '';
    const categoryRaw = categoryCell?.value ?? '';
    const installRaw = installCell?.value ?? '';
    const memoRaw = memoCell?.value ?? '';
    const amountRaw = amountCell.value;

    if (!dateRaw && !merchantRaw && !amountRaw) continue;
    if (amountCell.fromMerge && consumedAmountSources.has(amountCell.sourceKey)) continue;

    const merchant = normalizeRequiredMerchant(merchantRaw);
    if (!merchant) {
      if (requiredMerchantErrorCount < MAX_REQUIRED_FIELD_ROW_ERRORS) {
        errors.push(new ParseError(REQUIRED_MERCHANT_ERROR_MESSAGE, {
          code: REQUIRED_MERCHANT_ERROR_CODE,
          line: i + 1,
          raw: rowText,
        }));
        requiredMerchantErrorCount++;
      }
      continue;
    }
    const amount = parseAmount(amountRaw);
    if (amount === null) {
      if (String(amountRaw ?? '').trim()) {
        // Detect Excel formula error strings for specific error messages (C73-04)
        if (typeof amountRaw === 'string' && EXCEL_ERROR_PATTERN.test(amountRaw.trim())) {
          errors.push(new ParseError(`셀 수식 오류: ${amountRaw.trim()}`, { line: i + 1, raw: rowText,
           }));
        } else {
          errors.push(new ParseError(`금액을 해석할 수 없습니다: ${String(amountRaw)}`, { line: i + 1, raw: rowText,
           }));
        }
      }
      continue;
    }
    // Skip zero- and negative-amount rows (e.g., balance inquiries, declined
    // transactions, refunds). These don't contribute to spending optimization
    // and would inflate monthly spending totals (C42-01/C42-02). All other
    // parsers (CSV, web CSV/XLSX/PDF) apply the same filter.
    if (amount <= 0) {
      errors.push(new ParseError(
        `지출로 처리되지 않는 금액입니다: ${merchant} ${amount}원`,
        { line: i + 1, raw: rowText },
      ));
      continue;
    }

    const parsedDate = parseDateToISO(dateRaw, errors, i);
    // Validate that the parsed date is a proper ISO date string (YYYY-MM-DD).
    // Without this check, invalid dates from failed serial date conversions
    // (e.g., "45678") or corrupted data leak into the transaction object.
    // Parity with CSV adapter-factory and generic CSV parser which both
    // validate with isValidISODate after parseDateStringToISO (C94-01).
    if (!isValidISODate(parsedDate)) {
      // parseDateToISO may have already pushed an error; only add if it didn't
      const alreadyReported = errors.some(
        (e) => e.line === i + 1 && e.message.includes('날짜를 해석할 수 없습니다'),
      );
      if (!alreadyReported) {
        errors.push(new ParseError(`날짜를 해석할 수 없습니다: ${String(dateRaw).trim() || '빈 값'}`, { line: i + 1, raw: rowText,
         }));
      }
      continue;
    }

    const tx = {
      date: parsedDate,
      merchant,
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
    consumedAmountSources.add(amountCell.sourceKey);
  }

  return { bank: resolvedBank, format: 'xlsx', transactions, errors };
}
