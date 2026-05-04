import { describe, test, expect } from 'bun:test';
import { splitCSVLine, parseCSVAmount, isValidCSVAmount, parseCSVInstallments } from '../src/csv/shared.js';

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