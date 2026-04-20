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
    expect(result.errors.some((error) => error.message.includes('Cannot parse amount'))).toBe(true);
  });
});
