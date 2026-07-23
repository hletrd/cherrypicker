import { describe, expect, test } from 'bun:test';
import { calculatePerformanceSpending } from '../src/lib/performance-spending.js';

describe('performance spending exclusions', () => {
  test('fails closed for confidence-zero uncategorized previous spending', () => {
    const result = calculatePerformanceSpending(
      [{
        amount: 300_000,
        category: 'uncategorized',
        confidence: 0,
      }],
      ['insurance'],
    );

    expect(result).toEqual({
      amount: 0,
      unknownExclusions: ['insurance'],
    });
  });

  test('accepts a user-confirmed category as trusted', () => {
    const result = calculatePerformanceSpending(
      [{
        amount: 300_000,
        category: 'dining',
        confidence: 1,
      }],
      ['insurance'],
    );

    expect(result).toEqual({ amount: 300_000, unknownExclusions: [] });
  });

  test('applies canonical category and child-category exclusions', () => {
    const result = calculatePerformanceSpending(
      [
        {
          amount: 30_000,
          category: 'utilities',
          subcategory: 'apartment_mgmt',
        },
        { amount: 20_000, category: 'insurance' },
        { amount: 50_000, category: 'dining', subcategory: 'cafe' },
      ],
      ['apartment_fee', 'insurance'],
    );

    expect(result).toEqual({ amount: 50_000, unknownExclusions: [] });
  });

  test('uses explicit payment and statement-tag facts when present', () => {
    const result = calculatePerformanceSpending(
      [
        {
          amount: 10_000,
          category: 'travel',
          paymentType: 'overseas',
          performanceExclusionTags: [],
        },
        {
          amount: 20_000,
          category: 'uncategorized',
          paymentType: 'domestic',
          performanceExclusionTags: ['tax_payment'],
        },
        {
          amount: 30_000,
          category: 'dining',
          paymentType: 'domestic',
          performanceExclusionTags: [],
        },
      ],
      ['overseas', 'tax_payment'],
    );

    expect(result).toEqual({ amount: 30_000, unknownExclusions: [] });
  });

  test('fails closed to zero when a non-category exclusion fact is absent', () => {
    const result = calculatePerformanceSpending(
      [{ amount: 100_000, category: 'dining' }],
      ['tax_payment', 'overseas'],
    );

    expect(result).toEqual({
      amount: 0,
      unknownExclusions: ['overseas', 'tax_payment'],
    });
  });
});
