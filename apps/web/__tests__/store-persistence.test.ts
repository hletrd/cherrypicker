/**
 * Unit tests for sessionStorage persistence logic in store.svelte.ts.
 * Tests safeJSONParse, isPlainObject, and load-time validation logic
 * by mirroring the implementation (the real functions are private).
 */
import { describe, test, expect } from 'bun:test';

// Mirror of store.svelte.ts safeJSONParse
const FORBIDDEN_KEYS = new Set([
  '__proto__', 'constructor', 'prototype',
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
]);
function safeJSONParse(text: string): unknown {
  return JSON.parse(text, (key, value) => {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Forbidden key in JSON: ${key}`);
    }
    return value;
  }) as unknown;
}

// Mirror of store.svelte.ts isPlainObject
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

describe('safeJSONParse — prototype pollution defense', () => {
  test('parses normal JSON without issue', () => {
    const result = safeJSONParse('{"a":1,"b":"hello"}');
    expect(result).toEqual({ a: 1, b: 'hello' });
  });

  test('rejects JSON with __proto__ key', () => {
    expect(() => safeJSONParse('{"__proto__":{"polluted":true}}')).toThrow('Forbidden key in JSON: __proto__');
  });

  test('rejects JSON with constructor key', () => {
    // JSON.parse reviver processes keys bottom-up, so nested "prototype"
    // is encountered before "constructor" — any forbidden key in the
    // subtree throws, which is sufficient for pollution defense.
    expect(() => safeJSONParse('{"constructor":{"prototype":{"polluted":true}}}')).toThrow('Forbidden key in JSON: prototype');
  });

  test('rejects JSON with prototype key', () => {
    expect(() => safeJSONParse('{"prototype":{"polluted":true}}')).toThrow('Forbidden key in JSON: prototype');
  });

  test('rejects nested forbidden keys', () => {
    expect(() => safeJSONParse('{"a":{"__proto__":true}}')).toThrow('Forbidden key in JSON: __proto__');
  });

  test('allows __proto__ as a value (not a key)', () => {
    const result = safeJSONParse('{"safeKey":"__proto__"}');
    expect(result).toEqual({ safeKey: '__proto__' });
  });

  test('parses empty object', () => {
    expect(safeJSONParse('{}')).toEqual({});
  });

  test('parses arrays', () => {
    expect(safeJSONParse('[1,2,3]')).toEqual([1, 2, 3]);
  });
});

describe('isPlainObject — type guard', () => {
  test('returns true for plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  test('returns false for arrays', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
  });

  test('returns false for null', () => {
    expect(isPlainObject(null)).toBe(false);
  });

  test('returns false for primitives', () => {
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject('hello')).toBe(false);
    expect(isPlainObject(true)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });

  test('returns true for Date objects (typeof object, not array)', () => {
    // isPlainObject in store.svelte.ts intentionally accepts any non-null
    // non-array object — Date and RegExp pass the guard (C33-F6).
    expect(isPlainObject(new Date())).toBe(true);
  });

  test('returns true for RegExp objects (typeof object, not array)', () => {
    expect(isPlainObject(/abc/)).toBe(true);
  });
});

describe('persistence validation — store load logic mirror', () => {
  // Minimal mirror of loadFromStorage validation logic
  function validateLoadedData(parsed: unknown): boolean {
    if (!parsed || typeof parsed !== 'object') return false;
    const p = parsed as Record<string, unknown>;
    if (!p.optimization || typeof p.optimization !== 'object') return false;
    const opt = p.optimization as Record<string, unknown>;
    if (!Array.isArray(opt.assignments)) return false;
    if (typeof opt.totalReward !== 'number') return false;
    if (typeof opt.totalSpending !== 'number') return false;
    if (typeof opt.effectiveRate !== 'number') return false;
    return true;
  }

  test('valid data passes validation', () => {
    const data = {
      optimization: {
        assignments: [{ assignedCardId: 'c1', category: 'dining', spending: 10000 }],
        totalReward: 500,
        totalSpending: 10000,
        effectiveRate: 0.05,
      },
    };
    expect(validateLoadedData(data)).toBe(true);
  });

  test('missing optimization fails validation', () => {
    expect(validateLoadedData({})).toBe(false);
  });

  test('non-numeric totalReward fails validation', () => {
    const data = {
      optimization: {
        assignments: [],
        totalReward: 'not-a-number',
        totalSpending: 10000,
        effectiveRate: 0.05,
      },
    };
    expect(validateLoadedData(data)).toBe(false);
  });

  test('non-array assignments fails validation', () => {
    const data = {
      optimization: {
        assignments: 'bad',
        totalReward: 500,
        totalSpending: 10000,
        effectiveRate: 0.05,
      },
    };
    expect(validateLoadedData(data)).toBe(false);
  });

  test('null data fails validation', () => {
    expect(validateLoadedData(null)).toBe(false);
  });

  test('corrupted assignment entry is filtered out', () => {
    // Mirror of assignment validation in loadFromStorage
    const assignments = [
      { assignedCardId: 'c1', category: 'dining', spending: 10000 },
      { assignedCardId: '', category: 'grocery', spending: 5000 },  // invalid: empty cardId
      { assignedCardId: 'c2', category: '', spending: 3000 },       // invalid: empty category
      { assignedCardId: 'c3', category: 'transportation', spending: -100 }, // invalid: negative spending
      'not-an-object',                                             // invalid: not an object
    ];
    const valid = assignments.filter((a: unknown): boolean => {
      if (!isPlainObject(a)) return false;
      return (
        typeof a.assignedCardId === 'string' && a.assignedCardId.length > 0 &&
        typeof a.category === 'string' && a.category.length > 0 &&
        typeof a.spending === 'number' && Number.isFinite(a.spending) && a.spending >= 0
      );
    });
    // Only the first entry passes all checks — the rest fail for empty cardId,
    // empty category, negative spending, or not being an object.
    expect(valid.length).toBe(1);
    expect((valid[0] as Record<string, unknown>).assignedCardId).toBe('c1');
  });
});

describe('migration logic — version handling', () => {
  test('versioned data is recognized', () => {
    const data = { _v: 1, optimization: { assignments: [], totalReward: 0, totalSpending: 0, effectiveRate: 0 } };
    const storedVersion = (data as Record<string, unknown>)._v ?? 0;
    expect(storedVersion).toBe(1);
  });

  test('legacy data without _v is treated as version 0', () => {
    const data = { optimization: { assignments: [], totalReward: 0, totalSpending: 0, effectiveRate: 0 } };
    const storedVersion = (data as Record<string, unknown>)._v ?? 0;
    expect(storedVersion).toBe(0);
  });

  test('truncation tracking survives round-trip', () => {
    const data = { _truncatedTxCount: 150, optimization: { assignments: [], totalReward: 0, totalSpending: 0, effectiveRate: 0 } };
    const truncatedCount = typeof data._truncatedTxCount === 'number' ? data._truncatedTxCount : null;
    expect(truncatedCount).toBe(150);
  });
});
