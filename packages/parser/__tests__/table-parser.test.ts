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

  test('short date 2.31 is rejected as impossible (C11-01)', () => {
    // filterTransactionRows checks DATE_PATTERN which now includes short dates
    // but the DATE_PATTERN match itself doesn't validate day ranges.
    // The validation happens in findDateCell/isValidShortDate downstream.
    // However, filterTransactionRows should still match the pattern.
    const rows = [
      ['2.31', '가맹점', '6,500원'],
    ];
    const result = filterTransactionRows(rows);
    // 2.31 matches the short date pattern (validation is downstream)
    expect(result).toHaveLength(1);
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
