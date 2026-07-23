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

function assignmentFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    assignedCardId: 'card-1',
    assignedCardName: '카드 1',
    category: 'dining',
    categoryNameKo: '외식',
    spending: 10_000,
    reward: 500,
    rate: 0.05,
    alternatives: [],
    ...overrides,
  };
}

function categoryRewardFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    category: 'dining',
    categoryNameKo: '외식',
    spending: 10_000,
    reward: 500,
    rate: 0.05,
    rewardType: 'discount',
    capReached: false,
    ...overrides,
  };
}

function cardResultFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    cardId: 'card-1',
    cardName: '카드 1',
    totalReward: 500,
    totalSpending: 10_000,
    effectiveRate: 0.05,
    byCategory: [categoryRewardFixture()],
    performanceTier: 'tier0',
    capsHit: [],
    ...overrides,
  };
}

function optimizationFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    assignments: [assignmentFixture()],
    cardResults: [],
    totalReward: 500,
    totalSpending: 10_000,
    effectiveRate: 0.05,
    savingsVsSingleCard: 100,
    bestSingleCard: {
      cardId: 'card-1',
      cardName: '카드 1',
      totalReward: 400,
    },
    ...overrides,
  };
}

function persistedFixture(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    _v: STORAGE_VERSION,
    success: true,
    bank: 'shinhan',
    format: 'csv',
    transactionCount: 1,
    parseErrors: [],
    optimization: optimizationFixture(),
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

  test.each([
    ['missing success', { success: undefined }],
    ['string success', { success: 'false' }],
    ['invalid bank', { bank: 7 }],
    ['missing format', { format: undefined }],
    ['missing transaction count', { transactionCount: undefined }],
    ['object monthly breakdown', { monthlyBreakdown: {} }],
    ['object parse warnings', { parseErrors: {} }],
    ['malformed parse warning', { parseErrors: [{ message: 7 }] }],
    ['object card selection', { cardIdsOption: {} }],
    ['mixed card selection', { cardIdsOption: ['card-1', 7] }],
    ['empty card id', { cardIdsOption: [''] }],
  ])(
    'rejects malformed current-version payload fields: %s',
    (_name, override) => {
      const result = deserializeAnalysis(persistedFixture(override));

      expect(result.data).toBeNull();
      expect(result.warningKind).toBe('corrupted');
      expect(result.shouldRemove).toBe(true);
    },
  );

  test.each([
    ['only', 0, 1],
    ['first', 0, 2],
    ['middle', 1, 3],
  ])(
    'rejects an invalid %s transaction with stale derivations atomically',
    (_position, invalidIndex, length) => {
      const transactions = Array.from({ length }, (_, index) => ({
        ...analysisFixture().transactions![0]!,
        id: `tx-${index + 1}`,
      }));
      transactions[invalidIndex] = {
        ...transactions[invalidIndex]!,
        id: '',
      };
      const result = deserializeAnalysis(
        persistedFixture({ transactions }),
      );

      expect(result).toEqual({
        data: null,
        warningKind: 'corrupted',
        truncatedTxCount: null,
        shouldRemove: true,
      });
    },
  );

  test.each([
    ['object', { id: 'tx-1' }],
    ['string', 'not-an-array'],
    ['null', null],
  ])(
    'surfaces an explicitly malformed %s transaction container',
    (_name, transactions) => {
      const result = deserializeAnalysis(
        persistedFixture({ transactions }),
      );

      expect(result).toEqual({
        data: null,
        warningKind: 'corrupted',
        truncatedTxCount: null,
        shouldRemove: true,
      });
    },
  );

  test.each([
    ['subcategory type', { subcategory: 1 }],
    ['empty subcategory', { subcategory: '' }],
    ['missing confidence', { confidence: undefined }],
    ['confidence above one', { confidence: 1.1 }],
    ['fractional installments', { installments: 1.5 }],
    ['zero installments', { installments: 0 }],
    ['payment type enum', { paymentType: 'international' }],
    ['channel enum', { channel: 'mobile' }],
    [
      'object-shaped exclusion tags',
      { performanceExclusionTags: { annual_fee: true } },
    ],
    ['unknown exclusion tag', { performanceExclusionTags: ['future_tag'] }],
    ['array provenance', { factProvenance: [] }],
    [
      'unknown provenance key',
      { factProvenance: { merchant: 'statement' } },
    ],
    [
      'unknown provenance source',
      { factProvenance: { channel: 'model' } },
    ],
    ['memo type', { memo: 7 }],
    ['raw category type', { rawCategory: false }],
    ['impossible transaction date', { date: '2026-02-30' }],
    ['blank merchant', { merchant: '' }],
    ['whitespace-only merchant', { merchant: '   ' }],
  ])('rejects malformed persisted transaction facts atomically: %s', (_name, override) => {
    const transaction = {
      ...analysisFixture().transactions![0]!,
      ...override,
    };
    const result = deserializeAnalysis(
      persistedFixture({ transactions: [transaction] }),
    );

    expect(result).toEqual({
      data: null,
      warningKind: 'corrupted',
      truncatedTxCount: null,
      shouldRemove: true,
    });
  });

  test('accepts every supported optional transaction fact after reload', () => {
    const transaction: NonNullable<AnalysisResult['transactions']>[number] = {
      ...analysisFixture().transactions![0]!,
      subcategory: 'cafe',
      installments: 3,
      rawCategory: '카페',
      memo: '오전 결제',
      paymentType: 'overseas',
      channel: 'online',
      fuelVolumeLiters: 18.5,
      performanceExclusionTags: ['annual_fee', 'overseas'],
      factProvenance: {
        paymentType: 'statement',
        channel: 'user',
        fuelVolumeLiters: 'statement',
        performanceExclusionTags: 'user',
      },
    };
    const result = deserializeAnalysis(
      persistedFixture({ transactions: [transaction] }),
    );

    expect(result.warningKind).toBeNull();
    expect(result.data?.transactions?.[0]).toEqual(transaction);
  });

  test.each([
    ['missing start', { end: '2026-07-31' }],
    ['missing end', { start: '2026-07-01' }],
    ['impossible start', { start: '2026-02-30', end: '2026-03-01' }],
    ['impossible end', { start: '2026-02-01', end: '2026-02-30' }],
    ['reversed order', { start: '2026-07-31', end: '2026-07-01' }],
    ['array shape', ['2026-07-01', '2026-07-31']],
    ['null shape', null],
  ])('rejects malformed statement periods: %s', (_name, period) => {
    for (const field of ['statementPeriod', 'fullStatementPeriod'] as const) {
      const result = deserializeAnalysis(
        persistedFixture({ [field]: period }),
      );
      expect(result.data).toBeNull();
      expect(result.warningKind).toBe('corrupted');
      expect(result.shouldRemove).toBe(true);
    }
  });

  test('accepts real, ordered statement periods', () => {
    const statementPeriod = {
      start: '2026-07-01',
      end: '2026-07-31',
    };
    const result = deserializeAnalysis(
      persistedFixture({
        statementPeriod,
        fullStatementPeriod: {
          start: '2026-06-01',
          end: '2026-07-31',
        },
      }),
    );

    expect(result.data?.statementPeriod).toEqual(statementPeriod);
    expect(result.data?.fullStatementPeriod).toEqual({
      start: '2026-06-01',
      end: '2026-07-31',
    });
  });

  test('rejects individually safe months whose displayed total is unsafe', () => {
    const result = deserializeAnalysis(
      persistedFixture({
        monthlyBreakdown: [
          {
            month: '2026-06',
            spending: Number.MAX_SAFE_INTEGER,
            transactionCount: 1,
          },
          {
            month: '2026-07',
            spending: Number.MAX_SAFE_INTEGER,
            transactionCount: 1,
          },
        ],
      }),
    );

    expect(result.data).toBeNull();
    expect(result.warningKind).toBe('corrupted');
    expect(result.shouldRemove).toBe(true);
  });

  test('accepts fully shaped nested optimization entries', () => {
    const issue = {
      cardId: 'card-1',
      transactionId: 'tx-1',
      ruleId: 'reward-1',
      category: 'dining',
      reason: 'unsupported-rule',
    };
    const result = deserializeAnalysis(
      persistedFixture({
        optimization: optimizationFixture({
          assignments: [
            assignmentFixture({
              alternatives: [
                {
                  cardId: 'card-2',
                  cardName: '카드 2',
                  reward: 400,
                  rate: 0.04,
                },
              ],
            }),
          ],
          cardResults: [
            cardResultFixture({
              capsHit: [
                {
                  category: 'dining',
                  capType: 'monthly_category',
                  capAmount: 500,
                  actualReward: 600,
                  appliedReward: 500,
                },
              ],
              unsupportedRules: [issue],
            }),
          ],
          unsupportedRules: [issue],
        }),
      }),
    );

    expect(result.warningKind).toBeNull();
    expect(result.shouldRemove).toBe(false);
    expect(
      result.data?.optimization.assignments[0]?.alternatives,
    ).toHaveLength(1);
    expect(
      result.data?.optimization.cardResults[0]?.byCategory,
    ).toHaveLength(1);
    expect(result.data?.optimization.cardResults[0]?.capsHit).toHaveLength(1);
  });

  test.each([
    ['missing cardResults', optimizationFixture({ cardResults: undefined })],
    [
      'missing savings comparison',
      optimizationFixture({ savingsVsSingleCard: undefined }),
    ],
    [
      'missing best single card',
      optimizationFixture({ bestSingleCard: undefined }),
    ],
    ['non-array cardResults', optimizationFixture({ cardResults: {} })],
    [
      'non-array optimization issues',
      optimizationFixture({ unsupportedRules: {} }),
    ],
    [
      'non-array assignment alternatives',
      optimizationFixture({
        assignments: [assignmentFixture({ alternatives: {} })],
      }),
    ],
    [
      'non-array category rewards',
      optimizationFixture({
        cardResults: [cardResultFixture({ byCategory: {} })],
      }),
    ],
    [
      'non-array cap details',
      optimizationFixture({
        cardResults: [cardResultFixture({ capsHit: {} })],
      }),
    ],
    [
      'non-array card issues',
      optimizationFixture({
        cardResults: [cardResultFixture({ unsupportedRules: {} })],
      }),
    ],
  ])('rejects malformed optimization container: %s', (_case, optimization) => {
    const result = deserializeAnalysis(persistedFixture({ optimization }));

    expect(result).toEqual({
      data: null,
      warningKind: 'corrupted',
      truncatedTxCount: null,
      shouldRemove: true,
    });
  });

  test.each([
    ['assignment', optimizationFixture({ assignments: [{}] })],
    [
      'alternative',
      optimizationFixture({
        assignments: [assignmentFixture({ alternatives: [{}] })],
      }),
    ],
    ['card result', optimizationFixture({ cardResults: [{}] })],
    [
      'category reward',
      optimizationFixture({
        cardResults: [cardResultFixture({ byCategory: [{}] })],
      }),
    ],
    [
      'cap detail',
      optimizationFixture({
        cardResults: [cardResultFixture({ capsHit: [{}] })],
      }),
    ],
    [
      'optimization issue',
      optimizationFixture({ unsupportedRules: [{}] }),
    ],
    [
      'card issue',
      optimizationFixture({
        cardResults: [cardResultFixture({ unsupportedRules: [{}] })],
      }),
    ],
    [
      'fractional card result reward',
      optimizationFixture({
        cardResults: [cardResultFixture({ totalReward: 1.5 })],
      }),
    ],
    [
      'empty best-card identity',
      optimizationFixture({
        bestSingleCard: {
          cardId: '',
          cardName: '',
          totalReward: 400,
        },
      }),
    ],
  ])('rejects malformed nested optimization entry: %s', (_case, optimization) => {
    const result = deserializeAnalysis(persistedFixture({ optimization }));

    expect(result.data).toBeNull();
    expect(result.warningKind).toBe('corrupted');
    expect(result.shouldRemove).toBe(true);
  });

  test.each([
    Number.MAX_SAFE_INTEGER + 1,
    1.5,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects non-canonical optimization money %s', (amount) => {
    for (const field of ['totalReward', 'totalSpending'] as const) {
      const optimization = optimizationFixture({
        [field]: amount,
      });
      const result = deserializeAnalysis(
        persistedFixture({ optimization }),
      );
      expect(result.data).toBeNull();
      expect(result.shouldRemove).toBe(true);
    }
  });

  test.each([
    Number.MAX_SAFE_INTEGER + 1,
    1.5,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid persisted previous spending %s', (amount) => {
    const result = deserializeAnalysis(
      persistedFixture({ previousMonthSpendingOption: amount }),
    );
    expect(result.data).toBeNull();
    expect(result.warningKind).toBe('corrupted');
  });

  test('rejects unsafe or fractional persisted count fields', () => {
    for (const overrides of [
      { transactionCount: 1.5 },
      { totalTransactionCount: Number.MAX_SAFE_INTEGER + 1 },
      { _truncatedTxCount: -1 },
      {
        monthlyBreakdown: [
          { month: '2026-07', spending: 10_000, transactionCount: 1.5 },
        ],
      },
      {
        monthlyBreakdown: [
          {
            month: '2026-07',
            spending: Number.MAX_SAFE_INTEGER + 1,
            transactionCount: 1,
          },
        ],
      },
    ]) {
      expect(deserializeAnalysis(persistedFixture(overrides)).data).toBeNull();
    }
  });

  test('accepts safe-integer aggregate and count boundaries', () => {
    const result = deserializeAnalysis(
      persistedFixture({
        transactionCount: Number.MAX_SAFE_INTEGER,
        totalTransactionCount: Number.MAX_SAFE_INTEGER,
        previousMonthSpendingOption: Number.MAX_SAFE_INTEGER,
        monthlyBreakdown: [
          {
            month: '2026-07',
            spending: Number.MAX_SAFE_INTEGER,
            transactionCount: Number.MAX_SAFE_INTEGER,
          },
        ],
        optimization: optimizationFixture({
          assignments: [
            assignmentFixture({
              spending: Number.MAX_SAFE_INTEGER,
            }),
          ],
          cardResults: [],
          totalReward: Number.MAX_SAFE_INTEGER,
          totalSpending: Number.MAX_SAFE_INTEGER,
          effectiveRate: 1,
        }),
      }),
    );

    expect(result.shouldRemove).toBe(false);
    expect(result.data?.optimization.totalReward).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(result.data?.monthlyBreakdown?.[0]?.transactionCount).toBe(
      Number.MAX_SAFE_INTEGER,
    );
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

  test('round-trips card-aware calculation issues and rejects malformed identities', () => {
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
    expect(deserializeAnalysis(JSON.stringify(legacy))).toEqual({
      data: null,
      warningKind: 'corrupted',
      truncatedTxCount: null,
      shouldRemove: true,
    });
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

  test('keeps the maximum fuel volume and rejects larger persisted facts atomically', () => {
    const accepted = analysisFixture();
    Object.assign(accepted.transactions![0]!, {
      fuelVolumeLiters: 200,
      factProvenance: { fuelVolumeLiters: 'user' },
    });
    expect(
      deserializeAnalysis(serializeAnalysis(accepted).serialized)
        .data?.transactions?.[0]?.fuelVolumeLiters,
    ).toBe(200);

    for (const fuelVolumeLiters of [200.01, 1e308]) {
      const analysis = analysisFixture();
      analysis.transactions!.push({
        ...analysis.transactions![0]!,
        id: `invalid-${fuelVolumeLiters}`,
        fuelVolumeLiters,
        factProvenance: { fuelVolumeLiters: 'user' },
      });
      const restored = deserializeAnalysis(serializeAnalysis(analysis).serialized);
      expect(restored).toEqual({
        data: null,
        warningKind: 'corrupted',
        truncatedTxCount: null,
        shouldRemove: true,
      });
    }
  });

  test('omits transactions and records their count above the storage budget', () => {
    const oversized = analysisFixture('x'.repeat(MAX_PERSIST_SIZE));
    const { serialized, result } = serializeAnalysis(oversized);
    const parsed = JSON.parse(serialized);

    expect(result).toEqual({ kind: 'truncated', truncatedTxCount: 1 });
    expect(parsed.transactions).toBeUndefined();
    expect(parsed._truncatedTxCount).toBe(1);
    const restored = deserializeAnalysis(serialized);
    expect(restored.warningKind).toBe('truncated');
    expect(restored.truncatedTxCount).toBe(1);
    expect(restored.shouldRemove).toBe(false);
    expect(restored.data?.transactions).toBeUndefined();
    expect(restored.data?.optimization).toEqual(oversized.optimization);
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
      fileName: '나머지 파싱 경고',
      format: '요약',
      count: (MAX_PERSISTED_WARNINGS * 20 - 99) * 2,
      kind: 'summary',
      affectedFileCount: MAX_PERSISTED_WARNINGS * 20,
    });
    expect(serialized).not.toContain('private-statement-row');

    const restored = deserializeAnalysis(serialized).data;
    expect(restored?.parseErrors).toEqual(persisted.parseErrors);
    expect(restored?.parseErrors.every((warning) => !('raw' in warning))).toBe(
      true,
    );
  });

  test('preserves one real affected file across a 101-warning round trip', () => {
    const warnings = Array.from(
      { length: MAX_PERSISTED_WARNINGS + 1 },
      (_, index) => ({
        fileName: 'one.json',
        format: 'json',
        line: index + 1,
        message: `경고 ${index + 1}`,
      }),
    );

    const analysis = analysisFixture();
    analysis.parseErrors = warnings;
    const restored = deserializeAnalysis(
      serializeAnalysis(analysis).serialized,
    );
    const bounded = restored.data?.parseErrors ?? [];

    expect(restored.shouldRemove).toBe(false);
    expect(bounded).toHaveLength(MAX_PERSISTED_WARNINGS);
    expect(bounded.at(-1)).toMatchObject({
      kind: 'summary',
      affectedFileCount: 1,
      count: 2,
    });
    expect(
      new Set(
        bounded
          .filter((warning) => warning.kind !== 'summary')
          .map((warning) => warning.fileName),
      ),
    ).toEqual(new Set(['one.json']));
  });
});
