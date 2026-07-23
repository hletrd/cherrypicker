import * as XLSX from 'xlsx';
import type { BankId, ParseResult, RawTransaction } from './types.js';
import { ParseError } from './types.js';
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
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  isSummaryRow,
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
 *  Decodes the first 512 bytes as UTF-8 and checks for HTML signatures.
 *  Korean card companies often export HTML tables with .xls extension.
 *
 *  Known limitation: the full buffer is decoded again in the caller when
 *  HTML is detected. TextDecoder doesn't support partial streaming in all
 *  browsers, so the 512-byte overlap is accepted as minor overhead bounded
 *  by the file size limit (C75-01/C74-03). */
export function isHTMLContent(buffer: ArrayBuffer): boolean {
  // Decode first 512 bytes as UTF-8. Strip UTF-8 BOM (0xEF 0xBB 0xBF) if
  // present — some Korean card exports include a BOM, which would otherwise
  // prevent the startsWith checks from matching.
  // Known limitation: files encoded in EUC-KR (rare for .xls exports from
  // Korean card companies, which typically use UTF-8) will not be detected.
  const raw = new TextDecoder('utf-8').decode(buffer.slice(0, 512));
  const head = raw.replace(/^\uFEFF/, '').trimStart().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
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
  const amountCol = findColumn(headers, config?.amount, AMOUNT_COLUMN_PATTERN);
  const installCol = findColumn(headers, config?.installments, INSTALLMENTS_COLUMN_PATTERN);
  const categoryCol = findColumn(headers, config?.category, CATEGORY_COLUMN_PATTERN);
  const memoCol = findColumn(headers, config?.memo, MEMO_COLUMN_PATTERN);

  if (dateCol === -1 || amountCol === -1) {
    const missing: string[] = [];
    if (dateCol === -1) missing.push('날짜');
    if (amountCol === -1) missing.push('금액');
    return {
      bank: resolvedBank,
      format: 'xlsx',
      transactions: [],
      errors: [new ParseError(`필수 컬럼을 찾을 수 없습니다: ${missing.join(', ')}`)],
    };
  }

  const transactions: RawTransaction[] = [];
  const errors: ParseError[] = [];

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
    const amountCell = resolveSheetCell(rows, i, amountCol, mergeIndex);

    const dateRaw = dateCell.value;
    const merchantRaw = merchantCell?.value ?? '';
    const categoryRaw = categoryCell?.value ?? '';
    const installRaw = installCell?.value ?? '';
    const memoRaw = memoCell?.value ?? '';
    const amountRaw = amountCell.value;

    if (!dateRaw && !merchantRaw) continue;
    if (amountCell.fromMerge && consumedAmountSources.has(amountCell.sourceKey)) continue;

    const amount = parseAmount(amountRaw);
    if (amount === null) {
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
    // Skip zero- and negative-amount rows (balance inquiries, refunds,
    // credits). These don't contribute to spending optimization.
    // Matches server-side XLSX parser behavior (C8-01).
    if (amount <= 0) {
      errors.push(new ParseError(
        `지출로 처리되지 않는 금액입니다: ${String(merchantRaw ?? '').trim() || '알 수 없는 거래'} ${amount}원`,
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
    consumedAmountSources.add(amountCell.sourceKey);
  }

  return { bank: resolvedBank, format: 'xlsx', transactions, errors };
}
