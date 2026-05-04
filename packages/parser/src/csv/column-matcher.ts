/** Flexible column matcher for CSV parsers.
 *  Provides header normalization and regex-based column detection so that
 *  bank adapters tolerate column name variations (trailing spaces, synonyms,
 *  slight formatting differences) instead of requiring exact indexOf matches
 *  (C1-02). */

/** Normalize a header string for matching: strip invisible Unicode characters
 *  (zero-width spaces U+200B, zero-width non-joiners U+200C, zero-width
 *  joiners U+200D, soft hyphens U+00AD), trim whitespace, collapse internal
 *  whitespace, and remove parenthetical suffixes like "이용금액(원)" (C11-03). */
export function normalizeHeader(h: string): string {
  return h.replace(/[​‌‍­　\t\n\r]/g, '').trim().replace(/\s+/g, '').replace(/\([^)]*\)/g, '');
}

/** Find a column index by exact name (normalized) first, then by regex pattern.
 *  Returns -1 if no match is found.
 *
 *  @param headers - Array of header strings from the CSV file
 *  @param exactName - Exact column name to match (e.g., '이용일')
 *  @param pattern - Regex pattern for fuzzy matching (e.g., /이용일|거래일|날짜/)
 */
export function findColumn(headers: string[], exactName: string | undefined, pattern: RegExp): number {
  // First pass: exact match (normalized)
  if (exactName) {
    const normalizedExact = normalizeHeader(exactName);
    for (let i = 0; i < headers.length; i++) {
      if (normalizeHeader(headers[i] ?? '') === normalizedExact) return i;
    }
  }
  // Second pass: regex match on normalized headers
  for (let i = 0; i < headers.length; i++) {
    if (pattern.test(normalizeHeader(headers[i] ?? ''))) return i;
  }
  return -1;
}

// Reusable column pattern constants — shared across all bank adapters.
// These match the patterns used in the XLSX parser's findCol() function
// and the web-side generic CSV parser.

// Column patterns include English alternatives for user-reformatted CSVs
// and international card companies (C7-07). English terms use word-boundary
// or case-insensitive matching to avoid false positives on Korean text.
export const DATE_COLUMN_PATTERN = /이용일|이용일자|거래일|거래일시|날짜|일시|결제일|승인일|승인일자|매출일|^date$|^trans(?:action)?[\s_-]?date$/i;
export const MERCHANT_COLUMN_PATTERN = /이용처|가맹점|가맹점명|이용가맹점|거래처|매출처|사용처|결제처|상호|^merchant$|^store$|^shop$|^description$|^가게/i;
export const AMOUNT_COLUMN_PATTERN = /이용금액|거래금액|금액|결제금액|승인금액|매출금액|이용액|^amount$|^total$|^price$|^won$/i;
export const INSTALLMENTS_COLUMN_PATTERN = /할부|할부개월|할부기간|할부월|할부개월수|^installments?$/i;
export const CATEGORY_COLUMN_PATTERN = /업종|카테고리|분류|업종분류|업종명|^category$|^type$/i;
export const MEMO_COLUMN_PATTERN = /비고|적요|메모|내용|설명|참고|^memo$|^note$|^remarks?$/i;

// Header keyword vocabulary — shared across all parsers (server CSV, server XLSX,
// web CSV, web XLSX). Used to validate that a candidate header row actually
// contains column names rather than metadata text. Includes English equivalents
// for user-reformatted CSVs and international exports (C7-07).
export const HEADER_KEYWORDS: readonly string[] = [
  '이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '승인일자', '매출일',
  '이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호',
  '이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액',
  'date', 'merchant', 'amount', 'total', 'store', 'description',
];

// Keyword category Sets for multi-category header detection. A valid header
// row must contain keywords from at least 2 distinct categories to avoid
// matching summary rows that only have amount keywords.
export const DATE_KEYWORDS: ReadonlySet<string> = new Set(['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '승인일자', '매출일', 'date']);
export const MERCHANT_KEYWORDS: ReadonlySet<string> = new Set(['이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호', 'merchant', 'store', 'description']);
export const AMOUNT_KEYWORDS: ReadonlySet<string> = new Set(['이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액', 'amount', 'total']);

/** Check whether a row of trimmed cell values looks like a valid header row
 *  by requiring keywords from at least 2 distinct categories. Normalizes
 *  each cell before matching so that parenthetical suffixes like "이용금액(원)"
 *  and extra whitespace like "이용 금액" are tolerated (C6-01). English
 *  keywords are matched case-insensitively via toLowerCase() (C7-07). */
export function isValidHeaderRow(cells: string[]): boolean {
  const normalized = cells.map((c) => normalizeHeader(c).toLowerCase());
  const hasHeaderKeyword = normalized.some((c) => (HEADER_KEYWORDS as string[]).includes(c));
  if (!hasHeaderKeyword) return false;
  const matchedCategories = [DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS]
    .filter(catSet => normalized.some((c) => catSet.has(c)))
    .length;
  return matchedCategories >= 2;
}