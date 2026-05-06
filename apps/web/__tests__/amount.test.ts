/**
 * Web-side amount parser tests.
 * Tests the extracted parseAmount function from amount.ts (C28-TEST01).
 */
import { describe, it, expect } from 'bun:test';
import { parseAmount } from '../src/lib/parser/amount.js';

describe('parseAmount (web)', () => {
  it('parses plain integers', () => {
    expect(parseAmount('10000')).toBe(10000);
    expect(parseAmount('0')).toBe(0);
  });

  it('parses comma-separated thousands', () => {
    expect(parseAmount('1,234,567')).toBe(1234567);
    expect(parseAmount('10,000')).toBe(10000);
  });

  it('parses Won sign prefixed amounts', () => {
    expect(parseAmount('₩500')).toBe(500);
    expect(parseAmount('￦1,000')).toBe(1000);
    expect(parseAmount('₩10,000원')).toBe(10000);
  });

  it('parses 원 suffix', () => {
    expect(parseAmount('10000원')).toBe(10000);
    expect(parseAmount('1,234원')).toBe(1234);
  });

  it('parses KRW prefix', () => {
    expect(parseAmount('KRW10000')).toBe(10000);
    expect(parseAmount('KRW 1,234')).toBe(1234);
    expect(parseAmount('krw500원')).toBe(500);
  });

  it('parses full-width digits', () => {
    expect(parseAmount('１００００')).toBe(10000);
    expect(parseAmount('１，２３４')).toBe(1234);
  });

  it('parses full-width punctuation', () => {
    expect(parseAmount('１０，０００')).toBe(10000);
    expect(parseAmount('（１，２３４）')).toBe(-1234);
  });

  it('parses parenthesized negatives', () => {
    expect(parseAmount('(1,234)')).toBe(-1234);
    expect(parseAmount('(10000)')).toBe(-10000);
  });

  it('parses 마이너스 prefix', () => {
    expect(parseAmount('마이너스1,234')).toBe(-1234);
    expect(parseAmount('마이너스10000원')).toBe(-10000);
  });

  it('parses trailing minus', () => {
    expect(parseAmount('1,234-')).toBe(-1234);
    expect(parseAmount('10000-')).toBe(-10000);
  });

  it('parses leading plus', () => {
    expect(parseAmount('+1,234')).toBe(1234);
    expect(parseAmount('+10000')).toBe(10000);
  });

  it('parses fullwidth minus', () => {
    expect(parseAmount('－1,234')).toBe(-1234);
    expect(parseAmount('－10000원')).toBe(-10000);
  });

  it('rounds decimal values', () => {
    expect(parseAmount('1234.56')).toBe(1235);
    expect(parseAmount('1234.44')).toBe(1234);
  });

  it('returns null for empty/whitespace input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('\t')).toBeNull();
  });

  it('returns null for unparseable inputs', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('n/a')).toBeNull();
    expect(parseAmount('-')).toBeNull();
    expect(parseAmount('()')).toBeNull();
  });

  it('returns null for invalid decimal strings (C29-TEST01)', () => {
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount('1..2')).toBeNull();
    expect(parseAmount('1.')).toBeNull();
    expect(parseAmount('..1')).toBeNull();
  });

  it('returns null for bare currency symbols without digits (C29-TEST01)', () => {
    expect(parseAmount('원')).toBeNull();
    expect(parseAmount('마이너스')).toBeNull();
    expect(parseAmount('₩')).toBeNull();
    expect(parseAmount('KRW')).toBeNull();
  });

  it('handles very large numbers (C29-TEST01)', () => {
    expect(parseAmount('9,999,999,999,999,999')).toBe(9999999999999999);
    expect(parseAmount('9999999999999999')).toBe(9999999999999999);
  });
  // NOTE: Numeric literals >= 2^53 trigger TS80008. The toBe() call receives
  // the actual number from parseAmount, not a literal, so runtime precision
  // is fine. TypeScript just warns about the literal in source. We silence
  // this by accepting the runtime value via expect().

  it('handles mixed full-width and ASCII digits (C29-TEST01)', () => {
    expect(parseAmount('１2３4')).toBe(1234);
    expect(parseAmount('１,234')).toBe(1234);
    expect(parseAmount('1,２３4')).toBe(1234);
  });

  it('strips spaces inside amounts', () => {
    expect(parseAmount('1 000')).toBe(1000);
    expect(parseAmount('10 000 원')).toBe(10000);
  });
});
