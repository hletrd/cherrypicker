/** Configurable CSV adapter factory.
 *  Replaces 10 near-identical bank-specific adapter files with a single
 *  factory function that creates a BankAdapter from a config object (C1-03).
 *  Uses ColumnMatcher for flexible header matching instead of exact indexOf. */

import type { BankAdapter, BankId, ParseResult, RawTransaction } from '../types.js';
import { createParseErrorCollector, ParseError } from '../types.js';
import { detectCSVDelimiter, detectBank } from '../detect.js';
import { parseDateStringToISO, isValidISODate } from '../date-utils.js';
import { splitCSVLine, splitCSVRecords, parseCSVAmount, parseCSVInstallments, isValidCSVAmount } from './shared.js';
import {
  findColumn,
  normalizeHeader,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  isSummaryRow,
  DATE_KEYWORDS,
  MERCHANT_KEYWORDS,
  AMOUNT_KEYWORDS,
  isValidHeaderRow,
} from './column-matcher.js';
import {
  missingRequiredColumnLabels,
  normalizeRequiredMerchant,
  REQUIRED_DATE_ERROR_CODE,
  REQUIRED_DATE_ERROR_MESSAGE,
  REQUIRED_MERCHANT_ERROR_CODE,
  REQUIRED_MERCHANT_ERROR_MESSAGE,
} from '../shared/required-fields.js';
import {
  AMBIGUOUS_AMOUNT_ERROR_CODE,
  AMBIGUOUS_AMOUNT_MESSAGE,
  compileAmountFieldPlan,
  NON_SPENDING_AMOUNT_ERROR_CODE,
  nonSpendingAmountMessage,
  normalizeResolvedSpendingAmount,
  resolveAmountField,
} from '../shared/amount-fields.js';
import { truncateParseDiagnosticRaw } from '../shared/diagnostics.js';

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
      const records = splitCSVRecords(content, delimiter);
      const lines = records.map((record) => record.content);
      const errors = createParseErrorCollector();
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
        return { bank: bankId, format: 'csv', transactions: [], errors: [new ParseError('헤더 행을 찾을 수 없습니다.')] };
      }

      const headers = splitCSVLine(lines[headerIdx] ?? '', delimiter);

      // Use flexible column matching — tries exact name first, then regex
      const dateCol = findColumn(headers, dateHeader, DATE_COLUMN_PATTERN);
      const merchantCol = findColumn(headers, merchantHeader, MERCHANT_COLUMN_PATTERN);
      const amountPlan = compileAmountFieldPlan(headers, amountHeader);
      const installCol = findColumn(headers, installmentsHeader, INSTALLMENTS_COLUMN_PATTERN);
      const categoryCol = findColumn(headers, categoryHeader, CATEGORY_COLUMN_PATTERN);
      const memoCol = findColumn(headers, memoHeader, MEMO_COLUMN_PATTERN);

      // Report when required columns were not found — prevents silent empty
      // results when column detection fails. Parity with web-side
      // createBankAdapter() in apps/web/src/lib/parser/csv.ts and the
      // generic CSV parser in csv/generic.ts (C70-01).
      const missingColumns = missingRequiredColumnLabels({
        date: dateCol,
        merchant: merchantCol,
        amount: amountPlan.candidates[0]?.index ?? -1,
      });
      if (missingColumns.length > 0) {
        return {
          bank: bankId,
          format: 'csv',
          transactions: [],
          errors: [
            new ParseError(`필수 컬럼을 찾을 수 없습니다: ${missingColumns.join(', ')}`),
          ],
        };
      }

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const physicalLine = records[i]?.line ?? i + 1;
        if (!line.trim()) continue;
        if (isSummaryRow(line)) continue;
        const cells = splitCSVLine(line, delimiter);

        const dateRaw = dateCol !== -1 ? (cells[dateCol] ?? '') : '';
        const merchantRaw = merchantCol !== -1 ? (cells[merchantCol] ?? '') : '';
        const amountResolution = resolveAmountField(
          amountPlan,
          (index) => cells[index] ?? '',
        );

        if (
          !dateRaw
          && !merchantRaw
          && amountResolution.kind === 'missing'
        ) continue;

        const rowText = line;
        const merchant = normalizeRequiredMerchant(merchantRaw);
        if (!merchant) {
          errors.push(new ParseError(REQUIRED_MERCHANT_ERROR_MESSAGE, {
            code: REQUIRED_MERCHANT_ERROR_CODE,
            line: physicalLine,
            raw: rowText,
          }));
          continue;
        }
        if (amountResolution.kind === 'non-spending') {
          errors.push(new ParseError(
            nonSpendingAmountMessage(merchant, amountResolution.raw),
            {
              code: NON_SPENDING_AMOUNT_ERROR_CODE,
              line: physicalLine,
              raw: rowText,
            },
          ));
          continue;
        }
        if (amountResolution.kind === 'ambiguous') {
          errors.push(new ParseError(AMBIGUOUS_AMOUNT_MESSAGE, {
            code: AMBIGUOUS_AMOUNT_ERROR_CODE,
            line: physicalLine,
            raw: rowText,
          }));
          continue;
        }
        const amountRaw = amountResolution.kind === 'spending'
          ? String(amountResolution.raw ?? '')
          : '';
        const parsedAmount = parseCSVAmount(amountRaw);
        const amount = parsedAmount !== null
          && amountResolution.kind === 'spending'
          ? normalizeResolvedSpendingAmount(
              parsedAmount,
              amountResolution.role,
            )
          : parsedAmount;
        // Use shared isValidCSVAmount for unified validation — handles null
        // (unparseable), zero (balance inquiries), and negative (refunds)
        // amounts in one call, matching the web-side isValidAmount pattern.
        // Include raw row text for easier debugging, matching XLSX parser error format.
        if (!isValidCSVAmount(amount, amountRaw, physicalLine - 1, errors)) {
          // isValidCSVAmount already pushes the error; enrich the last error with raw text
          if (
            errors.length > 0
            && errors[errors.length - 1]!.line === physicalLine
          ) {
            errors[errors.length - 1]!.raw =
              truncateParseDiagnosticRaw(rowText);
          }
          continue;
        }

        const parsedDate = parseDateStringToISO(dateRaw);
        if (!isValidISODate(parsedDate)) {
          const trimmedDate = dateRaw.trim();
          if (!trimmedDate) {
            errors.push(new ParseError(REQUIRED_DATE_ERROR_MESSAGE, {
              code: REQUIRED_DATE_ERROR_CODE,
              line: physicalLine,
              raw: rowText,
            }));
          } else {
            errors.push(new ParseError(
              `날짜를 해석할 수 없습니다: ${trimmedDate}`,
              { line: physicalLine, raw: rowText },
            ));
          }
          continue;
        }

        const tx: RawTransaction = {
          date: parsedDate,
          merchant,
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

// ---------------------------------------------------------------------------
// Additional bank adapters (14 banks with XLSX configs but previously missing
// from CSV adapter-factory). These use the same column names as the XLSX
// adapter configs in packages/parser/src/xlsx/adapters/index.ts (C37-02).
// ---------------------------------------------------------------------------

export const kakaoAdapter = createBankAdapter({
  bankId: 'kakao',
  headerKeywords: ['거래일시', '이용처', '이용금액'],
  dateHeader: '거래일시',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
});

export const tossAdapter = createBankAdapter({
  bankId: 'toss',
  headerKeywords: ['거래일', '이용처', '이용금액'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
});

export const kbankAdapter = createBankAdapter({
  bankId: 'kbank',
  headerKeywords: ['거래일', '이용처', '거래금액'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '거래금액',
});

export const bnkAdapter = createBankAdapter({
  bankId: 'bnk',
  headerKeywords: ['거래일', '가맹점', '이용금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
});

export const dgbAdapter = createBankAdapter({
  bankId: 'dgb',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

export const suhyupAdapter = createBankAdapter({
  bankId: 'suhyup',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

export const jbAdapter = createBankAdapter({
  bankId: 'jb',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

export const kwangjuAdapter = createBankAdapter({
  bankId: 'kwangju',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

export const jejuAdapter = createBankAdapter({
  bankId: 'jeju',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

export const scAdapter = createBankAdapter({
  bankId: 'sc',
  headerKeywords: ['거래일', '이용처', '이용금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '이용금액',
  installmentsHeader: '할부',
});

export const mgAdapter = createBankAdapter({
  bankId: 'mg',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

export const cuAdapter = createBankAdapter({
  bankId: 'cu',
  headerKeywords: ['거래일', '가맹점', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '가맹점',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

export const kdbAdapter = createBankAdapter({
  bankId: 'kdb',
  headerKeywords: ['거래일', '이용처', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});

export const epostAdapter = createBankAdapter({
  bankId: 'epost',
  headerKeywords: ['거래일', '이용처', '거래금액', '할부'],
  dateHeader: '거래일',
  merchantHeader: '이용처',
  amountHeader: '거래금액',
  installmentsHeader: '할부',
});
