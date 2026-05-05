/**
 * Web-side JSON transaction parser tests.
 * Parity with server-side packages/parser/__tests__/json.test.ts (T13-01, T13-04).
 */
import { describe, it, expect } from 'bun:test';
import { parseJSON } from '../src/lib/parser/json.js';

describe('JSON Parser (web)', () => {
  it('parses a simple array of transactions', () => {
    const input = JSON.stringify([
      { date: '2024-01-15', merchant: '스타벅스', amount: 6500 },
      { date: '2024-01-20', merchant: '이마트', amount: 45000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]!.date).toBe('2024-01-15');
    expect(result.transactions[0]!.merchant).toBe('스타벅스');
    expect(result.transactions[0]!.amount).toBe(6500);
    expect(result.transactions[1]!.date).toBe('2024-01-20');
    expect(result.transactions[1]!.merchant).toBe('이마트');
    expect(result.transactions[1]!.amount).toBe(45000);
    expect(result.format).toBe('json');
  });

  it('parses nested wrapper format { transactions: [...] }', () => {
    const input = JSON.stringify({
      transactions: [
        { date: '2024-03-01', merchant: '쿠팡', amount: 32000 },
      ],
    });
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.merchant).toBe('쿠팡');
  });

  it('parses nested wrapper format { data: [...] }', () => {
    const input = JSON.stringify({
      data: [
        { date: '2024-04-10', merchant: '네이버', amount: 9900 },
      ],
    });
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.merchant).toBe('네이버');
  });

  it('handles Korean field name aliases', () => {
    const input = JSON.stringify([
      { 거래일: '2024-05-01', 이용처: '카카오', 이용금액: 15000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.date).toBe('2024-05-01');
    expect(result.transactions[0]!.merchant).toBe('카카오');
    expect(result.transactions[0]!.amount).toBe(15000);
  });

  it('handles camelCase English field names', () => {
    const input = JSON.stringify([
      { transactionDate: '2024-06-15', merchantName: 'Apple Store', transactionAmount: 150000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.date).toBe('2024-06-15');
    expect(result.transactions[0]!.merchant).toBe('Apple Store');
    expect(result.transactions[0]!.amount).toBe(150000);
  });

  it('handles snake_case English field names', () => {
    const input = JSON.stringify([
      { transaction_date: '2024-07-01', store_name: 'Costco', total_amount: 89000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.date).toBe('2024-07-01');
    expect(result.transactions[0]!.merchant).toBe('Costco');
    expect(result.transactions[0]!.amount).toBe(89000);
  });

  it('preserves negative amounts as refunds and skips zero amounts (T13-04)', () => {
    const input = JSON.stringify([
      { date: '2024-11-01', merchant: '환불', amount: -5000 },
      { date: '2024-11-02', merchant: '잔액조회', amount: 0 },
      { date: '2024-11-03', merchant: '정상', amount: 10000 },
    ]);
    const result = parseJSON(input);
    // JSON is the only format that preserves negative amounts (refunds)
    // Zero amounts are skipped
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]!.amount).toBe(-5000);
    expect(result.transactions[1]!.amount).toBe(10000);
  });

  it('skips entries missing required fields', () => {
    const input = JSON.stringify([
      { date: '2024-12-01' }, // missing amount
      { merchant: '테스트' }, // missing date
      { date: '2024-12-02', merchant: 'OK', amount: 5000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.amount).toBe(5000);
  });

  it('returns error for invalid JSON', () => {
    const result = parseJSON('not valid json {{{');
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('JSON');
  });

  it('handles date formats like YYYYMMDD', () => {
    const input = JSON.stringify([
      { date: '20240115', merchant: '테스트', amount: 5000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.date).toBe('2024-01-15');
  });

  it('handles date formats like YYMMDD', () => {
    const input = JSON.stringify([
      { date: '240115', merchant: '테스트', amount: 5000 },
    ]);
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.date).toBe('2024-01-15');
  });

  it('handles wrapper key 내역 (Korean)', () => {
    const input = JSON.stringify({
      내역: [
        { date: '2024-01-01', merchant: '한글키', amount: 5000 },
      ],
    });
    const result = parseJSON(input);
    expect(result.transactions).toHaveLength(1);
  });

  it('returns error when wrapper has no transaction array', () => {
    const result = parseJSON(JSON.stringify({ foo: 'bar' }));
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});
