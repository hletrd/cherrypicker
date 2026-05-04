import { describe, test, expect } from 'bun:test';
import { splitCSVLine, splitCSVContent, parseCSVAmount, isValidCSVAmount, parseCSVInstallments } from '../src/csv/shared.js';
import { normalizeHeader, findColumn, DATE_COLUMN_PATTERN, isValidHeaderRow, HEADER_KEYWORDS } from '../src/csv/column-matcher.js';

// ---------------------------------------------------------------------------
// splitCSVLine — RFC 4180 compliant CSV line splitter
// ---------------------------------------------------------------------------

describe('splitCSVLine', () => {
  test('splits simple comma-delimited fields', () => {
    expect(splitCSVLine('a,b,c', ',')).toEqual(['a', 'b', 'c']);
  });

  test('trims whitespace from fields', () => {
    expect(splitCSVLine('  a , b , c  ', ',')).toEqual(['a', 'b', 'c']);
  });

  test('handles quoted fields with commas inside', () => {
    expect(splitCSVLine('"hello, world",b,c', ',')).toEqual(['hello, world', 'b', 'c']);
  });

  test('handles doubled-quote escapes', () => {
    expect(splitCSVLine('"say ""hello""",b', ',')).toEqual(['say "hello"', 'b']);
  });

  test('handles empty fields', () => {
    expect(splitCSVLine('a,,c', ',')).toEqual(['a', '', 'c']);
  });

  test('handles single field', () => {
    expect(splitCSVLine('hello', ',')).toEqual(['hello']);
  });

  test('handles empty line', () => {
    expect(splitCSVLine('', ',')).toEqual(['']);
  });

  test('handles tab delimiter with simple split', () => {
    expect(splitCSVLine('a\tb\tc', '\t')).toEqual(['a', 'b', 'c']);
  });

  test('handles tab delimiter and trims fields', () => {
    expect(splitCSVLine('  a \t b \t c  ', '\t')).toEqual(['a', 'b', 'c']);
  });

  test('handles semicolon delimiter', () => {
    expect(splitCSVLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
  });

  test('handles pipe delimiter', () => {
    expect(splitCSVLine('a|b|c', '|')).toEqual(['a', 'b', 'c']);
  });

  test('handles quoted field spanning entire line', () => {
    expect(splitCSVLine('"full,quoted,line"', ',')).toEqual(['full,quoted,line']);
  });

  test('handles Korean text in quoted fields', () => {
    expect(splitCSVLine('"스타벅스,강남점",5500', ',')).toEqual(['스타벅스,강남점', '5500']);
  });

  test('handles consecutive quoted fields', () => {
    expect(splitCSVLine('"a","b","c"', ',')).toEqual(['a', 'b', 'c']);
  });

  test('handles unclosed quote (consumes rest of line as one field)', () => {
    // When a quote is opened but not closed, the CSV parser treats everything
    // after the opening quote as part of the quoted field. This is standard
    // RFC 4180 behavior for malformed input.
    expect(splitCSVLine('"unclosed,rest', ',')).toEqual(['unclosed,rest']);
  });

  // C13-01: Quoted fields for non-comma delimiters

  test('handles quoted fields with tab delimiter', () => {
    expect(splitCSVLine('"hello\tworld"\tb\tc', '\t')).toEqual(['hello\tworld', 'b', 'c']);
  });

  test('handles quoted fields with pipe delimiter', () => {
    expect(splitCSVLine('"hello|world"|b|c', '|')).toEqual(['hello|world', 'b', 'c']);
  });

  test('handles quoted fields with semicolon delimiter', () => {
    expect(splitCSVLine('"hello;world";b;c', ';')).toEqual(['hello;world', 'b', 'c']);
  });

  test('handles doubled-quote escapes with tab delimiter', () => {
    expect(splitCSVLine('"say ""hello"""\tb', '\t')).toEqual(['say "hello"', 'b']);
  });

  test('handles Korean merchant with tab in quoted field', () => {
    expect(splitCSVLine('"스타벅스\t강남점"\t5500', '\t')).toEqual(['스타벅스\t강남점', '5500']);
  });

  test('handles pipe in quoted field for pipe-delimited file', () => {
    expect(splitCSVLine('"A|B"|C|D', '|')).toEqual(['A|B', 'C', 'D']);
  });

  test('handles mixed quoted and unquoted fields with tab delimiter', () => {
    expect(splitCSVLine('plain\t"quoted\tfield"\t12345', '\t')).toEqual(['plain', 'quoted\tfield', '12345']);
  });

  test('handles tab-separated file with quoted fields containing multiple tabs', () => {
    // Korean bank exports sometimes have tab-delimited content with
    // quoted fields that contain embedded tab characters
    expect(splitCSVLine('"카드\t번호\t확인"\t이용일\t이용금액', '\t')).toEqual([
      '카드\t번호\t확인', '이용일', '이용금액',
    ]);
  });

  test('handles tab-separated file with all fields quoted', () => {
    expect(splitCSVLine('"2024-01-15"\t"스타벅스"\t"5500"', '\t')).toEqual([
      '2024-01-15', '스타벅스', '5500',
    ]);
  });
});

// ---------------------------------------------------------------------------
// parseCSVAmount — amount string parser
// ---------------------------------------------------------------------------

describe('parseCSVAmount', () => {
  test('parses simple integer', () => {
    expect(parseCSVAmount('5500')).toBe(5500);
  });

  test('parses amount with comma separator', () => {
    expect(parseCSVAmount('1,250,000')).toBe(1250000);
  });

  test('parses amount with 원 suffix', () => {
    expect(parseCSVAmount('6,500원')).toBe(6500);
  });

  test('parses amount with ₩ prefix', () => {
    expect(parseCSVAmount('₩6,500')).toBe(6500);
  });

  test('parses amount with ￦ (fullwidth) prefix', () => {
    expect(parseCSVAmount('￦30,000')).toBe(30000);
  });

  test('parses amount with ₩ prefix and 원 suffix', () => {
    expect(parseCSVAmount('₩6,500원')).toBe(6500);
  });

  test('parses negative amount with minus sign', () => {
    expect(parseCSVAmount('-5000')).toBe(-5000);
  });

  test('parses parenthesized negative amount', () => {
    expect(parseCSVAmount('(5,000)')).toBe(-5000);
  });

  test('parses zero amount', () => {
    expect(parseCSVAmount('0')).toBe(0);
  });

  test('returns null for empty string', () => {
    expect(parseCSVAmount('')).toBeNull();
  });

  test('returns null for non-numeric string', () => {
    expect(parseCSVAmount('abc')).toBeNull();
  });

  test('returns null for whitespace-only string', () => {
    expect(parseCSVAmount('   ')).toBeNull();
  });

  test('rounds decimal amounts', () => {
    // Korean Won amounts are always integers — rounding prevents off-by-1 errors
    expect(parseCSVAmount('5500.7')).toBe(5501);
    expect(parseCSVAmount('5500.3')).toBe(5500);
  });

  test('handles amount with internal whitespace', () => {
    expect(parseCSVAmount('1 250 000')).toBe(1250000);
  });

  test('strips Won sign before checking parenthesized negatives', () => {
    expect(parseCSVAmount('(₩5,000)')).toBe(-5000);
  });

  test('parses amount without thousands separator', () => {
    expect(parseCSVAmount('125000')).toBe(125000);
  });

  // C32-05: "마이너스" prefix handling
  test('parses "마이너스 5000" as negative amount', () => {
    expect(parseCSVAmount('마이너스5000')).toBe(-5000);
  });

  test('parses "마이너스 1,234" with comma separator', () => {
    expect(parseCSVAmount('마이너스1,234')).toBe(-1234);
  });

  test('parses "마이너스 6,500원" with Won suffix', () => {
    expect(parseCSVAmount('마이너스6,500원')).toBe(-6500);
  });

  test('parses "마이너스₩3,000" with Won sign', () => {
    expect(parseCSVAmount('마이너스₩3,000')).toBe(-3000);
  });

  test('returns null for "마이너스" alone (no digits)', () => {
    expect(parseCSVAmount('마이너스')).toBeNull();
  });

  // Cycle 47: Additional edge cases
  test('returns null for single dash "-"', () => {
    expect(parseCSVAmount('-')).toBeNull();
  });

  test('parses "0원" as zero', () => {
    expect(parseCSVAmount('0원')).toBe(0);
  });

  test('parses "-0" as -0 (JavaScript -0 semantics, filtered by isValidCSVAmount)', () => {
    // parseFloat('-0') returns -0 in JS. This is filtered out by isValidCSVAmount
    // which checks amount <= 0 (and -0 <= 0 is true).
    const amount = parseCSVAmount('-0');
    expect(Object.is(amount, -0)).toBe(true);
  });

  test('parses Won sign with spaces "₩ 6,500"', () => {
    expect(parseCSVAmount('₩ 6,500')).toBe(6500);
  });

  test('parses Won sign with spaces and 원 "₩ 6,500 원"', () => {
    expect(parseCSVAmount('₩ 6,500 원')).toBe(6500);
  });

  test('returns null for just "원"', () => {
    expect(parseCSVAmount('원')).toBeNull();
  });

  test('returns null for just Won sign "₩"', () => {
    expect(parseCSVAmount('₩')).toBeNull();
  });

  test('parses negative with Won sign "-₩5,000"', () => {
    expect(parseCSVAmount('-₩5,000')).toBe(-5000);
  });

  test('parses parenthesized negative with Won sign "(₩5,000)"', () => {
    expect(parseCSVAmount('(₩5,000)')).toBe(-5000);
  });

  test('parses "0" as zero', () => {
    expect(parseCSVAmount('0')).toBe(0);
  });

  test('handles "( 5,000 )" with spaces inside parens', () => {
    expect(parseCSVAmount('( 5,000 )')).toBe(-5000);
  });

  // C53-01: Full-width digit and comma normalization
  test('parses full-width digits "１２３４" as 1234', () => {
    expect(parseCSVAmount('１２３４')).toBe(1234);
  });

  test('parses full-width digits with full-width comma "１，２３４"', () => {
    expect(parseCSVAmount('１，２３４')).toBe(1234);
  });

  test('parses full-width amount with Won suffix "１，２３４원"', () => {
    expect(parseCSVAmount('１，２３４원')).toBe(1234);
  });

  test('parses full-width amount with Won sign "₩１，２３４"', () => {
    expect(parseCSVAmount('₩１，２３４')).toBe(1234);
  });

  test('parses full-width negative with minus "－１，２３４"', () => {
    expect(parseCSVAmount('－１，２３４')).toBe(-1234);
  });

  test('parses mixed full-width and ASCII digits "１234"', () => {
    expect(parseCSVAmount('１234')).toBe(1234);
  });

  test('parses parenthesized full-width negative "（１，２３４）"', () => {
    expect(parseCSVAmount('（１，２３４）')).toBe(-1234);
  });

  // C68-01: Trailing minus sign for negative amounts
  test('parses trailing-minus amount "1,234-" as -1234', () => {
    expect(parseCSVAmount('1,234-')).toBe(-1234);
  });

  test('parses trailing-minus amount "5000-" as -5000', () => {
    expect(parseCSVAmount('5000-')).toBe(-5000);
  });

  test('parses trailing-minus with comma "6,500-" as -6500', () => {
    expect(parseCSVAmount('6,500-')).toBe(-6500);
  });

  test('parses trailing-minus with KRW prefix "KRW 10,000-" as -10000', () => {
    expect(parseCSVAmount('KRW 10,000-')).toBe(-10000);
  });

  test('parses trailing-minus with Won sign "₩3,000-" as -3000', () => {
    expect(parseCSVAmount('₩3,000-')).toBe(-3000);
  });
});

// ---------------------------------------------------------------------------
// isValidCSVAmount — amount validation type guard
// ---------------------------------------------------------------------------

describe('isValidCSVAmount', () => {
  test('returns true for positive amount', () => {
    const errors: { line?: number; message: string }[] = [];
    expect(isValidCSVAmount(5500, '5500', 0, errors)).toBe(true);
  });

  test('returns false for null amount and pushes error', () => {
    const errors: { line?: number; message: string }[] = [];
    expect(isValidCSVAmount(null, 'bad', 5, errors)).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.line).toBe(6);
  });

  test('returns false for null amount with empty raw (no error pushed)', () => {
    const errors: { line?: number; message: string }[] = [];
    expect(isValidCSVAmount(null, '', 0, errors)).toBe(false);
    expect(errors).toHaveLength(0);
  });

  test('returns false for zero amount (no error pushed)', () => {
    const errors: { line?: number; message: string }[] = [];
    expect(isValidCSVAmount(0, '0', 0, errors)).toBe(false);
    expect(errors).toHaveLength(0);
  });

  test('returns false for negative amount (no error pushed)', () => {
    const errors: { line?: number; message: string }[] = [];
    expect(isValidCSVAmount(-5000, '-5000', 0, errors)).toBe(false);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseCSVInstallments — installment value parser
// ---------------------------------------------------------------------------

describe('parseCSVInstallments', () => {
  test('returns undefined for undefined input', () => {
    expect(parseCSVInstallments(undefined)).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(parseCSVInstallments('')).toBeUndefined();
  });

  test('returns undefined for "0" (lump sum)', () => {
    expect(parseCSVInstallments('0')).toBeUndefined();
  });

  test('returns undefined for "1" (single payment)', () => {
    expect(parseCSVInstallments('1')).toBeUndefined();
  });

  test('returns installment count for multi-month', () => {
    expect(parseCSVInstallments('3')).toBe(3);
    expect(parseCSVInstallments('6')).toBe(6);
    expect(parseCSVInstallments('12')).toBe(12);
  });

  test('returns undefined for Korean lump-sum text', () => {
    expect(parseCSVInstallments('일시불')).toBeUndefined();
  });

  test('returns undefined for non-numeric text', () => {
    expect(parseCSVInstallments('할부')).toBeUndefined();
  });

  test('parses numeric value from string with suffix', () => {
    expect(parseCSVInstallments('3개월')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// normalizeHeader — header string normalization (C11-03)
// ---------------------------------------------------------------------------

describe('normalizeHeader', () => {
  test('strips zero-width space U+200B', () => {
    // "이​용​일" should normalize to "이용일"
    expect(normalizeHeader('이​용​일')).toBe('이용일');
  });

  test('strips zero-width non-joiner U+200C', () => {
    expect(normalizeHeader('이‌용‌일')).toBe('이용일');
  });

  test('strips zero-width joiner U+200D', () => {
    expect(normalizeHeader('이‍용‍일')).toBe('이용일');
  });

  test('strips soft hyphen U+00AD', () => {
    expect(normalizeHeader('이­용­일')).toBe('이용일');
  });

  test('strips zero-width space and still removes parenthetical suffix', () => {
    expect(normalizeHeader('이​용​금​액(원)')).toBe('이용금액');
  });

  test('matches column pattern after zero-width space removal', () => {
    const normalized = normalizeHeader('이​용​일');
    expect(DATE_COLUMN_PATTERN.test(normalized)).toBe(true);
  });

  test('findColumn finds header with zero-width spaces', () => {
    const headers = ['이​용​일', '가맹점명', '이​용​금​액'];
    const dateIdx = findColumn(headers, '이용일', DATE_COLUMN_PATTERN);
    expect(dateIdx).toBe(0);
  });

  test('isValidHeaderRow accepts headers with zero-width spaces', () => {
    const cells = ['이​용​일', '가맹점​명', '이​용​금​액'];
    expect(isValidHeaderRow(cells)).toBe(true);
  });

  // C13-03: Fullwidth space (U+3000) handling

  test('strips fullwidth space U+3000', () => {
    expect(normalizeHeader('이용　일')).toBe('이용일');
  });

  test('strips fullwidth space and still removes parenthetical suffix', () => {
    expect(normalizeHeader('이용　금액(원)')).toBe('이용금액');
  });

  test('findColumn finds header with fullwidth spaces', () => {
    const headers = ['이용　일', '가맹점명', '이용　금액'];
    const dateIdx = findColumn(headers, '이용일', DATE_COLUMN_PATTERN);
    expect(dateIdx).toBe(0);
  });

  test('isValidHeaderRow accepts headers with fullwidth spaces', () => {
    const cells = ['이용　일', '가맹점　명', '이용　금액'];
    expect(isValidHeaderRow(cells)).toBe(true);
  });

  // C32-04: Directional formatting characters
  test('strips LEFT-TO-RIGHT MARK U+200E', () => {
    expect(normalizeHeader('‎이용일‎')).toBe('이용일');
  });

  test('strips RIGHT-TO-LEFT MARK U+200F', () => {
    expect(normalizeHeader('‏이용일‏')).toBe('이용일');
  });

  test('strips LEFT-TO-RIGHT EMBEDDING U+202A', () => {
    expect(normalizeHeader('‪이용일‬')).toBe('이용일');
  });

  test('strips RIGHT-TO-LEFT OVERRIDE U+202E', () => {
    expect(normalizeHeader('‮이용일‬')).toBe('이용일');
  });

  test('strips BOM U+FEFF mid-string', () => {
    expect(normalizeHeader('이용﻿일')).toBe('이용일');
  });

  test('findColumn finds header with directional chars', () => {
    const headers = ['‎이용일‏', '가맹점명', '이용금액'];
    const dateIdx = findColumn(headers, '이용일', DATE_COLUMN_PATTERN);
    expect(dateIdx).toBe(0);
  });

  test('isValidHeaderRow accepts headers with directional chars', () => {
    const cells = ['‎이용일', '가맹점명', '‪이용금액'];
    expect(isValidHeaderRow(cells)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// C56-01: KRW currency prefix support
// ---------------------------------------------------------------------------

describe('parseCSVAmount - KRW prefix (C56-01)', () => {
  test('parses KRW 10,000 with space', () => {
    expect(parseCSVAmount('KRW 10,000')).toBe(10000);
  });

  test('parses KRW10,000 without space', () => {
    expect(parseCSVAmount('KRW10,000')).toBe(10000);
  });

  test('parses lowercase krw 5,000', () => {
    expect(parseCSVAmount('krw 5,000')).toBe(5000);
  });

  test('parses KRW 100,000원', () => {
    expect(parseCSVAmount('KRW 100,000원')).toBe(100000);
  });

  test('parses KRW 1,234,567', () => {
    expect(parseCSVAmount('KRW 1,234,567')).toBe(1234567);
  });

  test('returns null for empty string (C56-04 early return)', () => {
    expect(parseCSVAmount('')).toBeNull();
  });

  test('returns null for whitespace-only string (C56-04 early return)', () => {
    expect(parseCSVAmount('   ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseCSVAmount — leading plus sign (C66-02)
// ---------------------------------------------------------------------------

describe('parseCSVAmount - leading plus sign (C66-02)', () => {
  test('strips leading + from positive amount', () => {
    expect(parseCSVAmount('+5500')).toBe(5500);
  });

  test('strips leading + with comma separator', () => {
    expect(parseCSVAmount('+12,345')).toBe(12345);
  });

  test('strips leading + with Won sign', () => {
    expect(parseCSVAmount('+₩12,345')).toBe(12345);
  });

  test('strips leading + with KRW prefix', () => {
    expect(parseCSVAmount('+KRW 10,000')).toBe(10000);
  });

  test('strips leading + with Won suffix', () => {
    expect(parseCSVAmount('+6,500원')).toBe(6500);
  });

  test('strips leading + with fullwidth plus and Won sign', () => {
    expect(parseCSVAmount('+₩30,000')).toBe(30000);
  });
});

// ---------------------------------------------------------------------------
// splitCSVContent — multi-line quoted field support (C66-01)
// ---------------------------------------------------------------------------

describe('splitCSVContent - multi-line quoted fields (C66-01)', () => {
  test('handles simple single-line content', () => {
    const content = 'a,b,c\nd,e,f';
    expect(splitCSVContent(content, ',')).toEqual(['a,b,c', 'd,e,f']);
  });

  test('handles multi-line quoted field', () => {
    const content = '1,"hello\nworld",3\n4,5,6';
    const result = splitCSVContent(content, ',');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('1,"hello\nworld",3');
    expect(result[1]).toBe('4,5,6');
  });

  test('handles multi-line quoted field spanning 3 lines', () => {
    const content = '1,"line1\nline2\nline3",3\n4,5,6';
    const result = splitCSVContent(content, ',');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('1,"line1\nline2\nline3",3');
  });

  test('handles CRLF line endings', () => {
    const content = 'a,b,c\r\nd,e,f\r\n';
    expect(splitCSVContent(content, ',')).toEqual(['a,b,c', 'd,e,f']);
  });

  test('handles CRLF inside quoted field', () => {
    const content = '1,"hello\r\nworld",3\r\n4,5,6';
    const result = splitCSVContent(content, ',');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('1,"hello\nworld",3');
  });

  test('filters empty lines', () => {
    const content = 'a,b\n\n\nc,d';
    expect(splitCSVContent(content, ',')).toEqual(['a,b', 'c,d']);
  });

  test('handles Korean merchant with embedded newline', () => {
    const content = '2024-01-15,"스타벅스\n강남점",5500\n2024-01-16,카페,3000';
    const result = splitCSVContent(content, ',');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('2024-01-15,"스타벅스\n강남점",5500');
  });

  test('handles doubled-quote escapes within multi-line field', () => {
    const content = '1,"say ""hello""\nworld",3\n4,5,6';
    const result = splitCSVContent(content, ',');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('1,"say ""hello""\nworld",3');
  });

  test('handles tab delimiter with multi-line field', () => {
    const content = '1\t"hello\nworld"\t3\n4\t5\t6';
    const result = splitCSVContent(content, '\t');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('1\t"hello\nworld"\t3');
  });

  test('handles file with no multi-line fields (normal CSV)', () => {
    const content = '이용일,이용처,이용금액\n2024-01-15,스타벅스,5500\n2024-01-16,카페,3000';
    const result = splitCSVContent(content, ',');
    expect(result).toHaveLength(3);
  });

  test('handles empty content', () => {
    expect(splitCSVContent('', ',')).toEqual([]);
  });

  test('handles content with only whitespace lines', () => {
    expect(splitCSVContent('  \n  \n', ',')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SUMMARY_ROW_PATTERN — subtotal English keyword (C66-04)
// ---------------------------------------------------------------------------

describe('SUMMARY_ROW_PATTERN - subtotal keyword (C66-04)', () => {
  test('matches "subtotal" English keyword', () => {
    const { SUMMARY_ROW_PATTERN } = require('../src/csv/column-matcher.js');
    expect(SUMMARY_ROW_PATTERN.test('subtotal 12,345')).toBe(true);
  });

  test('matches "Subtotal" case-insensitively', () => {
    const { SUMMARY_ROW_PATTERN } = require('../src/csv/column-matcher.js');
    expect(SUMMARY_ROW_PATTERN.test('Subtotal 12,345')).toBe(true);
  });

  test('does not match "subtotal" inside merchant name', () => {
    const { SUMMARY_ROW_PATTERN } = require('../src/csv/column-matcher.js');
    expect(SUMMARY_ROW_PATTERN.test('SUBTOTALSHOES STORE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseCSVAmount — space before 원 (C72-01)
// ---------------------------------------------------------------------------

describe('parseCSVAmount - space before 원 (C72-01)', () => {
  test('parses "1,234 원" with space before Won sign', () => {
    expect(parseCSVAmount('1,234 원')).toBe(1234);
  });

  test('parses "10,000 원" with space before Won sign', () => {
    expect(parseCSVAmount('10,000 원')).toBe(10000);
  });

  test('parses "₩1,234 원" with Won sign and space before 원', () => {
    expect(parseCSVAmount('₩1,234 원')).toBe(1234);
  });

  test('parses negative "(1,234 원)" with parenthesized format', () => {
    expect(parseCSVAmount('(1,234 원)')).toBe(-1234);
  });

  test('parses "KRW10,000 원" with space before Won sign', () => {
    expect(parseCSVAmount('KRW10,000 원')).toBe(10000);
  });

  test('parses "10000 원" bare integer with space before Won sign', () => {
    expect(parseCSVAmount('10000 원')).toBe(10000);
  });
});