/** Configurable CSV adapter factory.
 *  Replaces 10 near-identical bank-specific adapter files with a single
 *  factory function that creates a BankAdapter from a config object (C1-03).
 *  Uses ColumnMatcher for flexible header matching instead of exact indexOf. */

import type { BankAdapter, BankId, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';
import { detectBank } from '../detect.js';
import { parseDateStringToISO, isValidISODate } from '../date-utils.js';
import { splitCSVLine, parseCSVAmount, parseCSVInstallments } from './shared.js';
import {
  findColumn,
  normalizeHeader,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  DATE_KEYWORDS,
  MERCHANT_KEYWORDS,
  AMOUNT_KEYWORDS,
  isValidHeaderRow,
} from './column-matcher.js';

export interface BankCSVConfig {
  bankId: BankId;
  /** Exact header names used for header row detection. At least one must
   *  match for a row to be identified as the header row. */
  headerKeywords: string[];
  /** Column name for the date field (exact match, tried before regex). */
  dateHeader?: string;
  /** Column name for the merchant field (exact match, tried before regex). */
  merchantHeader?: string;
  /** Column name for the amount field (exact match, tried before regex). */
  amountHeader?: string;
  /** Column name for installments (exact match, tried before regex). */
  installmentsHeader?: string;
  /** Column name for category (exact match, tried before regex). */
  categoryHeader?: string;
  /** Column name for memo (exact match, tried before regex). */
  memoHeader?: string;
  /** Maximum rows to scan for the header. Defaults to 30. */
  maxHeaderScan?: number;
}

/**
 * Create a BankAdapter from a configuration object.
 * Uses flexible column matching (exact name + regex fallback) so that
 * slight column name variations are tolerated.
 */
export function createBankAdapter(config: BankCSVConfig): BankAdapter {
  const {
    bankId,
    headerKeywords,
    dateHeader,
    merchantHeader,
    amountHeader,
    installmentsHeader,
    categoryHeader,
    memoHeader,
    maxHeaderScan = 30,
  } = config;

  // Pre-normalize headerKeywords for defensive matching — ensures comparison
  // works even if bank config keywords contain non-normalized forms (C16-04).
  const normalizedKeywords = headerKeywords.map((k) => normalizeHeader(k));

  return {
    bankId,

    detect(content: string): boolean {
      const { bank } = detectBank(content);
      return bank === bankId;
    },

    parseCSV(content: string): ParseResult {
      const delimiter = detectCSVDelimiter(content);
      const lines = content.split('\n').filter((l) => l.trim());
      const errors: ParseError[] = [];
      const transactions: RawTransaction[] = [];

      // Find header row — scan up to maxHeaderScan rows, looking for a row
      // that contains at least one of the bank's expected header keywords
      // AND keywords from at least 2 distinct categories (date, merchant,
      // amount) to avoid matching summary rows. Uses shared isValidHeaderRow
      // from column-matcher (C4-07). Normalize cell content before keyword
      // comparison to handle zero-width spaces and parenthetical suffixes
      // (C15-02). Both sides of the comparison are normalized (C16-04).
      let headerIdx = -1;
      for (let i = 0; i < Math.min(maxHeaderScan, lines.length); i++) {
        const cells = splitCSVLine(lines[i] ?? '', delimiter);
        const normalizedCells = cells.map((c) => normalizeHeader(c));
        if (normalizedCells.some((c) => normalizedKeywords.includes(c))) {
          if (isValidHeaderRow(cells.map((c) => c.trim()))) {
            headerIdx = i;
            break;
          }
        }
      }
      if (headerIdx === -1) {
        return { bank: bankId, format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
      }

      const headers = splitCSVLine(lines[headerIdx] ?? '', delimiter);

      // Use flexible column matching — tries exact name first, then regex
      const dateCol = findColumn(headers, dateHeader, DATE_COLUMN_PATTERN);
      const merchantCol = findColumn(headers, merchantHeader, MERCHANT_COLUMN_PATTERN);
      const amountCol = findColumn(headers, amountHeader, AMOUNT_COLUMN_PATTERN);
      const installCol = findColumn(headers, installmentsHeader, INSTALLMENTS_COLUMN_PATTERN);
      const categoryCol = findColumn(headers, categoryHeader, CATEGORY_COLUMN_PATTERN);
      const memoCol = findColumn(headers, memoHeader, MEMO_COLUMN_PATTERN);

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (!line.trim()) continue;
        if (/총\s*합계|합\s*계|총\s*계|소\s*계|합계|총계|소계|누계|잔액|이월|소비|당월|명세|total|sum/i.test(line)) continue;
        const cells = splitCSVLine(line, delimiter);

        const dateRaw = dateCol !== -1 ? (cells[dateCol] ?? '') : '';
        const merchantRaw = merchantCol !== -1 ? (cells[merchantCol] ?? '') : '';
        const amountRaw = amountCol !== -1 ? (cells[amountCol] ?? '') : '';

        if (!dateRaw && !merchantRaw) continue;

        const amount = parseCSVAmount(amountRaw);
        if (amount === null) {
          if (amountRaw.trim()) {
            errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}`, raw: line });
          }
          continue;
        }
        if (amount <= 0) continue;

        const parsedDate = parseDateStringToISO(dateRaw);
        // Report unparseable dates as parse errors so users can see which
        // transactions have malformed dates, matching the generic CSV parser
        // behavior in csv/generic.ts (C12-01/C12-06).
        if (!isValidISODate(parsedDate) && dateRaw.trim()) {
          errors.push({ line: i + 1, message: `날짜를 해석할 수 없습니다: ${dateRaw.trim()}` });
        }

        const tx: RawTransaction = {
          date: parsedDate,
          merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
          amount,
        };

        if (installCol !== -1 && cells[installCol]) {
          const inst = parseCSVInstallments(cells[installCol]);
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

// ---------------------------------------------------------------------------
// Bank adapter configs — each bank is now just a thin config object
// ---------------------------------------------------------------------------

export const hyundaiAdapter = createBankAdapter({
  bankId: 'hyundai',
  headerKeywords: ['이용일', '이용처', '이용금액', '할부', '비고'],
  dateHeader: '이용일',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
  memoHeader: '비고',
});

export const kbAdapter = createBankAdapter({
  bankId: 'kb',
  headerKeywords: ['거래일시', '가맹점명', '이용금액', '할부개월', '업종'],
  dateHeader: '거래일시',
  merchantHeader: '가맹점명',
  amountHeader: '이용금액',
  installmentsHeader: '할부개월',
  categoryHeader: '업종',
});

export const ibkAdapter = createBankAdapter({
  bankId: 'ibk',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부', '적요'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
  memoHeader: '적요',
});

export const wooriAdapter = createBankAdapter({
  bankId: 'woori',
  headerKeywords: ['이용일자', '이용가맹점', '이용금액', '할부기간', '비고'],
  dateHeader: '이용일자',
  merchantHeader: '이용가맹점',
  amountHeader: '이용금액',
  installmentsHeader: '할부기간',
  memoHeader: '비고',
});

export const samsungAdapter = createBankAdapter({
  bankId: 'samsung',
  headerKeywords: ['이용일', '가맹점명', '이용금액', '할부', '업종'],
  dateHeader: '이용일',
  merchantHeader: '가맹점명',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
  categoryHeader: '업종',
});

export const shinhanAdapter = createBankAdapter({
  bankId: 'shinhan',
  headerKeywords: ['이용일', '이용처', '이용금액', '할부개월수', '업종분류'],
  dateHeader: '이용일',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
  installmentsHeader: '할부개월수',
  categoryHeader: '업종분류',
});

export const lotteAdapter = createBankAdapter({
  bankId: 'lotte',
  headerKeywords: ['거래일', '이용가맹점', '이용금액', '할부', '업종'],
  dateHeader: '거래일',
  merchantHeader: '이용가맹점',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
  categoryHeader: '업종',
});

export const hanaAdapter = createBankAdapter({
  bankId: 'hana',
  headerKeywords: ['이용일자', '가맹점명', '이용금액', '할부개월', '적요'],
  dateHeader: '이용일자',
  merchantHeader: '가맹점명',
  amountHeader: '이용금액',
  installmentsHeader: '할부개월',
  memoHeader: '적요',
});

export const nhAdapter = createBankAdapter({
  bankId: 'nh',
  headerKeywords: ['거래일', '이용처', '거래금액', '할부', '비고'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
  memoHeader: '비고',
});

export const bcAdapter = createBankAdapter({
  bankId: 'bc',
  headerKeywords: ['이용일', '가맹점', '이용금액', '할부', '업종'],
  dateHeader: '이용일',
  merchantHeader: '가맹점',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
  categoryHeader: '업종',
});