/**
 * Server-side amount parser tests.
 * Tests the shared parseAmount wrapper and parseAmountString (C28-TEST02).
 */
import { describe, it, expect } from 'vitest';
import { parseAmount, parseAmountString } from '../src/amount.js';

describe('parseAmountString (server)', () => {
  it('parses plain integers', () => {
    expect(parseAmountString('10000')).toBe(10000);
  });

  it('parses comma-separated thousands', () => {
    expect(parseAmountString('1,234,567')).toBe(1234567);
  });

  it('parses Won sign prefixed amounts', () => {
    expect(parseAmountString('₩500')).toBe(500);
    expect(parseAmountString('₩10,000원')).toBe(10000);
  });

  it('parses parenthesized negatives', () => {
    expect(parseAmountString('(1,234)')).toBe(-1234);
  });

  it('parses 마이너스 prefix', () => {
    expect(parseAmountString('마이너스1,234')).toBe(-1234);
  });

  it('parses trailing minus', () => {
    expect(parseAmountString('1,234-')).toBe(-1234);
  });

  it('returns null for empty input', () => {
    expect(parseAmountString('')).toBeNull();
    expect(parseAmountString('  ')).toBeNull();
  });

  it('returns null for unparseable inputs', () => {
    expect(parseAmountString('abc')).toBeNull();
    expect(parseAmountString('-')).toBeNull();
  });

  it('returns null for invalid decimal strings (C29-TEST01)', () => {
    expect(parseAmountString('1.2.3')).toBeNull();
    expect(parseAmountString('1..2')).toBeNull();
    expect(parseAmountString('1.')).toBeNull();
    expect(parseAmountString('..1')).toBeNull();
  });

  it('returns null for bare currency symbols without digits (C29-TEST01)', () => {
    expect(parseAmountString('원')).toBeNull();
    expect(parseAmountString('마이너스')).toBeNull();
    expect(parseAmountString('₩')).toBeNull();
    expect(parseAmountString('KRW')).toBeNull();
  });

  it('handles very large numbers (C29-TEST01)', () => {
    expect(parseAmountString('9,999,999,999,999,999')).toBe(9999999999999999);
    expect(parseAmountString('9999999999999999')).toBe(9999999999999999);
  });

  it('handles mixed full-width and ASCII digits (C29-TEST01)', () => {
    expect(parseAmountString('１2３4')).toBe(1234);
    expect(parseAmountString('１,234')).toBe(1234);
    expect(parseAmountString('1,２３4')).toBe(1234);
  });

  it('rejects trailing alphabetic garbage (C39-TEST01)', () => {
    expect(parseAmountString('1234abc')).toBeNull();
    expect(parseAmountString('50000원금')).toBeNull();
    expect(parseAmountString('10000!!!')).toBeNull();
    expect(parseAmountString('1234 xyz')).toBeNull();
    expect(parseAmountString('1234+')).toBeNull();
  });
});

describe('parseAmount wrapper (server)', () => {
  it('handles number inputs by rounding', () => {
    expect(parseAmount(1234)).toBe(1234);
    expect(parseAmount(1234.56)).toBe(1235);
    expect(parseAmount(1234.44)).toBe(1234);
    expect(parseAmount(0)).toBe(0);
  });

  it('handles string inputs by delegating to parseAmountString', () => {
    expect(parseAmount('10000')).toBe(10000);
    expect(parseAmount('(1,234)')).toBe(-1234);
    expect(parseAmount('₩500')).toBe(500);
  });

  it('returns null for non-finite numbers', () => {
    expect(parseAmount(NaN)).toBeNull();
    expect(parseAmount(Infinity)).toBeNull();
    expect(parseAmount(-Infinity)).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });

  it('returns null for non-string non-number inputs', () => {
    expect(parseAmount({} as unknown as string)).toBeNull();
    expect(parseAmount([] as unknown as string)).toBeNull();
    expect(parseAmount(true as unknown as string)).toBeNull();
  });
});
