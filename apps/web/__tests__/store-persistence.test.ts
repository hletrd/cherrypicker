import { describe, expect, test } from 'bun:test';
import type { AnalysisResult } from '../src/lib/store.svelte.js';
import {
  MAX_PERSISTED_WARNINGS,
  deserializeAnalysis,
  isPlainObject,
  MAX_PERSIST_SIZE,
  MAX_WARNING_FILENAME_LENGTH,
  MAX_WARNING_FORMAT_LENGTH,
  MAX_WARNING_MESSAGE_LENGTH,
  safeJSONParse,
  serializeAnalysis,
  STORAGE_VERSION,
} from '../src/lib/persistence.js';

function persistedFixture(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    _v: STORAGE_VERSION,
    success: true,
    bank: 'shinhan',
    format: 'csv',
    transactionCount: 1,
    optimization: {
      assignments: [
        {
          assignedCardId: 'card-1',
          category: 'dining',
          spending: 10_000,
        },
      ],
      cardResults: [],
      totalReward: 500,
      totalSpending: 10_000,
      effectiveRate: 0.05,
    },
    ...overrides,
  });
}

function analysisFixture(merchant = '테스트 식당'): AnalysisResult {
  return {
    success: true,
    bank: 'shinhan',
    format: 'csv',
    transactionCount: 1,
    parseErrors: [
      {
        fileName: 'july.csv',
        format: 'csv',
        line: 7,
        message: '날짜를 읽을 수 없음',
        raw: 'bad,row',
        count: 1,
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        date: '2026-07-23',
        merchant,
        amount: 10_000,
        category: 'dining',
        subcategory: undefined,
        confidence: 1,
      },
    ],
    optimization: {
      assignments: [],
      totalReward: 0,
      totalSpending: 10_000,
      effectiveRate: 0,
      savingsVsSingleCard: 0,
      bestSingleCard: { cardId: 'card-1', cardName: '카드', totalReward: 0 },
      cardResults: [],
    },
    previousSpendingBasis: {
      kind: 'missing-calendar-month',
      month: '2026-06',
      assumedAmount: 0,
    },
  };
}

describe('production persistence parser', () => {
  test('rejects prototype-pollution keys at any depth', () => {
    expect(() =>
      safeJSONParse('{"nested":{"__proto__":{"polluted":true}}}'),
    ).toThrow('Forbidden key in JSON: __proto__');
    expect(safeJSONParse('{"safe":"__proto__"}')).toEqual({
      safe: '__proto__',
    });
  });

  test('accepts only plain objects', () => {
    expect(isPlainObject({ value: 1 })).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(null)).toBe(false);
  });

  test('loads legacy version-zero data through the bounded migration path', () => {
    const legacy = JSON.parse(persistedFixture()) as Record<string, unknown>;
    delete legacy._v;
    const result = deserializeAnalysis(JSON.stringify(legacy));

    expect(result.shouldRemove).toBe(false);
    expect(result.data?.bank).toBe('shinhan');
  });

  test('rejects malformed or future versions and requests storage cleanup', () => {
    for (const value of [-1, STORAGE_VERSION + 1, 1.5, '1']) {
      const result = deserializeAnalysis(persistedFixture({ _v: value }));
      expect(result.data).toBeNull();
      expect(result.warningKind).toBe('corrupted');
      expect(result.shouldRemove).toBe(true);
    }
  });

  test('filters unsafe assignments and reports corrupted transactions', () => {
    const result = deserializeAnalysis(
      persistedFixture({
        transactions: [{ id: '', date: 1 }],
        optimization: {
          assignments: [
            {
              assignedCardId: 'card-1',
              category: 'dining',
              spending: 10_000,
            },
            { assignedCardId: '', category: 'dining', spending: 10_000 },
            {
              assignedCardId: 'card-2',
              category: 'dining',
              spending: -1,
            },
          ],
          cardResults: [],
          totalReward: 500,
          totalSpending: 10_000,
          effectiveRate: 0.05,
        },
      }),
    );

    expect(result.data?.optimization.assignments).toHaveLength(1);
    expect(result.data?.transactions).toBeUndefined();
    expect(result.warningKind).toBe('corrupted');
  });
});

describe('production persistence serializer', () => {
  test('round-trips a normal analysis payload with its schema version', () => {
    const { serialized, result } = serializeAnalysis(analysisFixture());
    expect(result).toEqual({ kind: null, truncatedTxCount: null });
    expect(JSON.parse(serialized)._v).toBe(STORAGE_VERSION);
    const restored = deserializeAnalysis(serialized).data;
    expect(restored?.transactions).toHaveLength(1);
    expect(restored?.parseErrors).toEqual([
      {
        fileName: 'july.csv',
        format: 'csv',
        line: 7,
        message: '날짜를 읽을 수 없음',
        count: 1,
      },
    ]);
    expect(restored?.previousSpendingBasis).toEqual(
      analysisFixture().previousSpendingBasis,
    );
  });

  test('round-trips card-aware calculation issues and drops legacy identities', () => {
    const analysis = analysisFixture();
    analysis.optimization.unsupportedRules = [
      {
        cardId: 'card-a',
        transactionId: 'tx-1',
        ruleId: 'reward-001',
        category: 'dining',
        reason: 'rule_marked_unsupported',
      },
      {
        cardId: 'card-b',
        transactionId: 'tx-1',
        ruleId: 'reward-001',
        category: 'dining',
        reason: 'rule_marked_unsupported',
      },
    ];

    const restored = deserializeAnalysis(serializeAnalysis(analysis).serialized);
    expect(restored.data?.optimization.unsupportedRules).toEqual(
      analysis.optimization.unsupportedRules,
    );

    const legacy = JSON.parse(serializeAnalysis(analysis).serialized);
    delete legacy.optimization.unsupportedRules[0].cardId;
    expect(
      deserializeAnalysis(JSON.stringify(legacy))
        .data?.optimization.unsupportedRules,
    ).toEqual([analysis.optimization.unsupportedRules[1]]);
  });

  test('round-trips typed facts and their provenance for reoptimization', () => {
    const analysis = analysisFixture();
    Object.assign(analysis.transactions![0]!, {
      paymentType: 'overseas',
      channel: 'online',
      fuelVolumeLiters: 18.5,
      performanceExclusionTags: ['annual_fee'],
      factProvenance: {
        paymentType: 'statement',
        channel: 'statement',
        fuelVolumeLiters: 'statement',
        performanceExclusionTags: 'statement',
      },
    });

    const restored = deserializeAnalysis(serializeAnalysis(analysis).serialized);
    expect(restored.data?.transactions?.[0]).toMatchObject({
      paymentType: 'overseas',
      channel: 'online',
      fuelVolumeLiters: 18.5,
      performanceExclusionTags: ['annual_fee'],
      factProvenance: {
        paymentType: 'statement',
        channel: 'statement',
        fuelVolumeLiters: 'statement',
        performanceExclusionTags: 'statement',
      },
    });
  });

  test('omits transactions and records their count above the storage budget', () => {
    const oversized = analysisFixture('x'.repeat(MAX_PERSIST_SIZE));
    const { serialized, result } = serializeAnalysis(oversized);
    const parsed = JSON.parse(serialized);

    expect(result).toEqual({ kind: 'truncated', truncatedTxCount: 1 });
    expect(parsed.transactions).toBeUndefined();
    expect(parsed._truncatedTxCount).toBe(1);
    expect(deserializeAnalysis(serialized).warningKind).toBe('truncated');
  });

  test('persists a bounded warning summary without raw statement content', () => {
    const warningHeavy = analysisFixture();
    warningHeavy.parseErrors = Array.from(
      { length: MAX_PERSISTED_WARNINGS * 20 },
      (_, index) => ({
        fileName: `statement-${index}-${'f'.repeat(
          MAX_WARNING_FILENAME_LENGTH * 2,
        )}.csv`,
        format: `csv-${'x'.repeat(MAX_WARNING_FORMAT_LENGTH * 2)}`,
        line: index + 1,
        message: `경고 ${index}: ${'m'.repeat(
          MAX_WARNING_MESSAGE_LENGTH * 2,
        )}`,
        raw: `private-statement-row-${index}-${'r'.repeat(2_048)}`,
        count: 2,
      }),
    );

    const { serialized, result } = serializeAnalysis(warningHeavy);
    const serializedBytes = new TextEncoder().encode(serialized).length;
    const persisted = JSON.parse(serialized);

    expect(serializedBytes).toBeLessThanOrEqual(MAX_PERSIST_SIZE);
    expect(result).toEqual({ kind: null, truncatedTxCount: null });
    expect(persisted.transactions).toHaveLength(1);
    expect(persisted.parseErrors).toHaveLength(MAX_PERSISTED_WARNINGS);
    expect(persisted.parseErrors[0].fileName.startsWith('statement-0-')).toBe(
      true,
    );
    expect(persisted.parseErrors[0].fileName.length).toBeLessThanOrEqual(
      MAX_WARNING_FILENAME_LENGTH,
    );
    expect(persisted.parseErrors[0].format.length).toBeLessThanOrEqual(
      MAX_WARNING_FORMAT_LENGTH,
    );
    expect(persisted.parseErrors[0].message.length).toBeLessThanOrEqual(
      MAX_WARNING_MESSAGE_LENGTH,
    );
    expect(persisted.parseErrors[0]).not.toHaveProperty('raw');
    expect(persisted.parseErrors.at(-1)).toMatchObject({
      fileName: '기타 업로드 파일',
      format: '요약',
      count: (MAX_PERSISTED_WARNINGS * 20 - 99) * 2,
    });
    expect(serialized).not.toContain('private-statement-row');

    const restored = deserializeAnalysis(serialized).data;
    expect(restored?.parseErrors).toEqual(persisted.parseErrors);
    expect(restored?.parseErrors.every((warning) => !('raw' in warning))).toBe(
      true,
    );
  });
});
