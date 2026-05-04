/** Flexible column matcher for CSV parsers.
 *  Provides header normalization and regex-based column detection so that
 *  bank adapters tolerate column name variations (trailing spaces, synonyms,
 *  slight formatting differences) instead of requiring exact indexOf matches
 *  (C1-02). */

/** Normalize a header string for matching: trim whitespace, collapse
 *  internal whitespace, remove parenthetical suffixes like "이용금액(원)". */
export function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, '').replace(/\([^)]*\)/g, '');
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

export const DATE_COLUMN_PATTERN = /이용일|이용일자|거래일|거래일시|날짜|일시|결제일|승인일|승인일자|매출일/;
export const MERCHANT_COLUMN_PATTERN = /이용처|가맹점|가맹점명|이용가맹점|거래처|매출처|사용처|결제처|상호/;
export const AMOUNT_COLUMN_PATTERN = /이용금액|거래금액|금액|결제금액|승인금액|매출금액|이용액/;
export const INSTALLMENTS_COLUMN_PATTERN = /할부|할부개월|할부기간|할부월|할부개월수/;
export const CATEGORY_COLUMN_PATTERN = /업종|카테고리|분류|업종분류|업종명/;
export const MEMO_COLUMN_PATTERN = /비고|적요|메모|내용|설명|참고/;