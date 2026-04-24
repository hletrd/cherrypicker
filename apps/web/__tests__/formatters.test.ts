/**
 * Unit tests for formatSavingsValue helper in formatters.ts.
 *
 * The function centralizes sign-prefix logic across SavingsComparison,
 * VisibilityToggle, and ReportContent (C92-01/C94-01). Edge cases
 * (negative values, zero, 99/100 boundary, prefixValue override) were
 * previously untested (C10-01).
 */
import { describe, test, expect } from 'bun:test';
import { formatSavingsValue, formatWon } from '../src/lib/formatters.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatSavingsValue', () => {
  test('positive value >= 100 shows "+" prefix', () => {
    const result = formatSavingsValue(5000);
    expect(result.startsWith('+')).toBe(true);
    expect(result).toBe('+' + formatWon(5000));
  });

  test('positive value exactly 100 shows "+" prefix', () => {
    const result = formatSavingsValue(100);
    expect(result.startsWith('+')).toBe(true);
  });

  test('positive value 99 does NOT show "+" prefix', () => {
    const result = formatSavingsValue(99);
    expect(result.startsWith('+')).toBe(false);
  });

  test('positive value < 100 does NOT show "+" prefix', () => {
    const result = formatSavingsValue(50);
    expect(result.startsWith('+')).toBe(false);
  });

  test('zero does NOT show "+" prefix', () => {
    const result = formatSavingsValue(0);
    expect(result.startsWith('+')).toBe(false);
    expect(result).toBe(formatWon(0));
  });

  test('negative value without prefixValue: no "+" prefix (value < 0 < 100)', () => {
    // When value is negative and no prefixValue is given, effectivePrefixValue
    // equals the raw negative value, which fails the >= 100 check.
    // The display uses Math.abs(value) to show magnitude.
    const result = formatSavingsValue(-3000);
    expect(result.startsWith('+')).toBe(false);
    expect(result).toBe(formatWon(3000));
  });

  test('negative value with positive prefixValue >= 100: shows "+" prefix', () => {
    // The prefixValue overrides the prefix decision — a negative animated
    // intermediate can still show '+' if the final target is positive.
    const result = formatSavingsValue(-3000, 5000);
    expect(result.startsWith('+')).toBe(true);
    expect(result).toBe('+' + formatWon(3000));
  });

  test('negative value near zero (-50) does NOT show "+" prefix', () => {
    const result = formatSavingsValue(-50);
    // -50 >= 100 is false, and Math.abs(-50) = 50 for display
    expect(result.startsWith('+')).toBe(false);
    expect(result).toBe(formatWon(50));
  });

  test('prefixValue override: uses prefixValue for prefix decision', () => {
    // display value is 50 (< 100), but prefixValue is 5000 (>= 100)
    const result = formatSavingsValue(50, 5000);
    expect(result.startsWith('+')).toBe(true);
    expect(result).toBe('+' + formatWon(50));
  });

  test('prefixValue override: prefixValue < 100 suppresses prefix even if value >= 100', () => {
    // display value is 5000 (>= 100), but prefixValue is 50 (< 100)
    const result = formatSavingsValue(5000, 50);
    expect(result.startsWith('+')).toBe(false);
    expect(result).toBe(formatWon(5000));
  });

  test('prefixValue defaults to value when omitted', () => {
    const result = formatSavingsValue(5000);
    // Same as formatSavingsValue(5000, 5000)
    expect(result).toBe('+' + formatWon(5000));
  });
});
