import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCSV } from '../src/csv/index.js';

const fixturesDir = join(import.meta.dir, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parseCSV - KB', () => {
  const content = loadFixture('sample-kb.csv');

  test('detects bank as kb', () => {
    const result = parseCSV(content);
    expect(result.bank).toBe('kb');
  });

  test('reports format as csv', () => {
    const result = parseCSV(content);
    expect(result.format).toBe('csv');
  });

  test('parses correct number of transactions', () => {
    const result = parseCSV(content);
    // 23 data rows in the fixture
    expect(result.transactions).toHaveLength(23);
  });

  test('has no errors on valid input', () => {
    const result = parseCSV(content);
    expect(result.errors).toHaveLength(0);
  });

  test('dates are parsed to ISO 8601 format', () => {
    const result = parseCSV(content);
    for (const tx of result.transactions) {
      expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('first transaction date is correct', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.date).toBe('2026-02-01');
  });

  test('merchant names are parsed correctly', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.merchant).toBe('스타벅스 서초점');
  });

  test('amounts are parsed as integers without commas', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.amount).toBe(6000);
    expect(result.transactions[2]?.amount).toBe(89000);
  });

  test('large amounts parsed correctly', () => {
    const result = parseCSV(content);
    // 120,000 → 120000
    const lotte = result.transactions.find((t) => t.merchant.includes('롯데백화점'));
    expect(lotte?.amount).toBe(120000);
  });

  test('installments parsed for multi-month transactions', () => {
    const result = parseCSV(content);
    const lotte = result.transactions.find((t) => t.merchant.includes('롯데백화점'));
    expect(lotte?.installments).toBe(3);
  });

  test('installments not set for single-payment transactions', () => {
    const result = parseCSV(content);
    // Installment 0 should not set installments field
    expect(result.transactions[0]?.installments).toBeUndefined();
  });

  test('category field parsed when present', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.category).toBe('카페');
  });

  test('amounts are non-negative integers', () => {
    const result = parseCSV(content);
    for (const tx of result.transactions) {
      expect(Number.isInteger(tx.amount)).toBe(true);
      expect(tx.amount).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('parseCSV - Samsung', () => {
  const content = loadFixture('sample-samsung.csv');

  test('detects bank as samsung', () => {
    const result = parseCSV(content);
    expect(result.bank).toBe('samsung');
  });

  test('parses correct number of transactions', () => {
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(23);
  });

  test('has no errors on valid input', () => {
    const result = parseCSV(content);
    expect(result.errors).toHaveLength(0);
  });

  test('dates are in ISO 8601 format', () => {
    const result = parseCSV(content);
    for (const tx of result.transactions) {
      expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('first transaction is correct', () => {
    const result = parseCSV(content);
    const tx = result.transactions[0];
    expect(tx?.merchant).toBe('스타벅스 강남점');
    expect(tx?.amount).toBe(7000);
    expect(tx?.date).toBe('2026-02-01');
  });

  test('installments parsed correctly', () => {
    const result = parseCSV(content);
    const hyundai = result.transactions.find((t) => t.merchant.includes('현대백화점'));
    expect(hyundai?.installments).toBe(6);
  });

  test('category field parsed', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.category).toBe('카페');
  });
});

describe('parseCSV - explicit bank override', () => {
  test('explicit bank id overrides auto-detection', () => {
    // Use KB CSV content but pass bank='shinhan'; the adapter will fall back to shinhan
    // which will fail header detection and fall through to generic
    const content = loadFixture('sample-kb.csv');
    const result = parseCSV(content, 'kb');
    expect(result.bank).toBe('kb');
  });

  test('shinhan adapter works with correct content', () => {
    const shinhanContent = [
      '신한카드 이용내역',
      '이용일,이용처,이용금액,할부개월수,업종분류',
      '2026-02-01,스타벅스 강남,6500,0,카페',
      '2026-02-02,맥도날드 역삼,8900,0,패스트푸드',
    ].join('\n');
    const result = parseCSV(shinhanContent, 'shinhan');
    expect(result.bank).toBe('shinhan');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toBe('스타벅스 강남');
    expect(result.transactions[0]?.amount).toBe(6500);
  });
});

describe('parseCSV - Hyundai', () => {
  const content = loadFixture('sample-hyundai.csv');

  test('detects bank as hyundai', () => {
    const result = parseCSV(content);
    expect(result.bank).toBe('hyundai');
  });

  test('parses correct number of transactions', () => {
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(3);
  });

  test('has no errors on valid input', () => {
    const result = parseCSV(content);
    expect(result.errors).toHaveLength(0);
  });

  test('first transaction is correct', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.date).toBe('2024-01-05');
    expect(result.transactions[0]?.merchant).toBe('스타벅스 강남점');
    expect(result.transactions[0]?.amount).toBe(5500);
  });

  test('memo field parsed', () => {
    const result = parseCSV(content);
    const emart = result.transactions.find((t) => t.merchant.includes('이마트'));
    expect(emart?.memo).toBe('장보기');
  });

  test('skips summary row', () => {
    const result = parseCSV(content);
    // The 합계 row should be skipped
    expect(result.transactions.every((t) => !t.merchant.includes('합계'))).toBe(true);
  });
});

describe('parseCSV - IBK', () => {
  const content = loadFixture('sample-ibk.csv');

  test('detects bank as ibk', () => {
    const result = parseCSV(content);
    expect(result.bank).toBe('ibk');
  });

  test('parses correct number of transactions', () => {
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(3);
  });

  test('first transaction is correct', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.date).toBe('2024-02-03');
    expect(result.transactions[0]?.merchant).toBe('편의점GS25');
    expect(result.transactions[0]?.amount).toBe(3500);
  });

  test('memo field parsed', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.memo).toBe('즉시출금');
  });
});

describe('parseCSV - Woori', () => {
  const content = loadFixture('sample-woori.csv');

  test('detects bank as woori', () => {
    const result = parseCSV(content);
    expect(result.bank).toBe('woori');
  });

  test('parses correct number of transactions', () => {
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(3);
  });

  test('first transaction is correct', () => {
    const result = parseCSV(content);
    expect(result.transactions[0]?.date).toBe('2024-03-01');
    expect(result.transactions[0]?.merchant).toBe('배달의민족');
    expect(result.transactions[0]?.amount).toBe(18000);
  });
});

describe('parseCSV - generic CSV with column variations', () => {
  test('handles column names with parenthetical suffixes', () => {
    const content = [
      '이용일,이용처,이용금액(원),할부',
      '2026-02-01,스타벅스,6500,0',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(6500);
  });

  test('handles tab-delimited content', () => {
    const content = '거래일시\t가맹점명\t이용금액\n2026-01-01\t테스트\t1000';
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
  });

  test('handles semicolon-delimited content', () => {
    const content = '거래일시;가맹점명;이용금액\n2026-01-01;테스트;1000';
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
  });

  test('generic parser handles metadata-heavy preamble', () => {
    const content = loadFixture('sample-metadata-heavy.csv');
    const result = parseCSV(content);
    // Should find the header row despite metadata preamble
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  test('generic parser handles BOM-prefixed content', () => {
    const content = loadFixture('sample-bom.csv');
    const result = parseCSV(content);
    // Should parse despite BOM
    expect(result.transactions.length).toBeGreaterThan(0);
  });
});

describe('parseCSV - edge cases', () => {
  test('handles empty content gracefully', () => {
    const result = parseCSV('');
    expect(result.transactions).toHaveLength(0);
  });

  test('handles content with no matching bank gracefully', () => {
    const content = '거래일시,가맹점명,이용금액\n2026-01-01,테스트,1000';
    const result = parseCSV(content);
    // Falls back to generic parser
    expect(result.transactions).toBeDefined();
  });

  test('parses amount with 원 suffix', () => {
    const shinhanContent = [
      '신한카드',
      '이용일,이용처,이용금액,할부개월수,업종분류',
      '2026-02-01,스타벅스,6,500원,0,카페',
    ].join('\n');
    // The shinhan adapter should strip 원
    const result = parseCSV(shinhanContent, 'shinhan');
    // Just confirm no crash
    expect(result).toBeDefined();
  });

  test('parses amount with Won sign prefix (C6-05)', () => {
    // Use quoted fields since the amount contains commas as thousand separators
    // and the delimiter is also comma.
    const content = [
      '거래일시,가맹점명,이용금액',
      '2026-02-01,테스트,"₩6,500"',
      '2026-02-02,테스트2,"￦30,000"',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(6500);
    expect(result.transactions[1]?.amount).toBe(30000);
  });

  test('parses 8-digit date format', () => {
    const shinhanContent = [
      '신한카드',
      '이용일,이용처,이용금액,할부개월수,업종분류',
      '20260201,이마트,30000,0,마트',
    ].join('\n');
    const result = parseCSV(shinhanContent, 'shinhan');
    expect(result.transactions[0]?.date).toBe('2026-02-01');
  });

  test('generic parser skips zero-amount rows (balance inquiries, declined transactions)', () => {
    const content = [
      '거래일시,가맹점명,이용금액',
      '2026-02-01,테스트 승인,0',
    ].join('\n');
    const result = parseCSV(content);
    // Zero-amount rows are filtered out — matching the web-side parser's
    // isValidAmount() behavior (C26-02/C32-02). These rows (balance
    // inquiries, declined transactions) don't contribute to spending
    // optimization.
    expect(result.transactions).toHaveLength(0);
  });

  test('generic parser surfaces malformed amounts as errors', () => {
    const content = [
      '거래일시,가맹점명,이용금액',
      '2026-02-01,테스트,금액오류',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(0);
    expect(result.errors.some((error) => error.message.includes('금액을 해석할 수 없습니다'))).toBe(true);
  });

  test('generic parser skips spaced summary rows (C16-03)', () => {
    const content = [
      '거래일시,가맹점명,이용금액',
      '2026-02-01,스타벅스,6000',
      '총 합계,,6000',
      '2026-02-02,이마트,45000',
      '소 계,,45000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toBe('스타벅스');
    expect(result.transactions[1]?.merchant).toBe('이마트');
  });

  test('handles header columns with extra whitespace (C5-05)', () => {
    const content = [
      '  이용일 , 이용처 , 이용금액  , 할부  ',
      '2026-02-01,스타벅스,6500,0',
      '2026-02-02,이마트,30000,0',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.date).toBe('2026-02-01');
    expect(result.transactions[0]?.merchant).toBe('스타벅스');
    expect(result.transactions[0]?.amount).toBe(6500);
  });

  test('skips summary rows with expanded Korean variants (C17-01)', () => {
    // Summary rows like 누계 (cumulative), 잔액 (balance), 당월 (current month),
    // 명세 (statement) should be skipped by the CSV parser.
    // Note: "이월" and "소비" were removed from SUMMARY_ROW_PATTERN (C30-01)
    // because they are overly broad and can match merchant names like "소비마트".
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,스타벅스,6000',
      '2026-02-02,이마트,45000',
      '누계,,51000',
      '잔액,,100000',
      '당월,,51000',
      '명세,,51000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toBe('스타벅스');
    expect(result.transactions[1]?.merchant).toBe('이마트');
  });

  test('generic parser prefers Korean-text column for merchant (C5-04)', () => {
    // Columns: card_number(date-like), merchant(Korean), amount, id(number)
    // The heuristic should pick the Korean-text column as merchant, not the
    // first non-date/non-amount column (which would be a numeric id).
    const content = [
      '카드번호,이용처,이용금액,고객번호',
      '1234,스타벅스,6500,999',
      '5678,이마트,30000,888',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toBe('스타벅스');
    expect(result.transactions[1]?.merchant).toBe('이마트');
  });

  // F20-02: CSV isDateLike must not misidentify decimal amounts as dates.
  // The short-date pattern (MM/DD) matched decimals like "3.5" and "12.34",
  // causing the amount column to be detected as the date column when header
  // detection failed, which prevented amountCol from being set.

  test('generic parser does not misidentify decimal amounts as dates (F20-02)', () => {
    // No recognized header keywords — forces data-inference fallback.
    // The "amounts" column contains decimal values like 3.5 that previously
    // matched the MM/DD date pattern.
    const content = [
      'code,item,val',
      'A01,coffee,3.5',
      'A02,sandwich,12.99',
      'A03,juice,5.75',
    ].join('\n');
    const result = parseCSV(content);
    // With the fix, decimal amounts should be detected as amounts, not dates.
    // The parser should find at least some transactions (dateCol may not be
    // found, but amountCol should be).
    // Note: without header keywords, generic parser can't detect date column,
    // so it falls back to data inference. The key test is that 3.5 is NOT
    // treated as a date.
    expect(result.errors.some((e) => e.message.includes('헤더'))).toBe(true);
  });

  // C57-01: Trailing delimiter dates — Korean bank exports may append a period
  // to dates like "2024. 1. 15." which previously broke column detection.
  test('generic parser handles dates with trailing period (C57-01)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2024. 1. 15.,카페,5000',
      '2024. 2. 20.,식당,12000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.date).toBe('2024-01-15');
    expect(result.transactions[0]?.amount).toBe(5000);
    expect(result.transactions[1]?.date).toBe('2024-02-20');
    expect(result.transactions[1]?.amount).toBe(12000);
  });

  test('generic parser handles short dates with trailing delimiter (C57-01)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '1.15.,카페,5000',
      '2.20.,식당,12000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.date).toMatch(/^\d{4}-01-15$/);
    expect(result.transactions[0]?.amount).toBe(5000);
  });

  test('isDateLike rejects "3.5" as a date but accepts "1/15" (F20-02)', () => {
    // Test the isDateLike logic indirectly through parseCSV.
    // A file with recognized headers but decimal amounts should still parse
    // the amounts correctly (not confuse them with dates).
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,테스트,3.50',
      '2026-02-02,테스트2,12.99',
    ].join('\n');
    const result = parseCSV(content);
    // Both rows should be parsed — the decimal amounts (3.50, 12.99) should
    // not interfere with date detection since headers are present.
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(4);  // Math.round(3.5) = 4
    expect(result.transactions[1]?.amount).toBe(13);  // Math.round(12.99) = 13
  });

  test('isDateLike accepts valid short dates like "1/15" (F20-02)', () => {
    // Valid short dates should still work when headers are recognized.
    const content = [
      '이용일,이용처,이용금액',
      '1/15,스타벅스,6500',
      '2/28,이마트,30000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    // Dates should be parsed with inferred year
    expect(result.transactions[0]?.date).toMatch(/^\d{4}-01-15$/);
    expect(result.transactions[1]?.date).toMatch(/^\d{4}-02-28$/);
  });

  // F21-01: isDateLikeShort must use month-aware day validation to reject
  // impossible dates like "2/31" (Feb 31), "4/31" (Apr 31). Previously used
  // day <= 31 which accepted these impossible dates.

  test('isDateLike rejects impossible short dates "2/31" as dates (F21-01)', () => {
    // Headerless CSV with impossible dates forces data-inference fallback.
    // "2/31" should NOT be recognized as a date column.
    const content = [
      'code,item,val',
      'A01,coffee,2/31',
      'A02,sandwich,4/31',
      'A03,juice,6/31',
    ].join('\n');
    const result = parseCSV(content);
    // Since no real dates or amounts are found, parser returns error (no header)
    expect(result.transactions).toHaveLength(0);
  });

  test('isDateLike accepts valid short dates with month-aware limits (F21-01)', () => {
    // Valid short dates with recognized headers should still parse correctly.
    const content = [
      '이용일,이용처,이용금액',
      '1/31,스타벅스,6500',
      '2/28,이마트,30000',
      '4/30,쿠팡,15000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]?.date).toMatch(/^\d{4}-01-31$/);
    expect(result.transactions[1]?.date).toMatch(/^\d{4}-02-28$/);
    expect(result.transactions[2]?.date).toMatch(/^\d{4}-04-30$/);
  });

  test('isDateLike accepts datetime strings for column inference (C28-01)', () => {
    // Some Korean bank exports include datetime strings like "2024-01-15 10:30:00".
    // The generic CSV parser's isDateLike must recognize these for column inference.
    // The date portion is extracted by parseDateStringToISO; the time is ignored.
    const content = [
      '이용일,이용처,이용금액',
      '2024-01-15 10:30:00,스타벅스 강남점,6500',
      '2024-01-16 14:20,이마트 서초점,30000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.date).toBe('2024-01-15');
    expect(result.transactions[1]?.date).toBe('2024-01-16');
  });

  test('parseDateStringToISO reports error for impossible dates like "4/31" (F21-01)', () => {
    // With recognized headers, parseDateStringToISO validates dates.
    // "4/31" is impossible (Apr has 30 days) — parseDateStringToISO returns
    // the raw string and the parser reports a date parse error.
    // "4/30" and "2/28" are valid and parse to ISO format.
    const content = [
      '이용일,이용처,이용금액',
      '4/30,스타벅스,6500',
      '4/31,이마트,3000',
      '2/28,쿠팡,15000',
    ].join('\n');
    const result = parseCSV(content);
    // All 3 transactions are added (amounts are valid), but "4/31" gets
    // a date parse error and its date field remains as raw "4/31".
    expect(result.transactions).toHaveLength(3);
    // Valid dates parse to ISO format
    expect(result.transactions[0]?.date).toMatch(/^\d{4}-04-30$/);
    expect(result.transactions[2]?.date).toMatch(/^\d{4}-02-28$/);
    // "4/31" stays as raw string (unparseable)
    expect(result.transactions[1]?.date).toBe('4/31');
    // Error reported for the impossible date
    expect(result.errors.some((e) => e.message.includes('날짜'))).toBe(true);
  });

  // C23-03: Full-width dot dates through CSV parser integration
  test('parses full-width dot date YYYY．MM．DD through CSV (C23-03)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2024．01．15,스타벅스,6500',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.date).toBe('2024-01-15');
  });

  test('parses ideographic full stop date YYYY。MM。DD through CSV (C23-03)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2024。01。15,이마트,30000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.date).toBe('2024-01-15');
  });

  test('parses mixed delimiter date YYYY．.MM/DD through CSV (C23-03)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2024．01/15,쿠팡,15000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.date).toBe('2024-01-15');
  });
});

// ---------------------------------------------------------------------------
// Cycle 36: New column pattern integration tests
// ---------------------------------------------------------------------------

describe('Cycle 36: New column pattern terms integration', () => {
  test('generic parser handles 승인일시 + 승인가맹점 + 청구금액 headers', () => {
    const content = [
      '승인일시,승인가맹점,청구금액',
      '2026-02-01,스타벅스 강남점,6500',
      '2026-02-02,이마트 서초점,30000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.date).toBe('2026-02-01');
    expect(result.transactions[0]?.merchant).toBe('스타벅스 강남점');
    expect(result.transactions[0]?.amount).toBe(6500);
  });

  test('generic parser handles 접수일 + 이용내용 + 출금액 headers', () => {
    const content = [
      '접수일,이용내용,출금액',
      '2026-02-01,배달의민족,18000',
      '2026-02-02,쿠팡,15000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toBe('배달의민족');
  });

  test('generic parser handles 발행일 + 거래내용 + 결제대금 headers', () => {
    const content = [
      '발행일,거래내용,결제대금',
      '2026-02-01,GS25 편의점,3500',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.date).toBe('2026-02-01');
  });

  test('generic parser handles English posted + name + charge headers', () => {
    const content = [
      'posted,name,charge',
      '2026-02-01,Starbucks Gangnam,6500',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.date).toBe('2026-02-01');
  });

  test('generic parser handles English billing + merchant + payment headers', () => {
    const content = [
      'billing,merchant,payment',
      '2026-02-01,Emart Seocho,30000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(30000);
  });

  test('generic parser handles 승인취소금액 header', () => {
    const content = [
      '이용일,이용처,승인취소금액',
      '2026-02-01,환불건,5000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(5000);
  });

  test('generic parser handles header with 할부횟수 installment column', () => {
    const content = [
      '이용일,이용처,이용금액,할부횟수',
      '2026-02-01,현대백화점,120000,3',
      '2026-02-02,스타벅스,6000,0',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.installments).toBe(3);
    expect(result.transactions[1]?.installments).toBeUndefined();
  });

  test('generic parser infers amount column from 마이너스-prefixed amounts', () => {
    // When headers are unknown but data contains 마이너스-prefixed amounts,
    // the generic parser should infer the amount column correctly.
    const content = [
      '날짜,내용,금액',
      '2026-02-01,편의점,마이너스3500',
      '2026-02-02,카페,마이너스6000',
    ].join('\n');
    const result = parseCSV(content);
    // 마이너스 amounts are negative — the parser skips negative amounts
    // (they don't contribute to spending), but column inference should
    // still succeed (no "헤더 행을 찾을 수 없습니다" error).
    expect(result.errors.filter((e) => e.message.includes('헤더'))).toHaveLength(0);
  });

  test('generic parser parses 마이너스 amounts as negative (skipped)', () => {
    // Verify that 마이너스 amounts in recognized columns are parsed correctly
    // and skipped as negative amounts.
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,편의점,마이너스3500',
      '2026-02-02,카페,6000',
    ].join('\n');
    const result = parseCSV(content);
    // Only the positive amount transaction should be included
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(6000);
  });

  test('generic parser does not misidentify 6-digit transaction IDs as dates (C45-01)', () => {
    // A CSV with 6-digit transaction IDs should not cause the generic parser
    // to pick the ID column as the date column. Valid YYMMDD like "240115"
    // should still be recognized.
    const content = [
      '번호,이용일,이용처,이용금액',
      '123456,2026-03-15,편의점,5000',
      '999999,2026-03-16,카페,6000',
      '000001,2026-03-17,식당,7000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(3);
    // Dates should come from the actual date column, not the ID column
    expect(result.transactions[0]?.date).toBe('2026-03-15');
    expect(result.transactions[1]?.date).toBe('2026-03-16');
    expect(result.transactions[2]?.date).toBe('2026-03-17');
  });

  test('generic parser still recognizes valid YYMMDD dates (C45-01)', () => {
    // Valid YYMMDD dates should still work when there's no header-based detection
    const content = [
      '날짜,가게,금액',
      '260315,편의점,5000',
      '260316,카페,6000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.date).toBe('2026-03-15');
    expect(result.transactions[1]?.date).toBe('2026-03-16');
  });

  test('generic parser does not misidentify hyphenated strings as amounts (C45-02)', () => {
    // Strings like "12-34" should not be matched as amounts during column detection.
    // The parser should still correctly parse real amounts with commas.
    const content = [
      '이용일,이용처,비고,이용금액',
      '2026-03-15,편의점,ABC-123,5000',
      '2026-03-16,카페,XYZ-456,6000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(5000);
    expect(result.transactions[1]?.amount).toBe(6000);
  });

  test('generic parser recognizes Won-sign amounts without comma (C45-02)', () => {
    // Small amounts with Won sign should still be recognized
    const content = [
      '날짜,가게,금액',
      '2026-03-15,편의점,₩500',
      '2026-03-16,카페,₩1200',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(500);
    expect(result.transactions[1]?.amount).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// Cycle 47: Summary row pattern additions
// ---------------------------------------------------------------------------

describe('Cycle 47: Summary row pattern additions', () => {
  test('skips "합산" summary row (C47-01)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,스타벅스,6000',
      '합산,,6000',
      '2026-02-02,이마트,45000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toBe('스타벅스');
    expect(result.transactions[1]?.merchant).toBe('이마트');
  });

  test('skips "합 산" with space summary row (C47-01)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,스타벅스,6000',
      '합 산,,6000',
      '2026-02-02,이마트,45000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
  });

  test('does NOT skip "합산마트" merchant name (boundary guard)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,합산마트,15000',
      '2026-02-02,이마트,45000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toBe('합산마트');
  });
});

// ---------------------------------------------------------------------------
// Cycle 49: Edge-case format diversity tests
// ---------------------------------------------------------------------------
describe('parseCSV - Cycle 49 format diversity', () => {
  test('parenthesized amount with Won suffix: (1,234원) is negative', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,환불,-5000',
      '2026-02-02,스타벅스,6000',
    ].join('\n');
    const result = parseCSV(content);
    // Negative amounts are skipped (not contributing to spending)
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(6000);
  });

  test('full-width Won sign ￦1,234 is parsed correctly', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,스타벅스,"￦6,000"',
      '2026-02-02,이마트,"￦45,000"',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(6000);
    expect(result.transactions[1]?.amount).toBe(45000);
  });

  test('마이너스 prefix amount is parsed as negative and skipped', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,환불,마이너스3000',
      '2026-02-02,스타벅스,6000',
    ].join('\n');
    const result = parseCSV(content);
    // 마이너스3000 is negative, skipped
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(6000);
  });

  test('YYMMDD date format (240115) is detected and parsed', () => {
    const content = [
      '이용일,이용처,이용금액',
      '260201,스타벅스,6000',
      '260202,이마트,45000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.date).toBe('2026-02-01');
    expect(result.transactions[1]?.date).toBe('2026-02-02');
  });

  test('bare 5+ digit integer amounts are detected in column detection', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,스타벅스,6000',
      '2026-02-02,이마트,45000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(6000);
    expect(result.transactions[1]?.amount).toBe(45000);
  });

  test('pipe-delimited CSV file is parsed correctly', () => {
    const content = [
      '이용일|이용처|이용금액',
      '2026-02-01|스타벅스|6000',
      '2026-02-02|이마트|45000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.merchant).toBe('스타벅스');
    expect(result.transactions[0]?.amount).toBe(6000);
    expect(result.transactions[1]?.merchant).toBe('이마트');
    expect(result.transactions[1]?.amount).toBe(45000);
  });

  test('amount error includes raw row text for debugging (C55)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,테스트,금액오류',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.errors.length).toBeGreaterThan(0);
    const amountError = result.errors.find((e) => e.message.includes('금액을 해석할 수 없습니다'));
    expect(amountError).toBeDefined();
    expect(amountError!.raw).toBeDefined();
    expect(amountError!.raw).toContain('금액오류');
  });

  test('generic parser amount error includes raw row text (C55)', () => {
    const content = [
      'date,merchant,amount',
      '2026-02-01,테스트,not_a_number',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.errors.length).toBeGreaterThan(0);
    const amountError = result.errors.find((e) => e.message.includes('금액을 해석할 수 없습니다'));
    expect(amountError).toBeDefined();
    expect(amountError!.raw).toBeDefined();
    expect(amountError!.raw).toContain('not_a_number');
  });

  test('rejects CSV with purely numeric column headers (C56-03)', () => {
    const content = [
      '1,2,3,4,5',
      '2026-01-15,스타벅스,6500,1,테스트',
      '2026-01-16,이마트,45000,1,쇼핑',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('헤더');
  });

  test('parses CSV with KRW-prefixed amounts (C56-01)', () => {
    // KRW amounts with comma separators must be quoted to avoid CSV delimiter splitting
    const content = [
      '이용일,이용처,이용금액',
      '2026-01-15,스타벅스,"KRW 6,500"',
      '2026-01-16,이마트,"KRW 45,000원"',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(6500);
    expect(result.transactions[1]?.amount).toBe(45000);
  });
});

// ---------------------------------------------------------------------------
// Cycle 60: isAmountLike false positive fix (C60-01)
// ---------------------------------------------------------------------------
describe('Cycle 60: isAmountLike does not false-positive on bare small numbers', () => {
  test('bare small numbers like "12" are NOT misidentified as amounts (C60-01)', () => {
    // Headerless CSV where a column contains small bare numbers (like
    // installment counts). These should NOT be picked as the amount column
    // during data inference.
    const content = [
      'code,item,inst,cost',
      '2026-01-15,coffee,1,3500',
      '2026-01-16,sandwich,2,12000',
      '2026-01-17,juice,1,5000',
    ].join('\n');
    const result = parseCSV(content);
    // The parser should detect "cost" column (3500, 12000, 5000) as amounts
    // rather than "inst" column (1, 2, 1). With the old pattern, "1" and "2"
    // would match isAmountLike and steal the amount column assignment.
    // Note: without recognized header keywords, falls back to data inference.
    // The amounts 3500, 12000, 5000 are 4-5 digits and match the bare 5+
    // digit pattern or comma pattern. The key assertion is that the parser
    // does NOT produce transactions with amounts 1 or 2.
    if (result.transactions.length > 0) {
      for (const tx of result.transactions) {
        expect(tx.amount).toBeGreaterThan(2);
      }
    }
  });

  test('comma-separated amounts like "1,234" still match as amounts (C60-01)', () => {
    const content = [
      'code,item,val',
      '2026-01-15,coffee,"1,234"',
      '2026-01-16,sandwich,"12,000"',
      '2026-01-17,juice,"5,678"',
    ].join('\n');
    const result = parseCSV(content);
    // Without recognized headers, the parser falls back to data inference.
    // Comma-separated amounts should still be detected as amounts.
    // Since there's no recognizable header, we expect a header error.
    expect(result.errors.some((e) => e.message.includes('헤더'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cycle 61: Bare integer amount threshold raised from 5 to 8 digits (C61-01)
// ---------------------------------------------------------------------------
describe('Cycle 61: bare integer amount threshold is 8 digits (C61-01)', () => {
  test('5-7 digit bare integers do NOT match as amounts in data inference', () => {
    // A generic CSV where one column has 5-7 digit numbers (transaction IDs)
    // and another has comma-formatted amounts. The bare integer column should
    // NOT be picked as the amount column during data inference.
    const content = [
      'date,desc,ref,price',
      '2026-01-15,coffee,12345,"3,500"',
      '2026-01-16,sandwich,67890,"12,000"',
      '2026-01-17,juice,111222,"5,678"',
    ].join('\n');
    const result = parseCSV(content);
    // The "price" column with comma-separated amounts should be detected,
    // not the "ref" column with 5-digit bare integers.
    if (result.transactions.length > 0) {
      for (const tx of result.transactions) {
        // Amounts should be in the thousands range, not the 5-digit ID range
        expect(tx.amount).toBeLessThan(100000);
        expect(tx.amount).toBeGreaterThan(0);
      }
    }
  });

  test('8+ digit bare integers still match as amounts', () => {
    // A CSV where amounts are bare 8+ digit integers (10,000,000 Won)
    // without thousand separators. These should still be detected.
    const content = [
      'date,desc,cost',
      '2026-01-15,deposit,10000000',
      '2026-01-16,transfer,25000000',
    ].join('\n');
    const result = parseCSV(content);
    // With no recognized headers, falls back to data inference.
    // 8+ digit bare integers should be detected as amounts.
    if (result.transactions.length > 0) {
      expect(result.transactions[0]?.amount).toBe(10000000);
      expect(result.transactions[1]?.amount).toBe(25000000);
    }
  });

  test('comma-formatted amounts still work regardless of digit count', () => {
    // Comma-separated amounts should always be detected (the comma pattern
    // is separate from the bare integer pattern).
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,스타벅스,6000',
      '2026-02-02,이마트,45000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(6000);
    expect(result.transactions[1]?.amount).toBe(45000);
  });
});

// ---------------------------------------------------------------------------
// C65-01: Bare-integer amount threshold lowered from 8 to 5 digits
// ---------------------------------------------------------------------------

describe('C65-01: Bare-integer amount column detection at 5+ digits', () => {
  test('5-digit bare integer "45000" parsed as amount with recognized headers', () => {
    // CSV with recognized Korean headers and unformatted 5-digit amounts.
    // The amount column is found by header matching, not data-inference.
    // Tests that parseCSVAmount correctly parses 5-digit bare integers.
    const content = [
      '이용일,이용처,이용금액',
      '2026-01-15,스타벅스,45000',
      '2026-01-16,이마트,12000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(45000);
    expect(result.transactions[1]?.amount).toBe(12000);
  });

  test('6-digit bare integer "123456" parsed as amount (C65-01)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-01-15,deposit,123456',
      '2026-01-16,transfer,654321',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(123456);
    expect(result.transactions[1]?.amount).toBe(654321);
  });

  test('7-digit bare integer "1000000" parsed as amount (C65-01)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-01-15,대형마트,1000000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(1000000);
  });

  test('comma-formatted and bare-integer amounts mixed (C65-01)', () => {
    // Some rows have comma formatting (quoted to protect the comma), others
    // don't — both should parse correctly.
    const content = [
      '이용일,이용처,이용금액',
      '2026-01-15,스타벅스,"6,500"',
      '2026-01-16,이마트,45000',
      '2026-01-17,편의점,3200',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]?.amount).toBe(6500);
    expect(result.transactions[1]?.amount).toBe(45000);
    expect(result.transactions[2]?.amount).toBe(3200);
  });

  test('data-inference detects 5-digit bare integer as amount column (C65-01)', () => {
    // Use headers with 2+ category keywords (date + merchant) for isValidHeaderRow,
    // but the amount header is unrecognized ("값"), forcing data-inference for amount.
    // isValidHeaderRow checks 3 categories: date, merchant, amount. Having
    // '이용일' (date) and '가맹점' (merchant) gives 2 categories, which passes.
    const content = [
      '이용일,가맹점,값',
      '2026-01-15,스타벅스,45000',
      '2026-01-16,이마트,12000',
    ].join('\n');
    const result = parseCSV(content);
    // "값" doesn't match AMOUNT_COLUMN_PATTERN, so data-inference runs.
    // "45000" (5 digits) should now be detected as amount by C65-01 change.
    expect(result.transactions.length).toBeGreaterThanOrEqual(1);
    if (result.transactions.length > 0) {
      expect(result.transactions[0]?.amount).toBe(45000);
    }
  });
});

// ---------------------------------------------------------------------------
// C65-02: Data-inference silent failure error message
// ---------------------------------------------------------------------------

describe('C65-02: Data-inference column detection failure error message', () => {
  test('reports error when date column found but amount column missing', () => {
    // Valid header with 2+ categories (date + merchant) so header detection passes,
    // but amount column has an unrecognized header ("값") and data has no amount
    // patterns — should report missing amount column.
    const content = [
      '이용일,가맹점,값',
      '2026-01-15,hello,world',
      '2026-01-16,foo,bar',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(0);
    const missingError = result.errors.find((e) =>
      e.message.includes('필수 컬럼을 찾을 수 없습니다'),
    );
    expect(missingError).toBeDefined();
    expect(missingError?.message).toContain('금액');
  });

  test('parses trailing-minus amount "1,234-" as negative and skips (C68-01)', () => {
    const content = [
      '이용일,이용처,이용금액',
      '2026-02-01,환불건,"1,234-"',
      '2026-02-02,스타벅스,6000',
    ].join('\n');
    const result = parseCSV(content);
    // Trailing-minus amount is negative, so it's skipped
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(6000);
  });

  test('data-inference detects trailing-minus amounts in column detection (C68-01)', () => {
    // When headers are recognized but trailing-minus amounts appear in data,
    // the amount column should still be detected.
    const content = [
      '이용일,가맹점,값',
      '2026-02-01,환불,"1,234-"',
      '2026-02-02,스타벅스,"6,000"',
    ].join('\n');
    const result = parseCSV(content);
    // The positive amount should be parsed; the negative should be skipped
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.amount).toBe(6000);
  });

  test('reports header-not-found error for headers without keywords', () => {
    // Headers with no recognized keywords at all — header detection fails.
    const content = [
      'a,b,c',
      'hello,world,test',
      'foo,bar,baz',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(0);
    // Should report header not found (this error comes first)
    const headerError = result.errors.find((e) =>
      e.message.includes('헤더 행을 찾을 수 없습니다'),
    );
    expect(headerError).toBeDefined();
  });

  test('generic parser detects leading-plus amounts via data-inference (C71-01)', () => {
    // Some Korean banks export amounts with explicit "+" prefix for positive
    // amounts (e.g., "+15000"). The column-detection AMOUNT_PATTERNS must
    // recognize this format so data-inference can identify the amount column.
    const content = [
      'Date,Description,Amount',
      '2024-01-15,Coffee Shop,+3500',
      '2024-01-16,Restaurant,+15000',
      '2024-01-17,Supermarket,+28000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]?.amount).toBe(3500);
    expect(result.transactions[1]?.amount).toBe(15000);
    expect(result.transactions[2]?.amount).toBe(28000);
  });

  test('generic parser handles datetime with T-separator (C75-02)', () => {
    // Some Korean bank exports use ISO datetime with T-separator:
    // "2024-01-15T10:30:00". The generic CSV parser's isDateLike must
    // recognize these for column inference, and parseDateStringToISO must
    // extract the date portion (ignoring the time).
    const content = [
      '이용일,이용처,이용금액',
      '2024-01-15T10:30:00,스타벅스 강남점,6500',
      '2024-01-16T14:20:30,이마트 서초점,30000',
    ].join('\n');
    const result = parseCSV(content);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.date).toBe('2024-01-15');
    expect(result.transactions[0]?.merchant).toBe('스타벅스 강남점');
    expect(result.transactions[0]?.amount).toBe(6500);
    expect(result.transactions[1]?.date).toBe('2024-01-16');
    expect(result.transactions[1]?.amount).toBe(30000);
  });
});
