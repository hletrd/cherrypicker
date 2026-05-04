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
  return h.replace(/[​‌‍­ 　\t\n\r‎‏‪‫‬‭‮﻿︀︁︂︃︄︅︆︇︈︉︊︋︌︍︎️⁠]/g, '').trim().replace(/\s+/g, '').replace(/\([^)]*\)/g, '');
}

/** Find a column index by exact name (normalized) first, then by regex pattern.
 *  Returns -1 if no match is found.
 *
 *  Handles combined/delimited column headers like "이용일/승인일" or
 *  "이용금액/취소금액" by splitting on "/" and testing each part individually
 *  before testing the full header (C33-04). This is common in Korean bank
 *  exports that merge related columns into a single header cell.
 *
 *  @param headers - Array of header strings from the CSV file
 *  @param exactName - Exact column name to match (e.g., '이용일')
 *  @param pattern - Regex pattern for fuzzy matching (e.g., /이용일|거래일|날짜/)
 */
export function findColumn(headers: string[], exactName: string | undefined, pattern: RegExp): number {
  // First pass: exact match (normalized). Also handles combined/delimited
  // column headers like "이용일/승인일" by splitting on "/" and testing each
  // part against the exactName (C43-01). This makes the exact-match path
  // consistent with the regex path which already splits on "/".
  if (exactName) {
    const normalizedExact = normalizeHeader(exactName);
    for (let i = 0; i < headers.length; i++) {
      const normalized = normalizeHeader(headers[i] ?? '');
      if (normalized === normalizedExact) return i;
      // Split combined headers on "/" and test each part (C43-01)
      if (normalized.includes('/')) {
        if (normalized.split('/').some((part) => part === normalizedExact)) return i;
      }
    }
  }
  // Second pass: regex match on normalized headers, with combined-header
  // splitting for headers like "이용일/승인일" (C33-04).
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i] ?? '');
    if (pattern.test(normalized)) return i;
    // Split combined headers on "/" and test each part
    if (normalized.includes('/')) {
      const parts = normalized.split('/');
      if (parts.some((part) => pattern.test(part))) return i;
    }
  }
  return -1;
}

// Reusable column pattern constants — shared across all bank adapters.
// These match the patterns used in the XLSX parser's findCol() function
// and the web-side generic CSV parser.

// Column patterns include English alternatives for user-reformatted CSVs
// and international card companies (C7-07). English terms use word-boundary
// or case-insensitive matching to avoid false positives on Korean text.
export const DATE_COLUMN_PATTERN = /이용일|이용일자|거래일|거래일시|날짜|일시|결제일|승인일|승인일자|승인일시|매출일|작성일|접수일|발행일|^date$|^trans(?:action)?[\s_-]?date$|^posted$|^billing$/i;
export const MERCHANT_COLUMN_PATTERN = /이용처|가맹점|가맹점명|이용가맹점|승인가맹점|거래처|매출처|사용처|결제처|상호|판매처|구매처|매장|취급처|이용내용|거래내용|^merchant$|^store$|^shop$|^vendor$|^description$|^item$|^name$|^가게/i;
export const AMOUNT_COLUMN_PATTERN = /이용금액|거래금액|금액|결제금액|승인금액|매출금액|이용액|취소금액|환불금액|입금액|결제액|청구금액|출금액|결제대금|승인취소금액|^amount$|^total$|^price$|^won$|^charge$|^payment$/i;
export const INSTALLMENTS_COLUMN_PATTERN = /할부|할부개월|할부기간|할부월|할부개월수|할부횟수|^installments?$/i;
export const CATEGORY_COLUMN_PATTERN = /업종|카테고리|분류|업종분류|업종명|거래유형|결제유형|이용구분|구분|가맹점유형|^category$|^type$/i;
export const MEMO_COLUMN_PATTERN = /비고|적요|메모|내용|설명|참고|^memo$|^note$|^remarks?$/i;

// Summary/total row pattern — shared across all parsers (server CSV, server XLSX,
// server PDF, web CSV, web XLSX, web PDF). Matches Korean bank statement footer
// rows like "총 합계", "누계", "잔액" that should be skipped during parsing.
// Includes English equivalents for international exports.
//
// Boundary constraints prevent false positives on merchant names containing
// summary keywords (e.g., "합계마트"). Korean keywords use (?<![가-힣]) lookbehind
// to require start-of-string or non-Korean prefix, and (?:[\s,;]|$) lookahead
// to require whitespace/delimiter/end after the keyword — so "합계" at a line
// start or after a space matches, but "합계" inside "합계마트" does not.
// "소비" and "이월" removed — overly broad terms that match plausible merchant
// names like "소비마트". English keywords use \b word boundaries (C30-01).
export const SUMMARY_ROW_PATTERN = /총\s*합\s*계(?![가-힣])(?=[\s,;]|$)|(?<![가-힣])합\s*계(?![가-힣])(?=[\s,;]|$)|(?<![가-힣])소\s*계(?![가-힣])|(?<![가-힣])총\s*계(?![가-힣])|(?<![가-힣])누\s*계(?![가-힣])|(?<![가-힣])잔액(?![가-힣])|(?<![가-힣])당월(?![가-힣])|(?<![가-힣])명세(?![가-힣])|승인\s*합계|결제\s*합계|총\s*(?:사용|이용)|\btotal\b|\bsum\b/i;

// Header keyword vocabulary — shared across all parsers (server CSV, server XLSX,
// web CSV, web XLSX). Used to validate that a candidate header row actually
// contains column names rather than metadata text. Includes English equivalents
// for user-reformatted CSVs and international exports (C7-07).
export const HEADER_KEYWORDS: readonly string[] = [
  '이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '승인일자', '승인일시', '매출일', '작성일', '접수일', '발행일',
  '이용처', '가맹점', '가맹점명', '이용가맹점', '승인가맹점', '거래처', '매출처', '사용처', '결제처', '상호', '판매처', '구매처', '매장', '취급처', '이용내용', '거래내용',
  '이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액', '취소금액', '환불금액', '입금액', '결제액', '청구금액', '출금액', '결제대금', '승인취소금액',
  'date', 'merchant', 'amount', 'total', 'store', 'shop', 'price', 'won', 'description', 'vendor', 'item', 'name', 'charge', 'payment', 'posted', 'billing',
];

// Keyword category Sets for multi-category header detection. A valid header
// row must contain keywords from at least 2 distinct categories to avoid
// matching summary rows that only have amount keywords.
export const DATE_KEYWORDS: ReadonlySet<string> = new Set(['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '승인일자', '승인일시', '매출일', '작성일', '접수일', '발행일', 'date', 'posted', 'billing']);
export const MERCHANT_KEYWORDS: ReadonlySet<string> = new Set(['이용처', '가맹점', '가맹점명', '이용가맹점', '승인가맹점', '거래처', '매출처', '사용처', '결제처', '상호', '판매처', '구매처', '매장', '취급처', '이용내용', '거래내용', 'merchant', 'store', 'shop', 'description', 'vendor', 'item', 'name']);
export const AMOUNT_KEYWORDS: ReadonlySet<string> = new Set(['이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액', '취소금액', '환불금액', '입금액', '결제액', '청구금액', '출금액', '결제대금', '승인취소금액', 'amount', 'total', 'price', 'won', 'charge', 'payment']);

/** Check whether a row of trimmed cell values looks like a valid header row
 *  by requiring keywords from at least 2 distinct categories. Normalizes
 *  each cell before matching so that parenthetical suffixes like "이용금액(원)"
 *  and extra whitespace like "이용 금액" are tolerated (C6-01). English
 *  keywords are matched case-insensitively via toLowerCase() (C7-07).
 *
 *  Handles combined/delimited column headers like "이용일/승인일" by splitting
 *  on "/" and testing each part against keywords (C33-04). */
export function isValidHeaderRow(cells: string[]): boolean {
  // Split combined headers (e.g., "이용일/승인일") into individual terms
  // before keyword matching (C33-04).
  const terms: string[] = [];
  for (const c of cells) {
    const normalized = normalizeHeader(c).toLowerCase();
    terms.push(normalized);
    if (normalized.includes('/')) {
      terms.push(...normalized.split('/'));
    }
  }
  const hasHeaderKeyword = terms.some((c) => (HEADER_KEYWORDS as string[]).includes(c));
  if (!hasHeaderKeyword) return false;
  const matchedCategories = [DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS]
    .filter(catSet => terms.some((c) => catSet.has(c)))
    .length;
  return matchedCategories >= 2;
}