/** Flexible column matcher for CSV/XLSX parsers (browser-side).
 *  Mirror of packages/parser/src/csv/column-matcher.ts — provides header
 *  normalization and regex-based column detection so that parsers tolerate
 *  column name variations (trailing spaces, synonyms, slight formatting
 *  differences) instead of requiring exact indexOf matches.
 *
 *  This file is maintained separately from the server-side copy because the
 *  web app cannot import from packages/parser (different build systems).
 *  Keep patterns in sync with the server-side column-matcher.ts. */

/** Normalize a header string for matching: strip invisible Unicode characters
 *  (zero-width spaces U+200B, zero-width non-joiners U+200C, zero-width
 *  joiners U+200D, soft hyphens U+00AD), trim whitespace, collapse internal
 *  whitespace, underscores, and hyphens, and remove parenthetical suffixes
 *  like "이용금액(원)" (C11-03). This ensures that English header variants
 *  like "Transaction Date", "transaction_date", and "transaction-date" all
 *  normalize to "transactiondate" for consistent keyword matching (C77-01). */
export function normalizeHeader(h: string): string {
  return h.replace(/[​‌‍­ 　\t\n\r‎‏‪‫‬‭‮﻿︀︁︂︃︄︅︆︇︈︉︊︋︌︍︎️⁠]/g, '')
    // Fullwidth alphanumeric → ASCII (U+FF01-U+FF5E map to U+0021-U+007E).
    // East Asian bank exports may use fullwidth letters/digits in headers
    // (e.g., "Ｄａｔｅ", "Ａｍｏｕｎｔ") that must match ASCII keywords (C80-01).
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .trim().replace(/[\s_\-]+/g, '').replace(/\([^)]*\)/g, '');
}

/** Find a column index by exact name (normalized) first, then by regex pattern.
 *  Returns -1 if no match is found.
 *
 *  Handles combined/delimited column headers like "이용일/승인일" or
 *  "이용금액/취소금액" by splitting on "/" and testing each part individually
 *  before testing the full header (C33-04). */
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
      // Split combined headers on "/", "|", ",", or "+" and test each part (C43-01/C51-01/C52-01)
      if (/[/|,+＋]/.test(normalized)) {
        if (normalized.split(/[/|,+＋]/).some((part) => part === normalizedExact)) return i;
      }
    }
  }
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i] ?? '');
    if (pattern.test(normalized)) return i;
    // Split combined headers on "/", "|", ",", or "+" and test each part (C33-04/C51-01/C52-01)
    if (/[/|,+＋]/.test(normalized)) {
      const parts = normalized.split(/[/|,+＋]/);
      if (parts.some((part) => pattern.test(part))) return i;
    }
  }
  return -1;
}

// Reusable column pattern constants — must stay in sync with
// packages/parser/src/csv/column-matcher.ts.

// Column patterns include English alternatives for user-reformatted CSVs
// and international card companies (C7-07). Must stay in sync with
// packages/parser/src/csv/column-matcher.ts.
export const DATE_COLUMN_PATTERN = /이용일|이용일자|거래일|거래일시|날짜|일시|결제일|결제일시|승인일|승인일자|승인일시|승인완료|매출일|작성일|접수일|발행일|사용일|사용일자|조회일|조회시간|처리일|처리일시|승인완료일|입금일|주문일|주문시간|결제예정일|작성일시|승인시간|매입일|전표일|이용시간|취소일|취소승인일|정산일|환불일|반품일|교환일|^date$|^trans(?:action)?[\s_-]?date$|^purchase[\s_-]?date$|^order[\s_-]?date$|^posted$|^billing$|^book(?:ing)?[\s_-]?date$|^cancel[\s_-]?date$|^refund[\s_-]?date$|^settlement[\s_-]?date$|^statement[\s_-]?date$|^payment[\s_-]?date$|^invoice[\s_-]?date$|^timestamp$|^txn[\s_-]?d(?:ate|t)$|^trans(?:action)?[\s_-]?d(?:ate|t)$|^purchase[\s_-]?d(?:ate|t)$/i;
export const MERCHANT_COLUMN_PATTERN = /이용처|가맹점|가맹점명|이용가맹점|승인가맹점|거래처|매출처|사용처|결제처|상호|판매처|구매처|매장|취급처|이용내용|거래내용|이용업소|승인점|매장명|이용매장|상호명|업체명|판매자|가맹점상호|거래내역|이용가맹점명|상점|판매점|이용매장명|구매내용|취소가맹점|^merchant$|^store$|^shop$|^vendor$|^description$|^desc$|^item$|^name$|^payee$|^seller$|^company$|^business$|^가게$|^recipient$|^outlet$|^supplier$|^brand$|^location$|^details$|^reference$|^transaction$/i;
export const AMOUNT_COLUMN_PATTERN = /이용금액|거래금액|금액|결제금액|승인금액|승인액|매출금액|이용액|취소금액|환불금액|입금액|결제액|청구금액|청구액|출금액|결제대금|승인취소금액|매입금액|실청구금액|실결제금액|실결제액|결제예정금액|사용금액|사용액|환급금액|입금금액|실입금액|이용대금|할인금액|포인트할인|할인전금액|할인후금액|^amount$|^amt$|^total$|^price$|^won$|^charge$|^payment$|^total[\s_-]?amount$|^transaction[\s_-]?amount$|^payment[\s_-]?amount$|^billed[\s_-]?amount$|^paid$|^spent$|^cost$|^value$|^debit$|^credit$|^net$|^net[\s_-]?amount$|^gross$/i;
export const INSTALLMENTS_COLUMN_PATTERN = /할부|할부개월|할부기간|할부월|할부개월수|할부횟수|할부회수|할부회차|^installments?$|^install$/i;
export const CATEGORY_COLUMN_PATTERN = /업종|카테고리|분류|업종분류|업종명|거래유형|결제유형|결제구분|이용구분|구분|가맹점유형|매장유형|카드종류|카드구분|결제수단|결제방법|^category$|^type$|^payment[\s_-]?(?:type|method)$/i;
export const MEMO_COLUMN_PATTERN = /비고|적요|메모|내용|설명|참고|참고사항|상세내역|비고란|메모란|상세|비고내용|비고내역|메모내용|메모사항|승인번호|카드번호|승인내역|비고사항|카드명|이용카드|기타|^memo$|^note$|^remarks?$|^desc$|^txn$|^approval[\s_-]?(?:no|num|number)$|^details$|^reference$/i;

// Summary/total row pattern — shared across all parsers. Matches Korean bank
// statement footer rows like "총 합계", "누계", "잔액" that should be skipped.
// Must stay in sync with packages/parser/src/csv/column-matcher.ts.
// Boundary constraints prevent false positives on merchant names containing
// summary keywords (e.g., "합계마트"). See C30-01 for details.
export const SUMMARY_ROW_PATTERN = /총\s*합\s*계(?![가-힣])(?=[\s,;]|$)|(?<![가-힣])합\s*계(?![가-힣])(?=[\s,;]|$)|(?<![가-힣])합\s*산(?![가-힣])|(?<![가-힣])소\s*계(?![가-힣])|(?<![가-힣])총\s*계(?![가-힣])|(?<![가-힣])누\s*계(?![가-힣])|(?<![가-힣])잔액(?![가-힣])|(?<![가-힣])당월(?![가-힣])|(?<![가-힣])명세(?![가-힣])|(?<![가-힣])이월\s*잔액(?![가-힣])|(?<![가-힣])전월\s*이월(?![가-힣])|(?<![가-힣])이월\s*금액(?![가-힣])|(?<![가-힣])승인\s*합계(?![가-힣])|(?<![가-힣])결제\s*합계(?![가-힣])|(?<![가-힣])합\s*계\s*금액(?![가-힣])|(?<![가-힣])총\s*(?:사용|이용)(?![가-힣])|(?<![가-힣])사용\s*합계(?![가-힣])|(?<![가-힣])이용\s*합계(?![가-힣])|(?<![가-힣])총\s*결제\s*금액(?![가-힣])|(?<![가-힣])총\s*이용\s*금액(?![가-힣])|(?<![가-힣])총액(?![가-힣])|(?<![가-힣])당월\s*청구\s*금액(?![가-힣])|(?<![가-힣])이전\s*잔액(?![가-힣])|(?<![가-힣])결제\s*완료(?![가-힣])|(?<![가-힣])할인\s*합계(?![가-힣])|(?<![가-힣])할인(?![가-힣])(?=[\s,;]|$)|(?<![가-힣])포인트\s*사용(?![가-힣])|(?<![가-힣])포인트\s*적립(?![가-힣])|(?<![가-힣])포인트\s*합계(?![가-힣])|(?<![가-힣])할부\s*수수료\s*합계(?![가-힣])|(?<![가-힣])수수료\s*합계(?![가-힣])|(?<![가-힣])연체료\s*합계(?![가-힣])|(?<![가-힣])연체\s*이자(?![가-힣])|(?<![가-힣])승인\s*취소\s*합계(?![가-힣])|(?<![가-힣])미결제\s*잔액(?![가-힣])|(?<![가-힣])카드\s*이용\s*합계(?![가-힣])|(?<![가-힣])카\s*드\s*이용\s*한도(?![가-힣])|\btotal\b|\bsum\b|\bsubtotal\b/i;

// Header keyword vocabulary — must stay in sync with
// packages/parser/src/csv/column-matcher.ts (C4-07/C7-07).
export const HEADER_KEYWORDS: readonly string[] = [
  '이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '결제일시', '승인일', '승인일자', '승인일시', '승인완료', '매출일', '작성일', '접수일', '발행일', '사용일', '사용일자', '조회일', '조회시간', '처리일', '처리일시', '승인완료일', '입금일', '주문일', '주문시간', '결제예정일', '작성일시', '승인시간', '매입일', '전표일', '이용시간', '취소일', '취소승인일', '정산일', '환불일', '반품일', '교환일',
  '이용처', '가맹점', '가맹점명', '이용가맹점', '승인가맹점', '거래처', '매출처', '사용처', '결제처', '상호', '판매처', '구매처', '매장', '취급처', '이용내용', '거래내용', '이용업소', '승인점', '매장명', '이용매장', '상호명', '업체명', '판매자', '가맹점상호', '거래내역', '이용가맹점명', '상점', '판매점', '이용매장명', '구매내용', '가게', '취소가맹점',
  '이용금액', '거래금액', '금액', '결제금액', '승인금액', '승인액', '매출금액', '이용액', '취소금액', '환불금액', '입금액', '결제액', '청구금액', '청구액', '출금액', '결제대금', '승인취소금액', '매입금액', '실청구금액', '실결제금액', '실결제액', '결제예정금액', '사용금액', '사용액', '환급금액', '입금금액', '실입금액', '이용대금', '할인금액', '포인트할인', '할인전금액', '할인후금액',
  '비고', '적요', '메모', '내용', '설명', '참고', '참고사항', '상세내역', '비고란', '메모란', '비고내용', '메모내용', '메모사항', '상세', '승인번호', '카드번호', '승인내역', '비고사항', '카드명', '이용카드', '기타', 'remark',
  '할부', '할부개월', '할부기간', '할부개월수', 'installment', 'install',
  '업종', '카테고리', '분류', '업종분류', '업종명', '거래유형', '결제유형', '결제구분', '이용구분', '구분', '가맹점유형', '매장유형', '카드종류', '카드구분', '결제수단', '결제방법',
  'date', 'merchant', 'amount', 'total', 'store', 'shop', 'price', 'won', 'description', 'vendor', 'item', 'name', 'charge', 'payment', 'posted', 'billing', 'payee', 'memo', 'note', 'remarks', 'seller', 'company', 'business', 'purchasedate', 'orderdate', 'totalamount', 'transactionamount', 'paymentamount', 'billedamount', 'paid', 'spent', 'cost', 'value', 'approvalno', 'debit', 'credit', 'net', 'netamount', 'gross', 'recipient', 'outlet', 'bookdate', 'canceldate', 'refunddate', 'settlementdate', 'transactiondate', 'statementdate', 'paymentdate', 'invoicedate', 'timestamp', 'supplier', 'brand', 'location', 'category', 'type', 'paymenttype', 'paymentmethod', 'txn', 'txndate', 'txndt', 'txn_date', 'transdate', 'transdt', 'trans_date', 'transactiondt', 'transaction_dt', 'purchasedt', 'purchase_dt', 'desc', 'amt', 'details', 'reference', 'transaction',
];

// Keyword category Sets for multi-category header detection.
export const DATE_KEYWORDS: ReadonlySet<string> = new Set(['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '결제일시', '승인일', '승인일자', '승인일시', '승인완료', '매출일', '작성일', '접수일', '발행일', '사용일', '사용일자', '조회일', '조회시간', '처리일', '처리일시', '승인완료일', '입금일', '주문일', '주문시간', '결제예정일', '작성일시', '승인시간', '매입일', '전표일', '이용시간', '취소일', '취소승인일', '정산일', '환불일', '반품일', '교환일', 'date', 'posted', 'billing', 'purchasedate', 'orderdate', 'bookdate', 'canceldate', 'refunddate', 'settlementdate', 'transactiondate', 'statementdate', 'paymentdate', 'invoicedate', 'timestamp', 'txn', 'txndate', 'txndt', 'txn_date', 'transdate', 'transdt', 'trans_date', 'transactiondt', 'transaction_dt', 'purchasedt', 'purchase_dt']);
export const MERCHANT_KEYWORDS: ReadonlySet<string> = new Set(['이용처', '가맹점', '가맹점명', '이용가맹점', '승인가맹점', '거래처', '매출처', '사용처', '결제처', '상호', '판매처', '구매처', '매장', '취급처', '이용내용', '거래내용', '이용업소', '승인점', '매장명', '이용매장', '상호명', '업체명', '판매자', '가맹점상호', '거래내역', '이용가맹점명', '상점', '판매점', '이용매장명', '구매내용', '가게', '취소가맹점', 'merchant', 'store', 'shop', 'description', 'desc', 'vendor', 'item', 'name', 'payee', 'seller', 'company', 'business', 'recipient', 'outlet', 'supplier', 'brand', 'location', 'details', 'reference', 'transaction']);
export const AMOUNT_KEYWORDS: ReadonlySet<string> = new Set(['이용금액', '거래금액', '금액', '결제금액', '승인금액', '승인액', '매출금액', '이용액', '취소금액', '환불금액', '입금액', '결제액', '청구금액', '청구액', '출금액', '결제대금', '승인취소금액', '매입금액', '실청구금액', '실결제금액', '실결제액', '결제예정금액', '사용금액', '사용액', '환급금액', '입금금액', '실입금액', '이용대금', '할인금액', '포인트할인', '할인전금액', '할인후금액', 'amount', 'amt', 'total', 'price', 'won', 'charge', 'payment', 'paid', 'spent', 'cost', 'value', 'totalamount', 'transactionamount', 'paymentamount', 'billedamount', 'debit', 'credit', 'net', 'netamount', 'gross']);
export const CATEGORY_KEYWORDS: ReadonlySet<string> = new Set(['업종', '카테고리', '분류', '업종분류', '업종명', '거래유형', '결제유형', '결제구분', '이용구분', '구분', '가맹점유형', '매장유형', '카드종류', '카드구분', '결제수단', '결제방법', 'category', 'type', 'paymenttype', 'paymentmethod']);
export const MEMO_KEYWORDS: ReadonlySet<string> = new Set(['비고', '적요', '메모', '내용', '설명', '참고', '참고사항', '상세내역', '비고란', '메모란', '상세', '비고내용', '비고내역', '메모내용', '메모사항', '승인번호', '카드번호', '승인내역', '비고사항', '카드명', '이용카드', '기타', 'memo', 'note', 'remarks', 'remark', 'desc', 'txn', 'approvalno', 'details', 'reference']);

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
    if (/[/|,+＋]/.test(normalized)) {
      terms.push(...normalized.split(/[/|,+＋]/));
    }
  }
  const hasHeaderKeyword = terms.some((c) => (HEADER_KEYWORDS as string[]).includes(c));
  if (!hasHeaderKeyword) return false;
  const matchedCategories = [DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS, CATEGORY_KEYWORDS, MEMO_KEYWORDS]
    .filter(catSet => terms.some((c) => catSet.has(c)))
    .length;
  return matchedCategories >= 2;
}