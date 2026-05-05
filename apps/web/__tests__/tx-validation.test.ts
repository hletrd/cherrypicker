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
}

describe('isOptimizableTx', () => {
  const baseTx: MinimalTx = {
    id: 'tx-1',
    date: '2024-01-15',
    merchant: 'Test Store',
    amount: 10000,
    category: 'dining',
  };

  test('accepts positive amounts', () => {
    expect(isOptimizableTx(baseTx)).toBe(true);
    expect(isOptimizableTx({ ...baseTx, amount: 1 })).toBe(true);
    expect(isOptimizableTx({ ...baseTx, amount: 999999 })).toBe(true);
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
  });

  test('rejects missing merchant', () => {
    expect(isOptimizableTx({ ...baseTx, merchant: undefined })).toBe(false);
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
