/**
 * Unit tests for isOptimizableTx transaction validation.
 *
 * Covers positive amounts, zero amounts, negative amounts (refunds),
 * NaN/Infinity, and missing fields (C16-TEST01).
 */
import { describe, test, expect } from 'bun:test';
import { isOptimizableTx } from '../src/lib/tx-validation.js';

interface MinimalTx {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  confidence: number;
}

describe('isOptimizableTx', () => {
  const baseTx: MinimalTx = {
    id: 'tx-1',
    date: '2024-01-15',
    merchant: 'Test Store',
    amount: 10000,
    category: 'dining',
    confidence: 1,
  };

  test('accepts positive amounts', () => {
    expect(isOptimizableTx(baseTx)).toBe(true);
    expect(isOptimizableTx({ ...baseTx, amount: 1 })).toBe(true);
    expect(isOptimizableTx({ ...baseTx, amount: 999999 })).toBe(true);
  });

  test('accepts only bounded consumer fuel-volume facts', () => {
    expect(isOptimizableTx({ ...baseTx, fuelVolumeLiters: 18.5 })).toBe(true);
    expect(isOptimizableTx({ ...baseTx, fuelVolumeLiters: 200 })).toBe(true);
    expect(isOptimizableTx({ ...baseTx, fuelVolumeLiters: 200.01 })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, fuelVolumeLiters: 1e308 })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, fuelVolumeLiters: Infinity })).toBe(false);
  });

  test('accepts the complete optional fact contract', () => {
    expect(isOptimizableTx({
      ...baseTx,
      subcategory: 'cafe',
      installments: 3,
      rawCategory: '카페',
      memo: '메모',
      paymentType: 'overseas',
      channel: 'online',
      performanceExclusionTags: ['annual_fee', 'overseas'],
      factProvenance: {
        paymentType: 'statement',
        channel: 'user',
        fuelVolumeLiters: 'statement',
        performanceExclusionTags: 'user',
      },
    })).toBe(true);
  });

  test.each([
    ['subcategory type', { subcategory: 1 }],
    ['empty subcategory', { subcategory: '' }],
    ['missing confidence', { confidence: undefined }],
    ['fractional confidence', { confidence: 1.01 }],
    ['negative confidence', { confidence: -0.01 }],
    ['NaN confidence', { confidence: Number.NaN }],
    ['zero installments', { installments: 0 }],
    ['fractional installments', { installments: 1.5 }],
    ['unsafe installments', { installments: Number.MAX_SAFE_INTEGER + 1 }],
    ['payment type enum', { paymentType: 'international' }],
    ['channel enum', { channel: 'mobile' }],
    ['object exclusion tags', { performanceExclusionTags: { annual_fee: true } }],
    ['unknown exclusion tag', { performanceExclusionTags: ['future_tag'] }],
    ['array provenance', { factProvenance: [] }],
    ['unknown provenance key', { factProvenance: { merchant: 'statement' } }],
    ['unknown provenance source', { factProvenance: { channel: 'model' } }],
    ['memo type', { memo: 7 }],
    ['raw category type', { rawCategory: false }],
  ])('rejects malformed optional facts: %s', (_name, override) => {
    expect(isOptimizableTx({ ...baseTx, ...override })).toBe(false);
  });

  test('rejects zero amounts (balance inquiries)', () => {
    expect(isOptimizableTx({ ...baseTx, amount: 0 })).toBe(false);
  });

  test('accepts negative amounts (refunds/credits) — C16-01', () => {
    expect(isOptimizableTx({ ...baseTx, amount: -10000 })).toBe(true);
    expect(isOptimizableTx({ ...baseTx, amount: -1 })).toBe(true);
  });

  test('rejects NaN amounts', () => {
    expect(isOptimizableTx({ ...baseTx, amount: NaN })).toBe(false);
  });

  test('rejects Infinity amounts', () => {
    expect(isOptimizableTx({ ...baseTx, amount: Infinity })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, amount: -Infinity })).toBe(false);
  });

  test('rejects missing id', () => {
    expect(isOptimizableTx({ ...baseTx, id: '' })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, id: undefined })).toBe(false);
  });

  test('rejects missing date', () => {
    expect(isOptimizableTx({ ...baseTx, date: '' })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, date: undefined })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, date: '2026-02-30' })).toBe(false);
  });

  test('rejects missing merchant', () => {
    expect(isOptimizableTx({ ...baseTx, merchant: undefined })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, merchant: '' })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, merchant: '   ' })).toBe(false);
  });

  test('rejects missing category', () => {
    expect(isOptimizableTx({ ...baseTx, category: '' })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, category: undefined })).toBe(false);
  });

  test('rejects non-object input', () => {
    expect(isOptimizableTx(null)).toBe(false);
    expect(isOptimizableTx(undefined)).toBe(false);
    expect(isOptimizableTx('string')).toBe(false);
    expect(isOptimizableTx(123)).toBe(false);
    expect(isOptimizableTx([])).toBe(false);
  });

  test('rejects objects with wrong field types', () => {
    expect(isOptimizableTx({ ...baseTx, amount: '10000' })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, id: 123 })).toBe(false);
    expect(isOptimizableTx({ ...baseTx, date: 20240115 })).toBe(false);
  });
});
