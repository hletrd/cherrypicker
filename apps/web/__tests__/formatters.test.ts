/**
 * Unit tests for formatSavingsValue helper in formatters.ts.
 *
 * The function centralizes sign-prefix logic across SavingsComparison,
 * VisibilityToggle, and ReportContent (C92-01/C94-01). Edge cases
 * (negative values, zero, 99/100 boundary, prefixValue override) were
 * previously untested (C10-01).
 */
import { describe, test, expect } from 'bun:test';
import { formatCatalogReward, formatSavingsValue, formatWon } from '../src/lib/formatters.js';

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

describe('formatCatalogReward', () => {
  test('treats catalog rates as percentage points', () => {
    expect(formatCatalogReward({ rate: 0.7 })).toBe('0.7%');
    expect(formatCatalogReward({ rate: 5 })).toBe('5%');
    expect(formatCatalogReward({ rate: 0 })).toBe('0%');
  });

  test('renders fixed reward units without inventing a percentage', () => {
    expect(formatCatalogReward({ rate: null, fixedAmount: 60, unit: 'won_per_liter' })).toBe('리터당 60원');
    expect(formatCatalogReward({ rate: null, fixedAmount: 200, unit: 'won_per_day' })).toBe('일 200원');
    expect(formatCatalogReward({ rate: null, fixedAmount: 1.5, unit: 'mile_per_1500won' })).toBe('1.5마일/1,500원');
    expect(formatCatalogReward({ rate: null, fixedAmount: 5_000 })).toBe('5,000원');
  });

  test('labels mileage rates and does not guess unknown units', () => {
    expect(formatCatalogReward({ rate: 0.2, unit: 'miles' })).toBe('0.2% 마일리지');
    expect(formatCatalogReward({ rate: 1, unit: 'unknown-unit' })).toBe('표시 가능한 혜택 정보 없음');
    expect(formatCatalogReward({ rate: null, fixedAmount: 10, unit: 'unknown-unit' })).toBe('표시 가능한 혜택 정보 없음');
  });

  test('uses an honest fallback when no displayable value exists', () => {
    expect(formatCatalogReward({ rate: null, fixedAmount: null })).toBe('표시 가능한 혜택 정보 없음');
  });
});
