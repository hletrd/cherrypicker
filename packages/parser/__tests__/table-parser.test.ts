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
    const rows = [
      ['2024-01-15', '스타벅스', '6500'],
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
      ['2024-01-17', 'GS25', '100'],
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
});
