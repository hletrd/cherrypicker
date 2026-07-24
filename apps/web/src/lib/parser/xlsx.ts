import * as XLSX from 'xlsx';
import type { BankId, ParseResult, RawTransaction } from './types.js';
import { createParseErrorCollector, ParseError } from './types.js';
import {
  AMBIGUOUS_AMOUNT_ERROR_CODE,
  AMBIGUOUS_AMOUNT_MESSAGE,
  BANK_COLUMN_CONFIGS,
  compileAmountFieldPlan,
  decodeStatementTextBytes,
  isHTMLStatementBytes,
  missingRequiredColumnLabels,
  normalizeRequiredMerchant,
  normalizeResolvedSpendingAmount,
  NON_SPENDING_AMOUNT_ERROR_CODE,
  nonSpendingAmountMessage,
  preflightXLSXArchive,
  REQUIRED_MERCHANT_ERROR_CODE,
  REQUIRED_MERCHANT_ERROR_MESSAGE,
  resolveAmountField,
  getBankColumnConfig,
  type ColumnConfig,
  type StatementTextPrefixDecoder,
  UnsupportedTextEncodingError,
  validateWorkbookSheetMetadata,
  WORKSHEET_METADATA_REJECTED_ERROR_CODE,
  WORKSHEET_METADATA_REJECTED_MESSAGE,
  WorksheetMetadataValidationError,
  XLSX_ARCHIVE_REJECTED_ERROR_CODE,
  XLSX_ARCHIVE_REJECTED_MESSAGE,
  XLSXArchiveValidationError,
} from '@cherrypicker/parser/browser';
import { detectBank } from './detect.js';
import { normalizeHTML } from './html-normalize.js';
import { parseAmount } from './amount.js';
import {
  createSheetMergeIndex,
  parseDateCell,
  resolveSheetCell,
} from '@cherrypicker/parser/browser';
import {
  findColumn,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  isSummaryRow,
  isValidHeaderRow,
} from './column-matcher.js';

export {
  BANK_COLUMN_CONFIGS,
  getBankColumnConfig,
  type ColumnConfig,
};

// Keyword categories for header detection — hoisted to module scope to avoid
// recreating Sets on every parse call. Matches server-side XLSX parser.
// Keyword category Sets removed — now imported from column-matcher.ts (C4-07).

/** Shared date-parsing — delegates string values to the canonical
 *  implementation in date-utils.ts to avoid triplicating the logic
 *  across parsers (C19-01). The xlsx parser additionally handles
 *  Excel serial date numbers before falling through to the shared
 *  string parser. */
import { isValidISODate } from './date-utils.js';

// Excel formula error strings — when `raw: true` is used in sheet_to_json,
// formula cells that produce errors are returned as these strings. Detecting
// them early produces a clearer error message. Parity with server-side
// XLSX parser in packages/parser/src/xlsx/index.ts (C14-01).
const EXCEL_ERROR_PATTERN = /^#(VALUE!|REF!|DIV\/0!|NAME\?|NULL!|NUM!|CALC!|N\/A)$/i;

export function parseDateToISO(raw: unknown, errors?: ParseError[], lineIdx?: number): string {
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

// ---------------------------------------------------------------------------
// HTML-as-XLS detection & normalization
// Korean card companies often export HTML tables with .xls extension.
// ---------------------------------------------------------------------------

/** Check if the buffer contains HTML content (HTML-as-XLS).
 *  Uses the shared BOM/UTF-8/CP949 detector before checking HTML signatures,
 *  so legacy Korean exports and BOM-marked UTF-16 tables route correctly. */
export function isHTMLContent(
  buffer: ArrayBuffer | Uint8Array,
  decodePrefix?: StatementTextPrefixDecoder,
): boolean {
  return isHTMLStatementBytes(
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
    decodePrefix,
  );
}

// ---------------------------------------------------------------------------
// Main XLSX parser (browser: accepts ArrayBuffer)
// ---------------------------------------------------------------------------

export function parseXLSX(buffer: ArrayBuffer, bank?: BankId): ParseResult {
  // Detect HTML-as-XLS (Korean card companies export HTML with .xls extension)
  let workbook: XLSX.WorkBook;
  let htmlBankHint: BankId | null = null;

  try {
    if (isHTMLContent(buffer)) {
      const html = normalizeHTML(
        decodeStatementTextBytes(new Uint8Array(buffer), 'html'),
      );
      htmlBankHint = detectBank(html).bank;
      // Pass HTML string directly to XLSX instead of re-encoding via TextEncoder.
      // Avoids creating a second full copy of the file content in memory (C1-P01).
      workbook = XLSX.read(html, { type: 'string', cellDates: false });
    } else {
      const bytes = new Uint8Array(buffer);
      preflightXLSXArchive(bytes);
      workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
    }
    validateWorkbookSheetMetadata(workbook);
  } catch (error) {
    if (error instanceof UnsupportedTextEncodingError) throw error;
    if (error instanceof WorksheetMetadataValidationError) {
      return {
        bank: bank ?? null,
        format: 'xlsx',
        transactions: [],
        errors: [new ParseError(WORKSHEET_METADATA_REJECTED_MESSAGE, {
          code: WORKSHEET_METADATA_REJECTED_ERROR_CODE,
          format: 'xlsx',
        })],
      };
    }
    if (error instanceof XLSXArchiveValidationError) {
      return {
        bank: bank ?? null,
        format: 'xlsx',
        transactions: [],
        errors: [new ParseError(XLSX_ARCHIVE_REJECTED_MESSAGE, {
          code: XLSX_ARCHIVE_REJECTED_ERROR_CODE,
          format: 'xlsx',
        })],
      };
    }
    return {
      bank: bank ?? null,
      format: 'xlsx',
      transactions: [],
      errors: [new ParseError(
        `XLSX 파일을 읽을 수 없습니다: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )],
    };
  }

  if (workbook.SheetNames.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [new ParseError('시트를 찾을 수 없습니다.')] };
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

  return bestResult ?? { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [new ParseError('시트 데이터를 읽을 수 없습니다.')] };
}

function parseXLSXSheet(sheet: XLSX.WorkSheet, bank?: BankId, htmlBankHint?: BankId | null): ParseResult {
  // Convert to 2D array
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

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
      errors: [new ParseError('헤더 행을 찾을 수 없습니다.')],
    };
  }

  // Get column config for this bank (or auto-detect from headers)
  const config = resolvedBank ? getBankColumnConfig(resolvedBank) : null;

  // Use shared findColumn from column-matcher for consistent column
  // matching across all parsers. Tries bank-specific config name first,
  // then falls back to regex pattern (C12-02).
  const dateCol = findColumn(headers, config?.date, DATE_COLUMN_PATTERN);
  const merchantCol = findColumn(headers, config?.merchant, MERCHANT_COLUMN_PATTERN);
  const amountPlan = compileAmountFieldPlan(headers, config?.amount);
  const installCol = findColumn(headers, config?.installments, INSTALLMENTS_COLUMN_PATTERN);
  const categoryCol = findColumn(headers, config?.category, CATEGORY_COLUMN_PATTERN);
  const memoCol = findColumn(headers, config?.memo, MEMO_COLUMN_PATTERN);

  const missingColumns = missingRequiredColumnLabels({
    date: dateCol,
    merchant: merchantCol,
    amount: amountPlan.candidates[0]?.index ?? -1,
  });
  if (missingColumns.length > 0) {
    return {
      bank: resolvedBank,
      format: 'xlsx',
      transactions: [],
      errors: [new ParseError(`필수 컬럼을 찾을 수 없습니다: ${missingColumns.join(', ')}`)],
    };
  }

  const transactions: RawTransaction[] = [];
  const errors = createParseErrorCollector();

  const mergeIndex = createSheetMergeIndex(sheet['!merges']);
  const consumedAmountSources = new Set<string>();

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
    const amountCells = new Map(
      amountPlan.candidates.map(({ index }) => [
        index,
        resolveSheetCell(rows, i, index, mergeIndex),
      ]),
    );
    const amountResolution = resolveAmountField(
      amountPlan,
      (index) => amountCells.get(index)?.value,
    );
    const amountCell = amountResolution.kind === 'spending'
      || amountResolution.kind === 'non-spending'
      ? amountCells.get(amountResolution.index) ?? null
      : null;

    const dateRaw = dateCell.value;
    const merchantRaw = merchantCell?.value ?? '';
    const categoryRaw = categoryCell?.value ?? '';
    const installRaw = installCell?.value ?? '';
    const memoRaw = memoCell?.value ?? '';

    if (
      !dateRaw
      && !merchantRaw
      && amountResolution.kind === 'missing'
    ) continue;
    if (
      amountCell?.fromMerge
      && consumedAmountSources.has(amountCell.sourceKey)
    ) continue;

    const merchant = normalizeRequiredMerchant(merchantRaw);
    if (!merchant) {
      errors.push(new ParseError(REQUIRED_MERCHANT_ERROR_MESSAGE, {
        code: REQUIRED_MERCHANT_ERROR_CODE,
        line: i + 1,
        raw: rowText,
      }));
      continue;
    }
    if (amountResolution.kind === 'non-spending') {
      errors.push(new ParseError(
        nonSpendingAmountMessage(merchant, amountResolution.raw),
        {
          code: NON_SPENDING_AMOUNT_ERROR_CODE,
          line: i + 1,
          raw: rowText,
        },
      ));
      continue;
    }
    if (amountResolution.kind === 'ambiguous') {
      errors.push(new ParseError(AMBIGUOUS_AMOUNT_MESSAGE, {
        code: AMBIGUOUS_AMOUNT_ERROR_CODE,
        line: i + 1,
        raw: rowText,
      }));
      continue;
    }
    const amountRaw = amountResolution.kind === 'spending'
      ? amountResolution.raw
      : '';
    const parsedAmount = parseAmount(amountRaw);
    if (parsedAmount === null) {
      if (String(amountRaw ?? '').trim()) {
        // Detect Excel formula error strings for specific error messages (C73-04)
        if (typeof amountRaw === 'string' && EXCEL_ERROR_PATTERN.test(amountRaw.trim())) {
          errors.push(new ParseError(
            `셀 수식 오류: ${amountRaw.trim()}`,
            { line: i + 1, raw: rowText },
          ));
        } else {
          errors.push(new ParseError(
            `금액을 해석할 수 없습니다: ${String(amountRaw)}`,
            { line: i + 1, raw: rowText },
          ));
        }
      }
      continue;
    }
    const amount = amountResolution.kind === 'spending'
      ? normalizeResolvedSpendingAmount(
          parsedAmount,
          amountResolution.role,
        )
      : parsedAmount;
    // Skip zero- and negative-amount rows (balance inquiries, refunds,
    // credits). These don't contribute to spending optimization.
    // Matches server-side XLSX parser behavior (C8-01).
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
      const alreadyReported = errors.some(
        (e) => e.line === i + 1 && e.message.includes('날짜를 해석할 수 없습니다'),
      );
      if (!alreadyReported) {
        errors.push(new ParseError(
          `날짜를 해석할 수 없습니다: ${String(dateRaw).trim() || '빈 값'}`,
          { line: i + 1, raw: rowText },
        ));
      }
      continue;
    }

    const tx: RawTransaction = {
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
    if (amountCell) consumedAmountSources.add(amountCell.sourceKey);
  }

  return { bank: resolvedBank, format: 'xlsx', transactions, errors };
}
