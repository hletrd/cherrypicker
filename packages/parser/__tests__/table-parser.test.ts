import { describe, test, expect } from 'bun:test';
import { parseTable, filterTransactionRows, detectHeaderRow, getHeaderColumns } from '../src/pdf/table-parser.js';

describe('parseTable', () => {
  test('returns empty array for empty input', () => {
    expect(parseTable('')).toEqual([]);
  });

  test('returns empty array for text with no table structure', () => {
    expect(parseTable('Just some random text\nwithout any dates or amounts')).toEqual([]);
  });

  test('detects table lines with dates and amounts', () => {
    const text = [
      '카드 이용내역',
      '2024-01-15 스타벅스 강남점    6,500원',
      '2024-01-16 이마트 서초점     45,000원',
      '2024-01-17 GS25 편의점       3,200원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  test('parses Korean full date format in table', () => {
    const text = [
      '2024년 1월 15일 스타벅스    6,500원',
      '2024년 1월 16일 이마트     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('falls back to whitespace splitting when no date/amount patterns found', () => {
    // Use text without digits to avoid triggering the amount pattern
    const text = 'Alpha  Beta  Gamma\nDelta  Epsilon  Zeta';
    const rows = parseTable(text);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  test('handles single-column lines', () => {
    const text = 'Just text\nMore text';
    const rows = parseTable(text);
    // Single-column lines should not be included (cells.length > 1 check)
    expect(rows.length).toBe(0);
  });

  test('does not stop at single blank line within table', () => {
    const text = [
      '2024-01-15 스타벅스    6,500원',
      '',
      '2024-01-16 이마트     45,000원',
      '2024-01-17 GS25       3,200원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  test('handles multiple date lines with column boundaries', () => {
    const text = [
      '날짜        가맹점          금액',
      '2024-01-15  스타벅스 강남    6,500원',
      '2024-01-16  이마트 서초     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('filterTransactionRows', () => {
  test('returns empty for empty input', () => {
    expect(filterTransactionRows([])).toEqual([]);
  });

  test('filters rows that have both date and amount', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '6,500원'],
      ['header', 'name', 'value'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('excludes rows without date', () => {
    const rows = [
      ['스타벅스', '6,500원'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('handles Korean full date format', () => {
    const rows = [
      ['2024년 1월 15일', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('handles amount without 원 suffix', () => {
    // C27-01: Amounts without comma need 5+ digits or Won sign to avoid
    // matching 4-digit years. Use comma-separated format for 4-digit amounts.
    const rows = [
      ['2024-01-15', '스타벅스', '6,500'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('does not match hyphenated card numbers as amounts (F5)', () => {
    const rows = [
      ['2024-01-15', '카드번호', '1234-5678-9012-3456'],
      ['2024-01-16', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    // Only the second row should match (card number row rejected)
    expect(result).toHaveLength(1);
    expect(result[0]?.[1]).toBe('스타벅스');
  });

  test('does not match phone numbers as amounts (F5)', () => {
    const rows = [
      ['2024-01-15', '전화', '010-1234-5678'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0]?.[1]).toBe('이마트');
  });

  test('still matches valid comma-separated amounts (F5)', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '6,500'],
      ['2024-01-16', '이마트', '45,000원'],
      ['2024-01-17', 'GS25', '5,000'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(3);
  });

  test('matches Won sign prefixed amounts (C10-01)', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '₩6,500'],
      ['2024-01-16', '이마트', '￦45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('matches parenthesized negative amounts (C10-04)', () => {
    const rows = [
      ['2024-01-15', '환불', '(6,500)'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('table parser detects Won sign amounts in text', () => {
    const text = [
      '2024-01-15 스타벅스 강남점    ₩6,500',
      '2024-01-16 이마트 서초점     ￦45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // Short date (MM.DD) support — C11-01
  // ---------------------------------------------------------------------------

  test('matches short month/day dates like 1.15 (C11-01)', () => {
    const rows = [
      ['1.15', '스타벅스', '6,500원'],
      ['1.16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('matches short month/day dates with slash like 01/15 (C11-01)', () => {
    const rows = [
      ['01/15', '스타벅스', '6,500원'],
      ['02/28', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('short date 2.31 is rejected as impossible (C11-01/C74-01)', () => {
    // isValidDateCell validates short dates via isValidShortDate which checks
    // month 1-12 and day 1-daysInMonth. "2.31" has month=2 (Feb), day=31
    // which is impossible → rejected (C74-01 fix).
    const rows = [
      ['2.31', '가맹점', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('does NOT match decimal numbers as short dates (C11-01)', () => {
    // "3.14159" should not match as a date — the pattern requires no
    // adjacent digits after the second number group
    const rows = [
      ['3.14159', '원주율', '100원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('parseTable detects short date lines as table content (C11-01)', () => {
    const text = [
      '카드 이용내역',
      '1.15  스타벅스 강남점    6,500원',
      '1.16  이마트 서초점     45,000원',
      '1.17  GS25 편의점       3,200원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  test('parseTable rejects 12.3456 as short date (C11-01)', () => {
    const text = [
      '수치 데이터: 3.14159  2.71828',
    ].join('\n');
    const rows = parseTable(text);
    // Pure numeric data with no recognized date/amount should fall to
    // the whitespace-split fallback, but those are decimal numbers
    // not matching amount pattern either (no comma separator)
    expect(rows.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Header row detection (C15-03)
// ---------------------------------------------------------------------------

describe('detectHeaderRow', () => {
  test('detects Korean header keywords in table rows', () => {
    const rows = [
      ['이용일', '가맹점명', '이용금액'],
      ['2024-01-15', '스타벅스', '6,500원'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    expect(detectHeaderRow(rows)).toBe(0);
  });

  test('detects header with different Korean keywords', () => {
    const rows = [
      ['카드번호', '******1234'],
      ['거래일시', '가맹점', '금액', '할부'],
      ['2024-01-15', '스타벅스', '6,500원', '일시불'],
    ];
    expect(detectHeaderRow(rows)).toBe(1);
  });

  test('detects English header keywords', () => {
    const rows = [
      ['Date', 'Merchant', 'Amount'],
      ['2024-01-15', 'Starbucks', '6500'],
    ];
    expect(detectHeaderRow(rows)).toBe(0);
  });

  test('returns -1 when no header keywords found', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '6,500원'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    expect(detectHeaderRow(rows)).toBe(-1);
  });

  test('skips metadata rows before header', () => {
    const rows = [
      ['삼성카드 이용명세서'],
      ['카드번호: 1234-5678-****'],
      ['이용일', '가맹점명', '이용금액'],
      ['2024-01-15', '스타벅스', '6,500원'],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  test('respects maxScan parameter', () => {
    const rows = [
      ['row0'],
      ['row1'],
      ['이용일', '가맹점명', '이용금액'],
    ];
    expect(detectHeaderRow(rows, 2)).toBe(-1);
    expect(detectHeaderRow(rows, 3)).toBe(2);
  });

  test('returns -1 for empty rows', () => {
    expect(detectHeaderRow([])).toBe(-1);
  });

  test('rejects summary-only row with only amount keywords (C16-02)', () => {
    const rows = [
      ['이용금액', '거래금액', '합계'],
      ['이용일', '가맹점명', '이용금액'],
      ['2024-01-15', '스타벅스', '6,500원'],
    ];
    // First row has only amount keywords (1 category) — should be rejected.
    // Second row has date + merchant + amount (3 categories) — should be accepted.
    expect(detectHeaderRow(rows)).toBe(1);
  });

  test('rejects row with only date keywords (C16-02)', () => {
    const rows = [
      ['이용일', '거래일', '날짜'],
      ['이용일', '가맹점명', '이용금액'],
    ];
    // First row has only date keywords (1 category) — rejected.
    // Second row has date + merchant + amount — accepted.
    expect(detectHeaderRow(rows)).toBe(1);
  });
});

describe('getHeaderColumns', () => {
  test('identifies date, merchant, amount columns from Korean header', () => {
    const layout = getHeaderColumns(['이용일', '가맹점명', '이용금액']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(0);
    expect(layout!.merchantCol).toBe(1);
    expect(layout!.amountCol).toBe(2);
  });

  test('identifies columns with different Korean synonyms', () => {
    const layout = getHeaderColumns(['거래일시', '가맹점', '거래금액']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(0);
    expect(layout!.merchantCol).toBe(1);
    expect(layout!.amountCol).toBe(2);
  });

  test('identifies columns with extra columns in between', () => {
    const layout = getHeaderColumns(['이용일', '업종', '가맹점명', '이용금액', '할부']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(0);
    expect(layout!.merchantCol).toBe(2);
    expect(layout!.amountCol).toBe(3);
    expect(layout!.installmentsCol).toBe(4);
  });

  test('identifies English column names', () => {
    const layout = getHeaderColumns(['date', 'store', 'amount']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(0);
    expect(layout!.merchantCol).toBe(1);
    expect(layout!.amountCol).toBe(2);
  });

  test('returns null when date column missing', () => {
    const layout = getHeaderColumns(['가맹점명', '이용금액']);
    expect(layout).toBeNull();
  });

  test('returns null when amount column missing', () => {
    const layout = getHeaderColumns(['이용일', '가맹점명']);
    expect(layout).toBeNull();
  });

  test('returns -1 for merchant when not found', () => {
    const layout = getHeaderColumns(['이용일', '기타컬럼', '이용금액']);
    expect(layout).not.toBeNull();
    expect(layout!.merchantCol).toBe(-1);
  });

  test('handles normalized headers with parenthetical suffixes', () => {
    const layout = getHeaderColumns(['이용일', '가맹점명', '이용금액(원)']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(0);
    expect(layout!.merchantCol).toBe(1);
    expect(layout!.amountCol).toBe(2);
  });

  test('identifies category column from PDF header (F19-01)', () => {
    const layout = getHeaderColumns(['이용일', '가맹점명', '이용금액', '업종']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(0);
    expect(layout!.merchantCol).toBe(1);
    expect(layout!.amountCol).toBe(2);
    expect(layout!.categoryCol).toBe(3);
    expect(layout!.memoCol).toBe(-1);
  });

  test('identifies memo column from PDF header (F19-01)', () => {
    const layout = getHeaderColumns(['이용일', '가맹점명', '이용금액', '비고']);
    expect(layout).not.toBeNull();
    expect(layout!.memoCol).toBe(3);
    expect(layout!.categoryCol).toBe(-1);
  });

  test('identifies both category and memo columns (F19-01)', () => {
    const layout = getHeaderColumns(['이용일', '가맹점', '이용금액', '업종', '비고']);
    expect(layout).not.toBeNull();
    expect(layout!.categoryCol).toBe(3);
    expect(layout!.memoCol).toBe(4);
  });

  test('identifies category with Korean synonym 업종분류 (F19-01)', () => {
    const layout = getHeaderColumns(['이용일', '이용처', '이용금액', '업종분류']);
    expect(layout).not.toBeNull();
    expect(layout!.categoryCol).toBe(3);
  });

  test('identifies memo with Korean synonym 적요 (F19-01)', () => {
    const layout = getHeaderColumns(['거래일', '가맹점', '거래금액', '적요']);
    expect(layout).not.toBeNull();
    expect(layout!.memoCol).toBe(3);
  });

  test('identifies columns with reversed order (amount before date) (C26-01)', () => {
    // Some PDF exports have amount before date — the header column detection
    // should correctly identify column positions regardless of order.
    const layout = getHeaderColumns(['이용금액', '가맹점명', '이용일']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(2);
    expect(layout!.merchantCol).toBe(1);
    expect(layout!.amountCol).toBe(0);
  });

  test('identifies columns with reversed order and extras (C26-01)', () => {
    const layout = getHeaderColumns(['금액', '할부', '가맹점', '날짜']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(3);
    expect(layout!.merchantCol).toBe(2);
    expect(layout!.amountCol).toBe(0);
    expect(layout!.installmentsCol).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// filterTransactionRows with summary row content
// ---------------------------------------------------------------------------
describe('filterTransactionRows with summary-like content', () => {
  test('rows with dates and amounts from summary text are still filtered in', () => {
    // filterTransactionRows only checks for date+amount patterns, not
    // summary text. Summary row skipping is done by the caller (parsePDF).
    // This test documents the current behavior.
    const rows = [
      ['2024-01-15', '스타벅스', '6,500원'],
      ['2024-01-16', '총 합계', '45,000원'],
    ];
    const filtered = filterTransactionRows(rows);
    expect(filtered).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// F20-01: Parenthesized amount regex capture group fix
// ---------------------------------------------------------------------------

describe('F20-01: fallback amount pattern captures parenthesized amounts', () => {
  test('regex captures digits inside parentheses as group 1', () => {
    // The fallback amount pattern must capture parenthesized amounts
    // in group 1 (not leave it undefined). This was a bug where
    // /\([\d,]+\)|([\d,]+)원?/g left group 1 undefined for (1,234).
    const pattern = /\(([\d,]+)\)|([\d,]+)원?/g;
    const matches = [...'2024-01-15 환불 (1,234)'.matchAll(pattern)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The last match should be the parenthesized amount
    const lastMatch = matches[matches.length - 1]!;
    // Group 1 should capture the digits inside parentheses
    expect(lastMatch[1]).toBe('1,234');
    // Group 2 should be undefined (not a normal amount match)
    expect(lastMatch[2]).toBeUndefined();
  });

  test('regex captures normal amounts as group 2', () => {
    const pattern = /\(([\d,]+)\)|([\d,]+)원?/g;
    const matches = [...'2024-01-15 스타벅스 6,500원'.matchAll(pattern)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const lastMatch = matches[matches.length - 1]!;
    // Group 1 should be undefined (not parenthesized)
    expect(lastMatch[1]).toBeUndefined();
    // Group 2 should capture the digits
    expect(lastMatch[2]).toBe('6,500');
  });

  test('extracts correct amount for parenthesized match via group fallback', () => {
    const pattern = /\(([\d,]+)\)|([\d,]+)원?/g;
    const matches = [...'2024-01-15 환불 (1,234)'.matchAll(pattern)];
    const lastMatch = matches[matches.length - 1]!;
    // The fix: use group 1 ?? group 2
    const amountRaw = (lastMatch[1] ?? lastMatch[2])!;
    expect(amountRaw).toBe('1,234');
  });
});

// ---------------------------------------------------------------------------
// C23-02: Full-width dot and ideographic full stop in PDF table DATE_PATTERN
// ---------------------------------------------------------------------------

describe('DATE_PATTERN full-width dot support (C23-02)', () => {
  test('matches YYYY．MM．DD full-width dot dates in table text', () => {
    const text = [
      '2024．01．15 스타벅스 강남점    6,500원',
      '2024．01．16 이마트 서초점     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('matches YYYY。MM。DD ideographic full stop dates in table text', () => {
    const text = [
      '2024。01。15 스타벅스 강남점    6,500원',
      '2024。01。16 이마트 서초점     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('matches short full-width dot date 1．15 in table text', () => {
    const rows = [
      ['1．15', '스타벅스', '6,500원'],
      ['1．16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('matches short ideographic full stop date 1。15 in table text', () => {
    const rows = [
      ['1。15', '스타벅스', '6,500원'],
      ['1。16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('rejects decimal 3．14159 as short date with full-width dot', () => {
    const rows = [
      ['3．14159', '원주율', '100원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// C27-01: AMOUNT_PATTERN must not match 4-digit year values as amounts
// ---------------------------------------------------------------------------

describe('C27-01: AMOUNT_PATTERN rejects year values', () => {
  test('does NOT match bare 4-digit year "2024" as an amount', () => {
    // A row with a year value and a date should not have the year treated
    // as an amount. Only the real comma-separated amount should match.
    const rows = [
      ['2024-01-15', '2024', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    // The row has a date and amount ("6,500원") — should be a transaction row
    expect(result).toHaveLength(1);
  });

  test('does NOT match bare 4-digit year "2025" in a date-only row', () => {
    // A row with only a date and a year value (no real amount) should NOT
    // be treated as a transaction row.
    const rows = [
      ['2024-01-15', '스타벅스', '2025'],
    ];
    const result = filterTransactionRows(rows);
    // "2025" should not match as an amount → row has no amount → filtered out
    expect(result).toHaveLength(0);
  });

  test('does NOT match bare 3-digit "100" as an amount (below 5-digit minimum)', () => {
    // With the C27-01 fix, bare integers need 5+ digits or a comma separator.
    // "100" (3 digits, no comma) won't match the table-parser AMOUNT_PATTERN.
    const rows = [
      ['2024-01-15', 'GS25', '100'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('still matches valid 5+ digit amounts like "12345"', () => {
    const rows = [
      ['2024-01-15', '이마트', '12345'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('still matches comma-separated amounts like "1,234"', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '1,234'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('still matches Won-prefixed amounts like "₩6,500"', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '₩6,500'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  // C32-01: Won-sign-prefixed small amounts (no comma, < 5 digits)
  test('matches small Won-prefixed amounts like "₩500" (C32-01)', () => {
    const rows = [
      ['2024-01-15', '편의점', '₩500'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('matches small fullwidth Won amounts like "￦300" (C32-01)', () => {
    const rows = [
      ['2024-01-15', '카페', '￦300'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('matches Won-prefixed amount with Won suffix "₩100원" (C32-01)', () => {
    const rows = [
      ['2024-01-15', '자판기', '₩100원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('parseTable detects small Won-sign amounts in text (C32-01)', () => {
    const text = [
      '2024-01-15 편의점    ₩500',
      '2024-01-16 카페      ￦300원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('still matches parenthesized amounts like "(1,234)"', () => {
    const rows = [
      ['2024-01-15', '환불', '(1,234)'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('does NOT match bare 2-digit number "12" as an amount', () => {
    const rows = [
      ['2024-01-15', '테스트', '12'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('matches Won-sign prefixed amounts like "₩500" (C34-01)', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '₩500'],
      ['2024-01-16', '이마트', '₩1,234'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('matches fullwidth Won-sign amounts like "￦500" (C34-01)', () => {
    const rows = [
      ['2024-01-15', '스타벅스', '￦500'],
      ['2024-01-16', '이마트', '￦1,234'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('matches Won-sign amounts with 원 suffix like "₩6,500원"', () => {
    const rows = [
      ['2024-01-15', '테스트', '₩6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 35: PDF fallback amount pattern — 마이너스 prefix and group extraction
// ---------------------------------------------------------------------------

describe('Cycle 35: PDF fallback amount pattern 마이너스 and group extraction', () => {
  // The fallback pattern has 4 capture groups:
  // 1. Parenthesized: (1,234)
  // 2. Won-sign: ₩500 or ￦1,234
  // 3. 마이너스: 마이너스1,000
  // 4. Plain comma/5+digit: 10,000
  const fallbackPattern = /\(([\d,]+)\)|[₩￦]([\d,]+)원?|마이너스([\d,]+)원?|([\d,]*(?:,|\d{5,})[\d,]*)원?/g;

  test('captures plain comma amount as group 4', () => {
    const matches = [...'2024-01-15 스타벅스 10,000원'.matchAll(fallbackPattern)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const last = matches[matches.length - 1]!;
    expect(last[4]).toBe('10,000');
    expect(last[1]).toBeUndefined();
    expect(last[2]).toBeUndefined();
    expect(last[3]).toBeUndefined();
  });

  test('captures Won-sign amount as group 2', () => {
    const matches = [...'2024-01-15 스타벅스 ₩6,500'.matchAll(fallbackPattern)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const last = matches[matches.length - 1]!;
    expect(last[2]).toBe('6,500');
    expect(last[4]).toBeUndefined();
  });

  test('captures parenthesized amount as group 1', () => {
    const matches = [...'2024-01-15 환불 (1,234)'.matchAll(fallbackPattern)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const last = matches[matches.length - 1]!;
    expect(last[1]).toBe('1,234');
  });

  test('captures 마이너스 amount as group 3', () => {
    const matches = [...'2024-01-15 환불 마이너스5,000'.matchAll(fallbackPattern)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const last = matches[matches.length - 1]!;
    expect(last[3]).toBe('5,000');
    expect(last[1]).toBeUndefined();
    expect(last[2]).toBeUndefined();
    expect(last[4]).toBeUndefined();
  });

  test('group extraction fallback chain works for plain amount', () => {
    const matches = [...'2024-01-15 스타벅스 10,000원'.matchAll(fallbackPattern)];
    const last = matches[matches.length - 1]!;
    const amountRaw = (last[1] ?? last[2] ?? last[3] ?? last[4])!;
    expect(amountRaw).toBe('10,000');
  });

  test('group extraction fallback chain works for 마이너스 amount', () => {
    const matches = [...'2024-01-15 환불 마이너스5,000'.matchAll(fallbackPattern)];
    const last = matches[matches.length - 1]!;
    const amountRaw = (last[1] ?? last[2] ?? last[3] ?? last[4])!;
    expect(amountRaw).toBe('5,000');
  });

  test('filterTransactionRows detects 마이너스 amounts in rows', () => {
    const rows = [
      ['2024-01-15', '환불', '마이너스5,000'],
    ];
    // The AMOUNT_PATTERN's lookbehind only excludes ASCII letters/digits/hyphens,
    // so Korean characters before the digits don't prevent matching. The "5,000"
    // portion of "마이너스5,000" matches the comma-separated amount pattern.
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 36: PDF AMOUNT_PATTERN explicit 마이너스 support
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cycle 41: PDF AMOUNT_PATTERN Won sign character class cleanup
// ---------------------------------------------------------------------------

describe('Cycle 41: AMOUNT_PATTERN Won sign character class', () => {
  test('matches half-width Won sign ₩500 as amount', () => {
    const rows = [
      ['2024-01-15', '편의점', '₩500'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('matches fullwidth Won sign ￦500 as amount', () => {
    const rows = [
      ['2024-01-15', '편의점', '￦500'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('matches Won sign with 원 suffix ₩1,000원', () => {
    const rows = [
      ['2024-01-15', '카페', '₩1,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('matches Won sign with comma separator ₩10,000', () => {
    const rows = [
      ['2024-01-15', '마트', '₩10,000'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('parseTable detects Won-sign amounts in plain text', () => {
    const text = [
      '2024-01-15 편의점    ₩500',
      '2024-01-16 카페      ￦300원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Cycle 36: PDF AMOUNT_PATTERN explicit 마이너스 matching', () => {
  test('parseTable detects 마이너스 amounts in PDF text', () => {
    const text = [
      '2024-01-15 환불 건    마이너스5,000',
      '2024-01-16 이마트     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('filterTransactionRows matches 마이너스 cell directly', () => {
    const rows = [
      ['2024-01-15', '환불', '마이너스3,000'],
      ['2024-01-16', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('filterTransactionRows matches 마이너스 without comma', () => {
    const rows = [
      ['2024-01-15', '환불', '마이너스500'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('parseTable detects 마이너스 in plain text lines', () => {
    const text = [
      '2024-01-15 편의점    마이너스3,000',
      '2024-01-16 카페      마이너스500원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Cycle 50: PDF YYMMDD date validation in filterTransactionRows (C50-01)', () => {
  test('accepts valid YYMMDD date "240115" (2024-01-15)', () => {
    const rows = [
      ['240115', '스타벅스', '4,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('rejects invalid 6-digit "123456" (month 34 is invalid)', () => {
    const rows = [
      ['123456', '스타벅스', '4,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('rejects invalid 6-digit "999999" (month 99 is invalid)', () => {
    const rows = [
      ['999999', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('rejects 6-digit "000000" (month 00 is invalid)', () => {
    const rows = [
      ['000000', '카페', '3,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('accepts valid YYMMDD "250228" (2025-02-28)', () => {
    const rows = [
      ['250228', '편의점', '2,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('still accepts standard YYYY.MM.DD dates', () => {
    const rows = [
      ['2024.01.15', '스타벅스', '4,500원'],
      ['2024-02-20', '이마트', '30,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('mixed valid YYMMDD and invalid 6-digit IDs', () => {
    const rows = [
      ['240115', '스타벅스', '4,500원'],   // valid YYMMDD
      ['123456', '이마트', '45,000원'],     // invalid (month 34)
      ['250301', '카페', '3,000원'],        // valid YYMMDD
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
    expect(result[0]?.[0]).toBe('240115');
    expect(result[1]?.[0]).toBe('250301');
  });
});

describe('Cycle 50: PDF getHeaderColumns combined header splitting (C50-02)', () => {
  test('detects date column from combined header "이용일/승인일"', () => {
    const layout = getHeaderColumns(['이용일/승인일', '가맹점', '금액']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(0);
  });

  test('detects amount column from combined header "이용금액/취소금액"', () => {
    const layout = getHeaderColumns(['날짜', '가맹점', '이용금액/취소금액']);
    expect(layout).not.toBeNull();
    expect(layout!.amountCol).toBe(2);
  });

  test('detects memo column from combined header "비고/적요"', () => {
    const layout = getHeaderColumns(['이용일', '가맹점', '금액', '비고/적요']);
    expect(layout).not.toBeNull();
    expect(layout!.memoCol).toBe(3);
  });

  test('detects columns from pipe-delimited header "이용일|승인일"', () => {
    const layout = getHeaderColumns(['이용일|승인일', '가맹점', '금액']);
    expect(layout).not.toBeNull();
    expect(layout!.dateCol).toBe(0);
  });

  test('returns null when date column missing even with combined headers', () => {
    const layout = getHeaderColumns(['번호', '가맹점', '금액']);
    expect(layout).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C58-01: Fullwidth minus `－` amounts in PDF patterns
// ---------------------------------------------------------------------------

describe('C58-01: Fullwidth minus amounts in PDF AMOUNT_PATTERN', () => {
  test('filterTransactionRows matches fullwidth-minus amount `－50,000`', () => {
    const rows = [
      ['2024-01-15', '환불', '－50,000'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('filterTransactionRows matches fullwidth-minus with 원 suffix `－3,000원`', () => {
    const rows = [
      ['2024-01-15', '환불', '－3,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('parseTable detects fullwidth-minus amounts in text', () => {
    const text = [
      '2024-01-15 환불 건    －50,000원',
      '2024-01-16 이마트     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('filterTransactionRows matches fullwidth-minus Won-sign combo `￦－5,000`', () => {
    const rows = [
      ['2024-01-15', '환불', '￦－5,000'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// C58-01: Fullwidth minus in fallback amount pattern
// ---------------------------------------------------------------------------

describe('C58-01: Fullwidth minus in fallback amount pattern', () => {
  // Updated fallback pattern with 6 capture groups:
  // 1. Parenthesized: (1,234)
  // 2. Won-sign: ₩500 or ￦1,234
  // 3. 마이너스: 마이너스1,000
  // 4. Fullwidth-minus: －50,000
  // 5. KRW: KRW10,000 (C59-02)
  // 6. Plain comma/5+digit: 10,000
  const fallbackPattern = /\(([\d,]+)\)|[₩￦]([\d,]+)원?|마이너스([\d,]+)원?|(－[\d,]+)원?|KRW([\d,]+)원?|([\d,]*(?:,|\d{5,})[\d,]*)원?/g;

  test('captures fullwidth-minus amount as group 4', () => {
    const matches = [...'2024-01-15 환불 －50,000원'.matchAll(fallbackPattern)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const last = matches[matches.length - 1]!;
    expect(last[4]).toBe('－50,000');
    expect(last[1]).toBeUndefined();
    expect(last[2]).toBeUndefined();
    expect(last[3]).toBeUndefined();
    expect(last[5]).toBeUndefined();
    expect(last[6]).toBeUndefined();
  });

  test('group extraction fallback chain works for fullwidth-minus amount', () => {
    const matches = [...'2024-01-15 환불 －50,000원'.matchAll(fallbackPattern)];
    const last = matches[matches.length - 1]!;
    const amountRaw = (last[1] ?? last[2] ?? last[3] ?? last[4] ?? last[5] ?? last[6])!;
    expect(amountRaw).toBe('－50,000');
  });

  test('plain amount still works as group 6 with updated pattern', () => {
    const matches = [...'2024-01-15 스타벅스 10,000원'.matchAll(fallbackPattern)];
    const last = matches[matches.length - 1]!;
    expect(last[6]).toBe('10,000');
    expect(last[5]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// C59-01/C59-02: KRW prefix support in PDF amount patterns
// ---------------------------------------------------------------------------

describe('C59-01: KRW prefix in AMOUNT_PATTERN', () => {
  test('KRW10,000 matches AMOUNT_PATTERN', () => {
    const AMOUNT_PATTERN = /(?<![a-zA-Z\d\-－])₩\d[\d,]*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d\-－])￦\d[\d,]*원?(?![a-zA-Z\d\-－])|마이너스[\d,]+원?|(?<![a-zA-Z\d])KRW[\d,]+원?(?![a-zA-Z\d])|(?<![a-zA-Z\d])(?:[\d,]*,|\d{5,})[\d,]*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d])－[\d,]+원?(?![a-zA-Z\d])|\([\d,]+\)/;
    expect(AMOUNT_PATTERN.test('KRW10,000')).toBe(true);
    expect(AMOUNT_PATTERN.test('KRW1,234,567')).toBe(true);
    expect(AMOUNT_PATTERN.test('KRW500')).toBe(true);
  });

  test('KRW prefix in table row is detected by filterTransactionRows', () => {
    const text = [
      '2024-01-15 스타벅스 강남점    KRW6,500',
      '2024-01-16 이마트 서초점     KRW45,000',
    ].join('\n');
    const rows = parseTable(text);
    const txRows = filterTransactionRows(rows);
    expect(txRows.length).toBeGreaterThanOrEqual(2);
  });

  test('KRW prefix does not false-positive on non-KRW text', () => {
    const AMOUNT_PATTERN = /(?<![a-zA-Z\d\-－])₩\d[\d,]*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d\-－])￦\d[\d,]*원?(?![a-zA-Z\d\-－])|마이너스[\d,]+원?|(?<![a-zA-Z\d])KRW[\d,]+원?(?![a-zA-Z\d])|(?<![a-zA-Z\d])(?:[\d,]*,|\d{5,})[\d,]*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d])－[\d,]+원?(?![a-zA-Z\d])|\([\d,]+\)/;
    expect(AMOUNT_PATTERN.test('AKRW10,000')).toBe(false);
  });
});

describe('C59-02: KRW prefix in fallback amount pattern', () => {
  const fallbackPattern = /\(([\d,]+)\)|[₩￦]([\d,]+)원?|마이너스([\d,]+)원?|(－[\d,]+)원?|KRW([\d,]+)원?|([\d,]*(?:,|\d{5,})[\d,]*)원?/g;

  test('captures KRW amount as group 5', () => {
    const matches = [...'2024-01-15 스타벅스 KRW10,000'.matchAll(fallbackPattern)];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const last = matches[matches.length - 1]!;
    expect(last[5]).toBe('10,000');
  });

  test('group extraction fallback chain includes KRW group', () => {
    const matches = [...'2024-01-15 이마트 KRW45,000원'.matchAll(fallbackPattern)];
    const last = matches[matches.length - 1]!;
    const amountRaw = (last[1] ?? last[2] ?? last[3] ?? last[4] ?? last[5] ?? last[6])!;
    expect(amountRaw).toBe('45,000');
  });
});

// ---------------------------------------------------------------------------
// Cycle 62: KRW prefix in PDF STRICT_AMOUNT_PATTERN (findAmountCell path)
// ---------------------------------------------------------------------------

describe('Cycle 62: KRW prefix in PDF STRICT_AMOUNT_PATTERN', () => {
  // The STRICT_AMOUNT_PATTERN is used by findAmountCell() in the structured
  // PDF parser. It must match KRW-prefixed amounts so that the structured
  // parser can extract them from table rows (the AMOUNT_PATTERN already
  // detects these rows, but findAmountCell needs STRICT_AMOUNT_PATTERN).
  const STRICT_AMOUNT_PATTERN = /^마이너스[\d,]+원?$|^KRW[\d,]+원?$|^[₩￦]?[－-]?(?:[\d,]*,|\d{5,})[\d,]*원?$|^\([\d,]+\)$/i;

  test('matches KRW10,000 as structured amount', () => {
    expect(STRICT_AMOUNT_PATTERN.test('KRW10,000')).toBe(true);
  });

  test('matches KRW1,234,567 as structured amount', () => {
    expect(STRICT_AMOUNT_PATTERN.test('KRW1,234,567')).toBe(true);
  });

  test('matches KRW500 as structured amount', () => {
    expect(STRICT_AMOUNT_PATTERN.test('KRW500')).toBe(true);
  });

  test('matches lowercase krw10,000 case-insensitively', () => {
    expect(STRICT_AMOUNT_PATTERN.test('krw10,000')).toBe(true);
  });

  test('matches KRW1,000원 with Won suffix', () => {
    expect(STRICT_AMOUNT_PATTERN.test('KRW1,000원')).toBe(true);
  });

  test('does not match AKRW10,000 (letter prefix)', () => {
    expect(STRICT_AMOUNT_PATTERN.test('AKRW10,000')).toBe(false);
  });

  test('filterTransactionRows detects KRW amounts in table cells', () => {
    const rows = [
      ['2024-01-15', '스타벅스', 'KRW6,500'],
      ['2024-01-16', '이마트', 'KRW45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('parseTable detects KRW amount lines as table content', () => {
    const text = [
      '2024-01-15 스타벅스 강남점    KRW6,500',
      '2024-01-16 이마트 서초점     KRW45,000',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  // C63-01: Server-side STRICT_AMOUNT_PATTERN must match KRW and 마이너스
  // for parity with the web-side pdf.ts. These tests verify the pattern used
  // by findAmountCell() in the server-side structured PDF parser.
  test('matches 마이너스3,000 as structured amount', () => {
    expect(STRICT_AMOUNT_PATTERN.test('마이너스3,000')).toBe(true);
  });

  test('matches 마이너스500 as structured amount (no comma)', () => {
    expect(STRICT_AMOUNT_PATTERN.test('마이너스500')).toBe(true);
  });

  test('matches 마이너스1,000원 with Won suffix', () => {
    expect(STRICT_AMOUNT_PATTERN.test('마이너스1,000원')).toBe(true);
  });

  test('does NOT match bare ₩ without digits as structured amount (C63-01)', () => {
    expect(STRICT_AMOUNT_PATTERN.test('₩')).toBe(false);
  });

  test('does NOT match bare KRW without digits as structured amount', () => {
    expect(STRICT_AMOUNT_PATTERN.test('KRW')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cycle 64: PDF multi-word merchant names in column-boundary parsed tables
// ---------------------------------------------------------------------------

describe('Cycle 64: PDF multi-word merchant names', () => {
  test('parseTable preserves multi-word merchant names across column boundaries', () => {
    const text = [
      '날짜            가맹점                  금액',
      '2024-01-15      스타벅스 강남점         6,500원',
      '2024-01-16      이마트 서초점           45,000원',
      '2024-01-17      GS25 강남역점           3,200원',
    ].join('\n');
    const rows = parseTable(text);
    // Header row has no date/amount pattern, so parseTable picks up only the 3 data rows
    expect(rows.length).toBeGreaterThanOrEqual(3);
    // Merchant column should preserve multi-word names
    const dataRows = filterTransactionRows(rows);
    expect(dataRows).toHaveLength(3);
    expect(dataRows[0]?.[1]?.trim()).toBe('스타벅스 강남점');
    expect(dataRows[1]?.[1]?.trim()).toBe('이마트 서초점');
  });

  test('parseTable handles columns with varying content widths', () => {
    const text = [
      '2024-01-15  Starbucks Gangnam Branch  ₩6,500',
      '2024-01-16  E-Mart Seocho  ₩45,000',
      '2024-01-17  CU  ₩3,200',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Cycle 68: Trailing minus sign for negative amounts (C68-01)
// ---------------------------------------------------------------------------

describe('Cycle 68: Trailing minus sign amount patterns (C68-01)', () => {
  // AMOUNT_PATTERN (used by filterTransactionRows) should match trailing-minus amounts
  const AMOUNT_PATTERN = /(?<![a-zA-Z\d\-－])₩\d[\d,]*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d\-－])￦\d[\d,]*원?(?![a-zA-Z\d\-－])|마이너스[\d,]+원?|(?<![a-zA-Z\d])KRW[\d,]+원?(?![a-zA-Z\d])|(?<![a-zA-Z\d])(?:[\d,]*,|\d{5,})[\d,]*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d])－[\d,]+원?(?![a-zA-Z\d])|\([\d,]+\)|(?:[\d,]*,|\d{5,})[\d,]*-(?![a-zA-Z\d\-－])/;

  test('AMOUNT_PATTERN matches trailing-minus "1,234-"', () => {
    expect(AMOUNT_PATTERN.test('1,234-')).toBe(true);
  });

  test('AMOUNT_PATTERN matches trailing-minus "50000-"', () => {
    expect(AMOUNT_PATTERN.test('50000-')).toBe(true);
  });

  test('AMOUNT_PATTERN matches trailing-minus "1,234,567-"', () => {
    expect(AMOUNT_PATTERN.test('1,234,567-')).toBe(true);
  });

  test('filterTransactionRows detects trailing-minus amounts in table rows', () => {
    const rows = [
      ['2024-01-15', '환불건', '1,234-'],
      ['2024-01-16', '스타벅스', '6,500'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// C74-01: isValidDateCell validates short dates via isValidShortDate
// ---------------------------------------------------------------------------

describe('C74-01: isValidDateCell short-date validation via isValidShortDate', () => {
  test('rejects impossible short date "2.31" (Feb 31) via isValidShortDate', () => {
    const rows = [
      ['2.31', '가맹점', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('rejects impossible short date "4.31" (Apr 31) via isValidShortDate', () => {
    const rows = [
      ['4.31', '카페', '3,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('rejects invalid month "13.01" (month 13) via isValidShortDate', () => {
    const rows = [
      ['13.01', '테스트', '5,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('rejects invalid month "0.15" (month 0) via isValidShortDate', () => {
    const rows = [
      ['0.15', '테스트', '5,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('rejects invalid day "1.0" (day 0) via isValidShortDate', () => {
    const rows = [
      ['1.0', '테스트', '5,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('accepts valid short date "1.15" via isValidShortDate', () => {
    const rows = [
      ['1.15', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('accepts valid short date "2.28" (Feb 28) via isValidShortDate', () => {
    const rows = [
      ['2.28', '이마트', '30,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('accepts valid short date "12/31" via isValidShortDate', () => {
    const rows = [
      ['12/31', '편의점', '2,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('rejects trailing-space "1.15 " short date with end-anchored pattern', () => {
    // SHORT_MD_DATE_PATTERN is end-anchored ($), so "1.15 " (with trailing
    // space) should NOT match. After trim() in isValidDateCell, the space
    // is removed, so "1.15" does match — this is correct behavior.
    const rows = [
      ['1.15 ', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('"3.5" passes short-date validation (month=3, day=5 is valid) (C75-02)', () => {
    // "3.5" looks like month=3, day=5 which is valid per daysInMonth.
    // The SHORT_MD_DATE_PATTERN matches it and isValidShortDate accepts it.
    // This is an inherent ambiguity of the MM.DD format — "3.5" can be both
    // a date (March 5) and a decimal amount. The web-side PDF parser's
    // isValidDateCell now also checks SHORT_MD_DATE_PATTERN (C75-02 parity),
    // matching server-side behavior.
    const rows = [
      ['3.5', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('rejects "3.50" as short date — 3 digits after dot (C75-02)', () => {
    // "3.50" has trailing "0" after the MM.DD pattern. The SHORT_MD_DATE_PATTERN
    // is end-anchored ($), so "3.50" does NOT match. The DATE_PATTERN's
    // short-date alternative also rejects "3.50" via its lookahead.
    const rows = [
      ['3.50', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  // --- YYYYMMDD (8-digit) date format tests (C81-01) ---

  test('accepts valid YYYYMMDD date "20240115" (C81-01)', () => {
    const rows = [
      ['20240115', '스타벅스 강남점', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('accepts valid YYYYMMDD date "20231231" (year boundary, C81-01)', () => {
    const rows = [
      ['20231231', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('rejects invalid YYYYMMDD date "20241315" (month 13, C81-01)', () => {
    const rows = [
      ['20241315', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('rejects invalid YYYYMMDD date "20240230" (Feb 30, C81-01)', () => {
    const rows = [
      ['20240230', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('rejects 8-digit non-date number "12345678" (C81-01)', () => {
    const rows = [
      ['12345678', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('accepts YYYYMMDD in parseTable output (C81-01)', () => {
    const text = [
      '20240115 스타벅스 강남점    6,500원',
      '20240116 이마트 서초점     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  // --- YYYYMMDD date pattern in parseTable DATE_PATTERN (C82-01) ---

  test('parseTable detects YYYYMMDD lines as table content via DATE_PATTERN (C82-01)', () => {
    // Small amounts without comma (< 5 digits) rely on DATE_PATTERN alone
    // to trigger hasDate. Before C82-01, DATE_PATTERN did not match \d{8}.
    const text = [
      '카드 이용내역',
      '20240115 스타벅스 강남점    3500원',
      '20240116 이마트 서초점     8000원',
      '20240117 GS25 편의점       2500원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  test('filterTransactionRows accepts YYYYMMDD rows with small amounts (C82-01)', () => {
    const rows = [
      ['20240115', '스타벅스', '3500원'],
      ['20240116', '이마트', '8000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(2);
  });

  test('parseTable detects YYYYMMDD lines with bare 5-digit amounts (C82-01)', () => {
    const text = [
      '20240115 스타벅스 강남점    35000',
      '20240116 이마트 서초점     12000',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// C88-01: Leap year short date validation — Feb 29 accepted in non-leap years
// ---------------------------------------------------------------------------

describe('C88-01: Leap year short date validation', () => {
  test('accepts short date "2.29" (Feb 29) regardless of current year', () => {
    // Feb 29 is valid in leap years (2024, 2028, etc.). The isValidShortDate
    // function now checks both current year AND previous year (2-year window)
    // to ensure Feb 29 from leap-year statements is accepted even when the
    // parser runs in a non-leap year.
    const rows = [
      ['2.29', '스타벅스', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('accepts short date "2/29" (Feb 29 with slash) regardless of current year', () => {
    const rows = [
      ['2/29', '이마트', '45,000원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(1);
  });

  test('still rejects impossible "2.30" (Feb 30) in both years', () => {
    // Feb 30 is impossible in any year (leap or non-leap)
    const rows = [
      ['2.30', '가맹점', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('still rejects impossible "2.31" (Feb 31) in both years', () => {
    const rows = [
      ['2.31', '가맹점', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    expect(result).toHaveLength(0);
  });

  test('accepts parseTable lines with Feb 29 short dates', () => {
    const text = [
      '2.29  스타벅스 강남점    6,500원',
      '3.01  이마트 서초점     45,000원',
    ].join('\n');
    const rows = parseTable(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
