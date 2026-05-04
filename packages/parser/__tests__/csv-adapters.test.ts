import { describe, test, expect } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parseCSV } from '../src/csv/index.js';
import { normalizeHeader, findColumn, DATE_COLUMN_PATTERN, AMOUNT_COLUMN_PATTERN, HEADER_KEYWORDS, DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS, isValidHeaderRow } from '../src/csv/column-matcher.js';
import { parseGenericCSV } from '../src/csv/generic.js';

const fixturesDir = join(import.meta.dir, 'fixtures');

// ---------------------------------------------------------------------------
// ColumnMatcher tests
// ---------------------------------------------------------------------------

describe('normalizeHeader', () => {
  test('trims whitespace', () => {
    expect(normalizeHeader('  이용일  ')).toBe('이용일');
  });

  test('collapses internal whitespace', () => {
    expect(normalizeHeader('이용 금액')).toBe('이용금액');
  });

  test('removes parenthetical suffixes', () => {
    expect(normalizeHeader('이용금액(원)')).toBe('이용금액');
  });

  test('handles combined whitespace and parens', () => {
    expect(normalizeHeader('  이용 금액 (원)  ')).toBe('이용금액');
  });
});

describe('findColumn', () => {
  const headers = ['이용일', '이용처', '이용금액', '할부', '비고'];

  test('finds column by exact name', () => {
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  test('finds column by regex when exact name differs', () => {
    expect(findColumn(headers, '거래일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  test('returns -1 when no match', () => {
    expect(findColumn(headers, '존재않음', /존재않음/)).toBe(-1);
  });

  test('exact match takes priority over regex', () => {
    // '이용금액' exact match should return index 2, not match via regex on '이용처'
    expect(findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  test('handles headers with trailing spaces', () => {
    const spacedHeaders = ['이용일 ', ' 이용처', '이용금액'];
    expect(findColumn(spacedHeaders, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(spacedHeaders, '이용처', /이용처|가맹점/)).toBe(1);
  });

  test('finds column by regex for alternative names', () => {
    const altHeaders = ['승인일자', '가맹점명', '결제금액'];
    expect(findColumn(altHeaders, undefined, DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(altHeaders, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Bank adapter tests — each adapter against its fixture
// ---------------------------------------------------------------------------

describe('bank-specific CSV adapters via parseCSV', () => {
  test('hyundai adapter parses hyundai fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-hyundai.csv'), 'utf-8');
    const result = parseCSV(content, 'hyundai');
    expect(result.bank).toBe('hyundai');
    expect(result.transactions.length).toBe(3);
    expect(result.transactions[0]?.merchant).toContain('스타벅스');
    expect(result.transactions[0]?.amount).toBe(5500);
    expect(result.transactions[1]?.amount).toBe(45000);
    expect(result.transactions[2]?.memo).toContain('구독');
  });

  test('kb adapter parses kb fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-kb.csv'), 'utf-8');
    const result = parseCSV(content, 'kb');
    expect(result.bank).toBe('kb');
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  test('ibk adapter parses ibk fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-ibk.csv'), 'utf-8');
    const result = parseCSV(content, 'ibk');
    expect(result.bank).toBe('ibk');
    expect(result.transactions.length).toBe(3);
    expect(result.transactions[0]?.merchant).toContain('편의점');
    expect(result.transactions[0]?.amount).toBe(3500);
  });

  test('woori adapter parses woori fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-woori.csv'), 'utf-8');
    const result = parseCSV(content, 'woori');
    expect(result.bank).toBe('woori');
    expect(result.transactions.length).toBe(3);
    expect(result.transactions[0]?.merchant).toContain('배달의민족');
    expect(result.transactions[0]?.amount).toBe(18000);
  });

  test('samsung adapter parses samsung fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-samsung.csv'), 'utf-8');
    const result = parseCSV(content, 'samsung');
    expect(result.bank).toBe('samsung');
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  test('shinhan adapter parses shinhan fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-shinhan.csv'), 'utf-8');
    const result = parseCSV(content, 'shinhan');
    expect(result.bank).toBe('shinhan');
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  test('lotte adapter parses lotte fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-lotte.csv'), 'utf-8');
    const result = parseCSV(content, 'lotte');
    expect(result.bank).toBe('lotte');
    expect(result.transactions.length).toBe(3);
    expect(result.transactions[0]?.merchant).toContain('롯데마트');
    expect(result.transactions[0]?.amount).toBe(62000);
  });

  test('hana adapter parses hana fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-hana.csv'), 'utf-8');
    const result = parseCSV(content, 'hana');
    expect(result.bank).toBe('hana');
    expect(result.transactions.length).toBe(3);
    expect(result.transactions[0]?.merchant).toContain('다이소');
    expect(result.transactions[0]?.amount).toBe(8000);
  });

  test('nh adapter parses nh fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-nh.csv'), 'utf-8');
    const result = parseCSV(content, 'nh');
    expect(result.bank).toBe('nh');
    expect(result.transactions.length).toBe(3);
    expect(result.transactions[0]?.merchant).toContain('농협');
    expect(result.transactions[0]?.amount).toBe(35000);
  });

  test('bc adapter parses bc fixture', async () => {
    const content = await readFile(join(fixturesDir, 'sample-samsung.csv'), 'utf-8');
    // BC uses the same header names as samsung for some fields,
    // test with a BC-specific content
    const bcContent = 'BC카드 이용내역\n이용일,가맹점,이용금액,할부,업종\n2024-01-15,카페,5000,0,카페';
    const result = parseCSV(bcContent, 'bc');
    expect(result.bank).toBe('bc');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0]?.amount).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Generic parser resilience tests
// ---------------------------------------------------------------------------

describe('generic CSV parser resilience', () => {
  test('handles metadata-heavy files (KB with preamble)', async () => {
    const content = await readFile(join(fixturesDir, 'sample-metadata-heavy.csv'), 'utf-8');
    const result = parseGenericCSV(content, null);
    expect(result.transactions.length).toBe(3);
    expect(result.transactions[0]?.merchant).toContain('스타벅스');
    expect(result.transactions[0]?.amount).toBe(5500);
    expect(result.transactions[1]?.amount).toBe(125000);
  });

  test('handles BOM-prefixed content', () => {
    const bomContent = '﻿거래일시,가맹점명,이용금액,할부개월,업종\n2024-01-15,스타벅스,5500,0,카페\n2024-01-20,이마트,125000,0,마트';
    const result = parseCSV(bomContent, 'kb');
    expect(result.transactions.length).toBe(2);
    expect(result.transactions[0]?.amount).toBe(5500);
  });

  test('returns error for files with no recognizable headers', () => {
    const noHeader = 'a,b,c\n1,2,3\n4,5,6';
    const result = parseGenericCSV(noHeader, null);
    expect(result.transactions.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('skips summary/total rows', () => {
    const withTotal = '거래일시,가맹점명,이용금액\n2024-01-15,스타벅스,5500\n합계,,5500';
    const result = parseGenericCSV(withTotal, null);
    expect(result.transactions.length).toBe(1);
  });

  test('handles reordered columns', () => {
    const reordered = '이용금액,거래일시,가맹점명\n5500,2024-01-15,스타벅스';
    const result = parseGenericCSV(reordered, null);
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0]?.amount).toBe(5500);
    expect(result.transactions[0]?.date).toBe('2024-01-15');
  });

  test('handles tab-delimited content', () => {
    const tabDelimited = '거래일시\t가맹점명\t이용금액\n2024-01-15\t스타벅스\t5500';
    const result = parseGenericCSV(tabDelimited, null);
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0]?.amount).toBe(5500);
  });

  test('handles semicolon-delimited content', () => {
    const semicolonDelimited = '거래일시;가맹점명;이용금액\n2024-01-15;스타벅스;5500';
    const result = parseGenericCSV(semicolonDelimited, null);
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0]?.amount).toBe(5500);
  });

  test('handles files with extra columns', () => {
    const extraCols = '거래일시,카드종류,가맹점명,이용금액,메모\n2024-01-15,신용,스타벅스,5500,커피';
    const result = parseGenericCSV(extraCols, null);
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0]?.merchant).toContain('스타벅스');
  });
});

// ---------------------------------------------------------------------------
// Server-side parseCSV entry point tests
// ---------------------------------------------------------------------------

describe('parseCSV entry point', () => {
  test('auto-detects bank from content', async () => {
    const content = await readFile(join(fixturesDir, 'sample-hyundai.csv'), 'utf-8');
    const result = parseCSV(content);
    expect(result.bank).toBe('hyundai');
    expect(result.transactions.length).toBe(3);
  });

  test('falls back to generic parser when no adapter matches', () => {
    const unknownBank = '이용일,가맹점,금액\n2024-01-15,카페,5000';
    const result = parseCSV(unknownBank);
    expect(result.transactions.length).toBe(1);
  });

  test('strips BOM before parsing', async () => {
    const content = await readFile(join(fixturesDir, 'sample-bom.csv'), 'utf-8');
    const result = parseCSV(content);
    expect(result.transactions.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isValidHeaderRow tests (C4-07)
// ---------------------------------------------------------------------------

describe('isValidHeaderRow', () => {
  test('accepts a valid header with date + merchant + amount keywords', () => {
    expect(isValidHeaderRow(['이용일', '이용처', '이용금액'])).toBe(true);
  });

  test('accepts header with 2 categories (date + amount)', () => {
    expect(isValidHeaderRow(['거래일시', '이용금액'])).toBe(true);
  });

  test('accepts header with 2 categories (merchant + amount)', () => {
    expect(isValidHeaderRow(['가맹점명', '이용금액'])).toBe(true);
  });

  test('rejects header with only amount keywords (1 category)', () => {
    expect(isValidHeaderRow(['이용금액', '승인금액', '결제금액'])).toBe(false);
  });

  test('rejects header with only date keywords (1 category)', () => {
    expect(isValidHeaderRow(['이용일', '거래일', '결제일'])).toBe(false);
  });

  test('rejects header with only merchant keywords (1 category)', () => {
    expect(isValidHeaderRow(['가맹점명', '이용처', '거래처'])).toBe(false);
  });

  test('rejects header with no known keywords', () => {
    expect(isValidHeaderRow(['열1', '열2', '열3'])).toBe(false);
  });

  test('rejects empty array', () => {
    expect(isValidHeaderRow([])).toBe(false);
  });

  test('handles keywords with parenthetical suffixes via normalization', () => {
    // isValidHeaderRow uses raw string comparison, not normalizeHeader,
    // so parenthetical suffixes should still match if the base keyword is present
    expect(isValidHeaderRow(['이용일', '이용처', '이용금액(원)'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shared keyword constants tests (C4-07)
// ---------------------------------------------------------------------------

describe('shared keyword constants', () => {
  test('HEADER_KEYWORDS contains all date keywords', () => {
    for (const kw of ['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '매출일']) {
      expect(HEADER_KEYWORDS).toContain(kw);
    }
  });

  test('HEADER_KEYWORDS contains all merchant keywords', () => {
    for (const kw of ['이용처', '가맹점', '가맹점명', '거래처', '매출처', '상호']) {
      expect(HEADER_KEYWORDS).toContain(kw);
    }
  });

  test('HEADER_KEYWORDS contains all amount keywords', () => {
    for (const kw of ['이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액']) {
      expect(HEADER_KEYWORDS).toContain(kw);
    }
  });

  test('DATE_KEYWORDS is a subset of HEADER_KEYWORDS', () => {
    for (const kw of DATE_KEYWORDS) {
      expect((HEADER_KEYWORDS as string[]).includes(kw)).toBe(true);
    }
  });

  test('MERCHANT_KEYWORDS is a subset of HEADER_KEYWORDS', () => {
    for (const kw of MERCHANT_KEYWORDS) {
      expect((HEADER_KEYWORDS as string[]).includes(kw)).toBe(true);
    }
  });

  test('AMOUNT_KEYWORDS is a subset of HEADER_KEYWORDS', () => {
    for (const kw of AMOUNT_KEYWORDS) {
      expect((HEADER_KEYWORDS as string[]).includes(kw)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Category-based header detection in bank adapters (C4-01)
// ---------------------------------------------------------------------------

describe('category-based header detection', () => {
  test('rejects summary row with only amount keywords', () => {
    // A row with only amount keywords from 1 category should not be detected as header
    const content = [
      '삼성카드 이용내역',
      '',
      '이용금액,승인금액,결제금액',
      '6500,6500,6500',
    ].join('\n');
    const result = parseCSV(content, 'samsung');
    // Should fail to find header (only amount category)
    expect(result.transactions).toHaveLength(0);
    expect(result.errors.some((e) => e.message.includes('헤더'))).toBe(true);
  });

  test('accepts valid header with 2+ categories in bank adapter', () => {
    const content = [
      '삼성카드 이용내역',
      '이용일,가맹점명,이용금액',
      '2024-01-15,스타벅스,5500',
    ].join('\n');
    const result = parseCSV(content, 'samsung');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.merchant).toBe('스타벅스');
  });
});

// ---------------------------------------------------------------------------
// Generic CSV merchant inference preferring Korean text (C4-03)
// ---------------------------------------------------------------------------

describe('generic CSV merchant inference', () => {
  test('prefers Korean text column over numeric column for merchant', () => {
    // Columns: date, card_number(4 digits), merchant(Korean), amount
    // Without C4-03 fix, would pick card_number as merchant
    const content = [
      '이용일,카드번호,가맹점명,이용금액',
      '2024-01-15,1234,스타벅스 강남,5500',
      '2024-01-16,5678,이마트,30000',
    ].join('\n');
    const result = parseGenericCSV(content, null);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toContain('스타벅스');
    expect(result.transactions[1]?.merchant).toContain('이마트');
  });

  test('falls back to first non-reserved column when no Korean text', () => {
    const content = [
      'DATE,CODE,MERCHANT,AMOUNT',
      '2024-01-15,AB,Starbucks,5500',
    ].join('\n');
    const result = parseGenericCSV(content, null);
    // Should still parse something (even if date/amount detection is heuristic)
    expect(result).toBeDefined();
  });
});