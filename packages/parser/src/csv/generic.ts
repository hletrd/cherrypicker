import type { BankId, ParseResult, RawTransaction } from '../types.js';
import { ParseError } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';
import { parseDateStringToISO, isValidISODate, isValidYYMMDD, isValidYYYYMMDD, isValidShortDate } from '../date-utils.js';
import { splitCSVLine, splitCSVRecords, parseCSVAmount, parseCSVInstallments, isValidCSVAmount } from './shared.js';
import {
  normalizeHeader,
  findColumn,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  isSummaryRow,
  HEADER_KEYWORDS,
  isValidHeaderRow,
} from './column-matcher.js';
import {
  MAX_REQUIRED_FIELD_ROW_ERRORS,
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
  withInferredNeutralAmountField,
} from '../shared/amount-fields.js';

// Korean date patterns — must cover all formats that parseDateStringToISO
// handles. Kept in sync with the web-side DATE_PATTERNS (C1-01).
// Note: the short-date pattern (MM/DD) is NOT included here because it
// matches decimal amounts like "3.5" or "12.34". Short dates are validated
// separately by isDateLikeShort() with month/day range checks (F20-02).
const DATE_PATTERNS = [
  /^\d{4}[\s]*[.\-\/．。][\s]*\d{1,2}[\s]*[.\-\/．。][\s]*\d{1,2}$/,  // 2024-01-15, 2024．01．15 (C22-01)
  /^\d{4}[\s]*[.\-\/．。][\s]*\d{1,2}[\s]*[.\-\/．。][\s]*\d{1,2}[\sT]\d/,  // datetime: 2024-01-15 10:30:00 or 2024-01-15T10:30:00 (C28-01/C70-02)
  /^\d{2}[\s]*[.\-\/．。][\s]*\d{2}[\s]*[.\-\/．。][\s]*\d{2}$/,       // 24-01-15, 24．01．15 (C22-01)
  /^\d{4}\d{2}\d{2}$/,                                           // 20240115
  // YYMMDD (6-digit) is NOT included here because /^\d{6}$/ matches any
  // 6-digit number (transaction IDs, phone suffixes), causing false-positive
  // column detection. Validated separately by isYYMMDDLike() (C45-01).
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/,                          // 2024년 1월 15일
  /^\d{1,2}월\s*\d{1,2}일$/,                                    // 1월 15일
  // YYMMDD is validated by isYYMMDDLike() to prevent false positives on
  // 6-digit transaction IDs (C45-01). Listed here for completeness — the
  // isDateLike() function delegates to isYYMMDDLike() for this pattern.
  /^\d{6}$/,                                                      // 240115 (validated by isYYMMDDLike)
];

// isDateLikeShort delegates to the shared isValidShortDate from date-utils.ts
// to eliminate duplication across CSV, PDF, and PDF table parsers (C97-03).
const isDateLikeShort = isValidShortDate;

// Korean amount patterns — must recognize all formats that parseCSVAmount
// handles, including Won sign prefixes (C7-06).
// C45-02: Patterns require at least one comma (thousand separator) or Won
// sign for short digit sequences to prevent false positives on strings
// like "12-34" (card number fragments) or "1-2" being misidentified as
// amounts during column detection.
const AMOUNT_PATTERNS = [
  /^₩-?[\d,]+\s*원?$/,     // ₩1,234 or ₩1,234원 (Won sign prefix)
  /^￦-?[\d,]+\s*원?$/,     // ￦1,234 (fullwidth Won sign)
  /^\d[\d,]*,\d[\d,]*\s*원?$/, // 1,234 or 1,234,567 — requires comma separator (C60-01)
  /^-[\d,]+\s*원?$/,        // -1,234 or -1,234원 (negative with comma)
  /^－[\d,]+\s*원?$/,       // －1,234 — fullwidth-minus negative (C54-01)
  /^\([\d,]+\)$/,        // Parenthesized negatives: (1,234) → -1234
  /^마이너스[\d,]+\s*원?$/, // 마이너스1,234 — prefix-based negative used by some banks
  /^\d{5,}\s*원?$/,         // Bare 5+ digit integers: 10000 or 10000원 (C65-01)
  /^KRW[\d,]+\s*원?$/i,     // KRW10,000 — ISO 4217 currency prefix (C56-01)
  /^\d[\d,]*-$/,          // Trailing minus: 1,234- (negative amount, C68-01)
  /^\+[\d,]+\s*원?$/,       // Leading plus: +1,234 (positive amount prefix, C71-01)
  /^[０-９][０-９，]*，[０-９][０-９，]*\s*원?$/,  // Full-width comma-separated: １，２３４ (C84-01)
  /^[０-９]{5,}\s*원?$/,     // Bare 5+ digit full-width integers: １２３４５ (C84-01)
];

function isDateLike(value: string): boolean {
  const trimmed = value.trim();
  // Check isYYMMDDLike first for 6-digit strings to prevent DATE_PATTERNS'
  // /^\d{6}$/ from matching without month/day validation (C45-01).
  if (isValidYYMMDD(trimmed)) return true;
  // Validate 8-digit YYYYMMDD strings with month/day range checks to prevent
  // DATE_PATTERNS' /^\d{4}\d{2}\d{2}$/ from matching invalid dates like
  // "99999999" or "20241332" (C93-01). Parity with PDF parsers which
  // already validate via isValidYYYYMMDD() in isValidDateCell().
  if (/^\d{8}$/.test(trimmed)) return isValidYYYYMMDD(trimmed);
  // Strip trailing delimiters before matching — Korean bank exports may
  // append a period or slash to dates (e.g., "2024. 1. 15.") (C57-01).
  const stripped = trimmed.replace(/[.\-\/．。]\s*$/, '');
  return DATE_PATTERNS.some((p) => p.test(stripped)) || isDateLikeShort(trimmed);
}

function isAmountLike(value: string): boolean {
  return AMOUNT_PATTERNS.some((p) => p.test(value.trim()));
}

// Use shared parseDateStringToISO from date-utils.ts for date parsing.
// The local parseDateToISO was removed in favor of the centralized
// implementation to avoid divergence (C35-03).

export function parseGenericCSV(content: string, bank: BankId | null): ParseResult {
  const delimiter = detectCSVDelimiter(content);
  const records = splitCSVRecords(content, delimiter);
  const lines = records.map((record) => record.content);
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  if (lines.length === 0) {
    return { bank, format: 'csv', transactions: [], errors: [new ParseError('빈 파일입니다.')] };
  }

  // Find header row — scan up to 30 rows for Korean bank exports that have
  // long metadata preambles (bank name, statement period, card number).
  // A valid header row must contain at least one known header keyword AND
  // keywords from at least 2 distinct categories (date, merchant, amount)
  // to avoid matching summary rows that only have amount keywords (C1-01).
  // Uses shared isValidHeaderRow from column-matcher (C4-07).
  let headerIdx = -1;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cells = splitCSVLine(lines[i] ?? '', delimiter);
    const hasNonNumeric = cells.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric && isValidHeaderRow(cells.map((c) => c.trim()))) {
      headerIdx = i;
      break;
    }
  }

  // No valid header row found — return error instead of defaulting to row 0
  if (headerIdx === -1) {
    return { bank, format: 'csv', transactions: [], errors: [new ParseError('헤더 행을 찾을 수 없습니다.')] };
  }

  const headers = splitCSVLine(lines[headerIdx] ?? '', delimiter);

  // Identify column roles
  let dateCol = -1;
  let merchantCol = -1;
  let amountPlan = compileAmountFieldPlan(headers);
  let installmentsCol = -1;
  let categoryCol = -1;
  let memoCol = -1;

  // First pass: look for header keywords — use shared findColumn() from
  // ColumnMatcher for consistency with the adapter-factory and XLSX parser.
  // No exactName is available for generic parsing, so pass undefined to skip
  // the exact-match pass and go straight to regex matching.
  dateCol = findColumn(headers, undefined, DATE_COLUMN_PATTERN);
  merchantCol = findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN);
  installmentsCol = findColumn(headers, undefined, INSTALLMENTS_COLUMN_PATTERN);
  categoryCol = findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN);
  memoCol = findColumn(headers, undefined, MEMO_COLUMN_PATTERN);

  // Second pass: infer from data if headers didn't match
  if (
    dateCol === -1
    || merchantCol === -1
    || amountPlan.candidates.length === 0
  ) {
    // Scan 8 rows for data-inference — provides better coverage for files
    // with sparse early data (blank rows, sub-headers, metadata lines)
    // without meaningful performance impact (C54-02).
    const sampleRows = lines.slice(headerIdx + 1, headerIdx + 9);
    for (const row of sampleRows) {
      const cells = splitCSVLine(row, delimiter);
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i] ?? '';
        if (dateCol === -1 && isDateLike(cell)) dateCol = i;
        else if (
          amountPlan.candidates.length === 0
          && isAmountLike(cell)
          && !isDateLike(cell)
        ) {
          amountPlan = withInferredNeutralAmountField(amountPlan, i);
        }
      }
    }
    // Merchant is likely a text-heavy column containing Korean characters.
    // Prefer the first column (not date/amount/installments/category/memo)
    // where sample data contains Korean text (C4-03). This avoids picking
    // numeric columns like installments or card number suffixes.
    if (
      dateCol !== -1
      && amountPlan.candidates.length > 0
      && merchantCol === -1
    ) {
      const reservedCols = new Set([
        dateCol,
        ...amountPlan.candidates.map(({ index }) => index),
        installmentsCol,
        categoryCol,
        memoCol,
      ].filter((column) => column !== -1));
      // Rank candidate columns by Korean character count — the merchant column
      // in Korean bank exports has the highest Korean text density. This avoids
      // misidentifying memo/비고 columns that happen to precede the merchant
      // column when iterating left-to-right (C94-02).
      let bestCol = -1;
      let bestKoreanCount = 0;
      for (let i = 0; i < headers.length; i++) {
        if (!reservedCols.has(i)) {
          let koreanCount = 0;
          for (const row of sampleRows) {
            const cells = splitCSVLine(row, delimiter);
            const cell = cells[i] ?? '';
            for (const ch of cell) {
              if (ch >= '가' && ch <= '힯') koreanCount++;
            }
          }
          if (koreanCount > bestKoreanCount) {
            bestKoreanCount = koreanCount;
            bestCol = i;
          }
        }
      }
      if (bestCol !== -1) {
        merchantCol = bestCol;
      } else {
        // Fallback: pick the first non-reserved column even without Korean
        for (let i = 0; i < headers.length; i++) {
          if (!reservedCols.has(i)) {
            merchantCol = i;
            break;
          }
        }
      }
    }
  }

  // Report when required columns were not found — prevents silent empty results
  // when both header matching and data-inference fail (C65-02).
  const missingColumns = missingRequiredColumnLabels({
    date: dateCol,
    merchant: merchantCol,
    amount: amountPlan.candidates[0]?.index ?? -1,
  });
  if (missingColumns.length > 0) {
    return {
      bank,
      format: 'csv',
      transactions: [],
      errors: [
        new ParseError(`필수 컬럼을 찾을 수 없습니다: ${missingColumns.join(', ')}`),
      ],
    };
  }

  // Parse data rows
  let requiredMerchantErrorCount = 0;
  let requiredDateErrorCount = 0;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const physicalLine = records[i]?.line ?? i + 1;
    if (!line.trim()) continue;

    // Skip summary/total rows
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
      if (requiredMerchantErrorCount < MAX_REQUIRED_FIELD_ROW_ERRORS) {
        errors.push(new ParseError(REQUIRED_MERCHANT_ERROR_MESSAGE, {
          code: REQUIRED_MERCHANT_ERROR_CODE,
          line: physicalLine,
          raw: rowText,
        }));
        requiredMerchantErrorCount++;
      }
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
        errors[errors.length - 1]!.raw = rowText;
      }
      continue;
    }

    const parsedDate = parseDateStringToISO(dateRaw);
    if (!isValidISODate(parsedDate)) {
      const trimmedDate = dateRaw.trim();
      if (!trimmedDate) {
        if (requiredDateErrorCount < MAX_REQUIRED_FIELD_ROW_ERRORS) {
          errors.push(new ParseError(REQUIRED_DATE_ERROR_MESSAGE, {
            code: REQUIRED_DATE_ERROR_CODE,
            line: physicalLine,
            raw: rowText,
          }));
          requiredDateErrorCount++;
        }
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

    if (installmentsCol !== -1 && cells[installmentsCol]) {
      const inst = parseCSVInstallments(cells[installmentsCol]);
      if (inst !== undefined) tx.installments = inst;
    }

    if (categoryCol !== -1 && cells[categoryCol]) {
      tx.category = cells[categoryCol];
    }

    if (memoCol !== -1 && cells[memoCol]) {
      tx.memo = cells[memoCol];
    }

    transactions.push(tx);
  }

  return { bank, format: 'csv', transactions, errors };
}
