export interface PDFCellMatch {
  idx: number;
  value: string;
}

export interface PDFRowValues {
  dateIdx: number;
  amountIdx: number;
  dateValue: string;
  amountValue: string;
}

/**
 * Validate preferred header positions against the current row, then read the
 * values from the final indices. Reading before correcting the indices leaves
 * stale date/amount values paired with the corrected merchant range.
 */
export function resolvePDFRowValues(
  row: readonly string[],
  preferred: { dateIdx: number; amountIdx: number } | null,
  findDate: (row: string[]) => PDFCellMatch | null,
  findAmount: (row: string[]) => PDFCellMatch | null,
): PDFRowValues | null {
  const mutableRow = row as string[];
  const actualDate = findDate(mutableRow);
  const actualAmount = findAmount(mutableRow);
  if (!actualDate || !actualAmount) return null;

  const dateIdx = preferred?.dateIdx === actualDate.idx ? preferred.dateIdx : actualDate.idx;
  const amountIdx = preferred?.amountIdx === actualAmount.idx ? preferred.amountIdx : actualAmount.idx;
  if (dateIdx < 0 || amountIdx < 0 || dateIdx >= row.length || amountIdx >= row.length) return null;

  return {
    dateIdx,
    amountIdx,
    dateValue: (row[dateIdx] ?? '').trim(),
    amountValue: (row[amountIdx] ?? '').trim(),
  };
}

export interface PDFAmountToken {
  token: string;
  start: number;
  end: number;
}

/**
 * Return the complete last amount token on a PDF text line. Callers must pass
 * the complete token to parseAmount so accounting parentheses and Korean,
 * full-width, trailing, and currency-prefix minus markers are preserved.
 */
export function findLastPDFAmountToken(line: string): PDFAmountToken | null {
  const pattern = /\([\d,]+\)|[₩￦][\d,]+원?|마이너스[\d,]+원?|－[\d,]+원?|KRW[\d,]+원?|[\d,]*(?:,|\d{5,})[\d,]*-|[\d,]*(?:,|\d{5,})[\d,]*원?/gi;
  const matches = [...line.matchAll(pattern)];
  const match = matches.at(-1);
  if (!match || match.index === undefined) return null;
  return {
    token: match[0],
    start: match.index,
    end: match.index + match[0].length,
  };
}

const STRICT_DATE_PATTERN = /(\d{4})[.\-\/．。](\d{1,2})[.\-\/．。](\d{1,2})/;
const SHORT_YEAR_DATE_PATTERN = /(\d{2})[.\-\/．。](\d{2})[.\-\/．。](\d{2})/;
const KOREAN_FULL_DATE_PATTERN = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const KOREAN_SHORT_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
const SHORT_MD_DATE_PATTERN = /^\d{1,2}[.\-\/．。]\d{1,2}$/;
const FALLBACK_DATE_PATTERN = /(\d{4}[.\-\/．。]\d{1,2}[.\-\/．。]\d{1,2}|\d{2}[.\-\/．。]\d{2}[.\-\/．。]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|\d{1,2}[.\-\/．。]\d{1,2}(?![.\-\/\d．。])|(?<!\d)\d{8}(?!\d)|(?<!\d)\d{6}(?!\d))/;
const STRICT_AMOUNT_PATTERN = /^마이너스[\d,]+\s*원?$|^KRW[\d,]+\s*원?$|^\+[\d,]+\s*원?$|^[₩￦]?[－-]?(?:[\d,]*,|\d{5,})[\d,]*\s*원?$|^\([\d,]+\)$|(?:[\d,]*,|\d{5,})[\d,]*-$/i;

function findPDFDateCell(row: string[]): PDFCellMatch | null {
  for (let idx = 0; idx < row.length; idx++) {
    const cell = (row[idx] ?? '').replace(/[.\-\/．。]\s*$/, '');
    if (
      STRICT_DATE_PATTERN.test(cell)
      || SHORT_YEAR_DATE_PATTERN.test(cell)
      || KOREAN_FULL_DATE_PATTERN.test(cell)
      || KOREAN_SHORT_DATE_PATTERN.test(cell)
      || isValidShortDate(cell)
      || isValidYYYYMMDD(cell)
      || isValidYYMMDD(cell)
    ) {
      return { idx, value: row[idx] ?? '' };
    }
  }
  return null;
}

function findPDFAmountCell(row: string[]): PDFCellMatch | null {
  for (let idx = row.length - 1; idx >= 0; idx--) {
    if (STRICT_AMOUNT_PATTERN.test((row[idx] ?? '').trim())) {
      return { idx, value: row[idx] ?? '' };
    }
  }
  return null;
}

function findMerchant(
  row: string[],
  dateIdx: number,
  amountIdx: number,
  preferredIdx: number,
): { idx: number; value: string } {
  if (preferredIdx >= 0 && preferredIdx < row.length) {
    return {
      idx: preferredIdx,
      value: normalizeRequiredMerchant(row[preferredIdx]),
    };
  }

  const reserved = new Set([dateIdx, amountIdx]);
  let bestIdx = -1;
  let bestLength = 0;
  const low = Math.min(dateIdx, amountIdx) + 1;
  const high = Math.max(dateIdx, amountIdx);

  for (let idx = low; idx < high; idx++) {
    const value = (row[idx] ?? '').trim();
    if (value.length > bestLength) {
      bestIdx = idx;
      bestLength = value.length;
    }
  }

  if (bestIdx === -1) {
    for (let idx = 0; idx < row.length; idx++) {
      if (reserved.has(idx)) continue;
      const value = (row[idx] ?? '').trim();
      if (/[가-힣]/.test(value) && value.length > bestLength) {
        bestIdx = idx;
        bestLength = value.length;
      }
    }
  }

  if (bestIdx === -1) {
    for (let idx = 0; idx < row.length; idx++) {
      if (reserved.has(idx)) continue;
      const value = (row[idx] ?? '').trim();
      if (!/^\d[\d,.\-\/]*$/.test(value) && value.length > bestLength) {
        bestIdx = idx;
        bestLength = value.length;
      }
    }
  }

  return {
    idx: bestIdx,
    value: bestIdx === -1 ? '' : (row[bestIdx] ?? '').trim(),
  };
}

function parseStructuredPDFText(
  text: string,
): { transactions: RawTransaction[]; errors: ParseError[] } {
  const rows = parseTable(text);
  const transactionRows = filterTransactionRows(rows);
  if (transactionRows.length === 0) return { transactions: [], errors: [] };

  const headerIdx = detectHeaderRow(rows);
  const header = headerIdx === -1 ? null : getHeaderColumns(rows[headerIdx]!);
  const transactions: RawTransaction[] = [];
  const errors: ParseError[] = [];
  let requiredMerchantErrorCount = 0;

  for (const [rowIndex, row] of transactionRows.entries()) {
    if (isSummaryRow(row.join(' '))) continue;

    const resolved = resolvePDFRowValues(
      row,
      header ? { dateIdx: header.dateCol, amountIdx: header.amountCol } : null,
      findPDFDateCell,
      findPDFAmountCell,
    );
    if (!resolved || !resolved.dateValue) continue;

    const amount = parseAmount(resolved.amountValue);
    if (amount === null) {
      const cleaned = resolved.amountValue.replace(/원$/, '').replace(/,/g, '').trim();
      if (cleaned && !/^0+$/.test(cleaned)) {
        errors.push(new ParseError(`금액을 해석할 수 없습니다: ${resolved.amountValue}`));
      }
      continue;
    }
    if (amount <= 0) continue;

    const date = parseDateStringToISO(resolved.dateValue);
    if (!isValidISODate(date)) {
      errors.push(new ParseError(`날짜를 해석할 수 없습니다: ${resolved.dateValue}`));
      continue;
    }

    const headerShift = header
      && resolved.dateIdx - header.dateCol === resolved.amountIdx - header.amountCol
      ? resolved.dateIdx - header.dateCol
      : 0;
    const shiftedColumn = (column: number): number => column < 0 ? -1 : column + headerShift;
    const merchant = findMerchant(
      row,
      resolved.dateIdx,
      resolved.amountIdx,
      header ? shiftedColumn(header.merchantCol) : -1,
    );
    const normalizedMerchant = normalizeRequiredMerchant(merchant.value);
    if (!normalizedMerchant) {
      if (requiredMerchantErrorCount < MAX_REQUIRED_FIELD_ROW_ERRORS) {
        errors.push(new ParseError(REQUIRED_MERCHANT_ERROR_MESSAGE, {
          code: REQUIRED_MERCHANT_ERROR_CODE,
          line: rowIndex + 1,
          raw: row.join(' '),
        }));
      }
      requiredMerchantErrorCount++;
      continue;
    }

    const transaction: RawTransaction = {
      date,
      merchant: normalizedMerchant,
      amount,
    };

    if (header) {
      const categoryCol = shiftedColumn(header.categoryCol);
      const memoCol = shiftedColumn(header.memoCol);
      const installmentsCol = shiftedColumn(header.installmentsCol);
      if (categoryCol >= 0 && categoryCol < row.length) {
        const category = (row[categoryCol] ?? '').trim();
        if (category) transaction.category = category;
      }
      if (memoCol >= 0 && memoCol < row.length) {
        const memo = (row[memoCol] ?? '').trim();
        if (memo) transaction.memo = memo;
      }
      if (installmentsCol >= 0 && installmentsCol < row.length) {
        const match = (row[installmentsCol] ?? '').trim().match(/^(\d+)/);
        const installments = match ? Number.parseInt(match[1]!, 10) : 0;
        if (installments > 1) transaction.installments = installments;
      }
    } else {
      for (let idx = 0; idx < row.length; idx++) {
        if (idx === resolved.dateIdx || idx === resolved.amountIdx || idx === merchant.idx) continue;
        const match = (row[idx] ?? '').trim().match(/^(\d+)개?월?$/);
        const installments = match ? Number.parseInt(match[1]!, 10) : 0;
        if (installments > 1) transaction.installments = installments;
      }
    }

    transactions.push(transaction);
  }

  return { transactions, errors };
}

function isValidFallbackDate(token: string): boolean {
  if (SHORT_MD_DATE_PATTERN.test(token)) return isValidShortDate(token);
  if (/^\d{6}$/.test(token)) return isValidYYMMDD(token);
  if (/^\d{8}$/.test(token)) return isValidYYYYMMDD(token);
  return true;
}

function parseFallbackPDFText(
  text: string,
): { transactions: RawTransaction[]; errors: ParseError[] } {
  const transactions: RawTransaction[] = [];
  const errors: ParseError[] = [];
  let requiredMerchantErrorCount = 0;

  for (const [lineIndex, line] of text.split('\n').entries()) {
    const dateMatch = line.match(FALLBACK_DATE_PATTERN);
    if (!dateMatch || !isValidFallbackDate(dateMatch[0])) continue;

    const amountMatch = findLastPDFAmountToken(line);
    if (!amountMatch) continue;

    const dateStart = line.indexOf(dateMatch[0]);
    const dateEnd = dateStart + dateMatch[0].length;
    const between = amountMatch.start > dateEnd
      ? line.slice(dateEnd, amountMatch.start).trim()
      : dateStart > amountMatch.end
        ? line.slice(amountMatch.end, dateStart).trim()
        : '';
    const merchant = normalizeRequiredMerchant(
      between.replace(/\s+/g, ' '),
    );
    if (!merchant) {
      if (requiredMerchantErrorCount < MAX_REQUIRED_FIELD_ROW_ERRORS) {
        errors.push(new ParseError(REQUIRED_MERCHANT_ERROR_MESSAGE, {
          code: REQUIRED_MERCHANT_ERROR_CODE,
          line: lineIndex + 1,
          raw: line,
        }));
      }
      requiredMerchantErrorCount++;
      continue;
    }

    const amount = parseAmount(amountMatch.token);
    if (amount === null) {
      const cleaned = amountMatch.token.replace(/원$/, '').replace(/,/g, '').trim();
      if (cleaned && !/^0+$/.test(cleaned)) {
        errors.push(new ParseError(`금액을 해석할 수 없습니다: ${amountMatch.token}`));
      }
      continue;
    }
    if (amount <= 0) continue;

    const date = parseDateStringToISO(dateMatch[0]);
    if (!isValidISODate(date)) {
      errors.push(new ParseError(`날짜를 해석할 수 없습니다: ${dateMatch[0]}`));
      continue;
    }

    transactions.push({
      date,
      merchant,
      amount,
    });
  }

  return { transactions, errors };
}

/** Parse already-extracted PDF text identically in Node and the browser. */
export function parsePDFText(
  text: string,
): { transactions: RawTransaction[]; errors: ParseError[] } {
  try {
    const structured = parseStructuredPDFText(text);
    if (structured.transactions.length > 0) return structured;
    if (
      structured.errors.some(
        (error) => error.code === REQUIRED_MERCHANT_ERROR_CODE,
      )
    ) {
      return structured;
    }
    const fallback = parseFallbackPDFText(text);
    return {
      transactions: fallback.transactions,
      errors: [...structured.errors, ...fallback.errors],
    };
  } catch {
    return parseFallbackPDFText(text);
  }
}
import type { RawTransaction } from '../types.js';
import { ParseError } from '../types.js';
import {
  isValidISODate,
  isValidShortDate,
  isValidYYMMDD,
  isValidYYYYMMDD,
  parseDateStringToISO,
} from '../date-utils.js';
import { parseAmount } from './amount.js';
import {
  MAX_REQUIRED_FIELD_ROW_ERRORS,
  normalizeRequiredMerchant,
  REQUIRED_MERCHANT_ERROR_CODE,
  REQUIRED_MERCHANT_ERROR_MESSAGE,
} from './required-fields.js';
import {
  detectHeaderRow,
  filterTransactionRows,
  getHeaderColumns,
  parseTable,
} from '../pdf/table-parser.js';
import { isSummaryRow } from '../csv/column-matcher.js';
