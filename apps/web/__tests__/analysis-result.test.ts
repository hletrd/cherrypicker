import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  buildCategorySpendingSummary,
  isAnalysisResultCoherent,
  normalizeCardIdsOption,
  type AnalysisResult,
} from '../src/lib/analysis-result.js';

function coherentResult(): AnalysisResult {
  return {
    success: true,
    bank: 'shinhan',
    format: 'csv',
    statementPeriod: {
      start: '2026-07-23',
      end: '2026-07-23',
    },
    transactionCount: 1,
    fullStatementPeriod: {
      start: '2026-06-20',
      end: '2026-07-23',
    },
    totalTransactionCount: 2,
    parseErrors: [],
    transactions: [
      {
        id: 'tx-previous',
        date: '2026-06-20',
        merchant: '지난달 식당',
        amount: 2_000,
        category: 'dining',
        subcategory: undefined,
        confidence: 1,
      },
      {
        id: 'tx-current',
        date: '2026-07-23',
        merchant: '이번달 식당',
        amount: 10_000,
        category: 'dining',
        subcategory: undefined,
        confidence: 1,
      },
    ],
    categoryBreakdown: [
      {
        category: 'dining',
        categoryNameKo: '외식',
        spending: 10_000,
        transactionCount: 1,
      },
    ],
    optimization: {
      assignments: [
        {
          assignedCardId: 'card-1',
          assignedCardName: '카드 1',
          category: 'dining',
          categoryNameKo: '외식',
          spending: 10_000,
          transactionCount: 1,
          reward: 500,
          rate: 0.05,
          alternatives: [
            {
              cardId: 'card-2',
              cardName: '카드 2',
              reward: 400,
              rate: 0.04,
            },
          ],
        },
      ],
      cardResults: [
        {
          cardId: 'card-1',
          cardName: '카드 1',
          totalReward: 500,
          totalSpending: 10_000,
          effectiveRate: 0.05,
          byCategory: [
            {
              category: 'dining',
              categoryNameKo: '외식',
              spending: 10_000,
              reward: 500,
              rate: 0.05,
              rewardType: 'discount',
              capReached: false,
            },
          ],
          performanceTier: 'tier0',
          capsHit: [],
        },
      ],
      totalReward: 500,
      totalSpending: 10_000,
      unassignedSpending: 0,
      unassignedTransactionCount: 0,
      effectiveRate: 0.05,
      savingsVsSingleCard: 100,
      bestSingleCard: {
        cardId: 'card-2',
        cardName: '카드 2',
        totalReward: 400,
      },
    },
    monthlyBreakdown: [
      { month: '2026-06', spending: 2_000, transactionCount: 1 },
      { month: '2026-07', spending: 10_000, transactionCount: 1 },
    ],
    previousSpendingBasis: {
      kind: 'statement-month',
      month: '2026-06',
    },
  };
}

function cloneResult(): AnalysisResult {
  return structuredClone(coherentResult());
}

describe('analysis result coherence', () => {
  test('builds category spending independently of card reward selection', () => {
    const current = coherentResult().transactions![1]!;
    const summary = buildCategorySpendingSummary(
      [
        current,
        { ...current, id: 'tx-cafe', amount: 2_000, subcategory: 'cafe' },
        { ...current, id: 'tx-refund', amount: -500 },
      ],
      new Map([
        ['dining', '외식'],
        ['dining.cafe', '카페'],
      ]),
    );

    expect(summary).toEqual([
      {
        category: 'dining',
        categoryNameKo: '외식',
        spending: 10_000,
        transactionCount: 1,
      },
      {
        category: 'dining.cafe',
        categoryNameKo: '카페',
        spending: 2_000,
        transactionCount: 1,
      },
    ]);
  });

  test('keeps domain producers independent of the Svelte store', () => {
    for (const relativePath of [
      '../src/lib/analysis-result.ts',
      '../src/lib/analyzer.ts',
      '../src/lib/persistence.ts',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      expect(source).not.toMatch(/from ['"].*store\.svelte/);
    }
    expect(
      readFileSync(
        new URL('../src/lib/analysis-result.ts', import.meta.url),
        'utf8',
      ),
    ).not.toContain('$state');
  });

  test('accepts one coherent calculated snapshot', () => {
    expect(isAnalysisResultCoherent(coherentResult())).toBe(true);
  });

  test('requires previous-spending provenance for full and truncated results', () => {
    const full = cloneResult() as AnalysisResult & {
      previousSpendingBasis?: AnalysisResult['previousSpendingBasis'];
    };
    Reflect.deleteProperty(full, 'previousSpendingBasis');
    expect(isAnalysisResultCoherent(full)).toBe(false);

    const truncated = cloneResult() as AnalysisResult & {
      previousSpendingBasis?: AnalysisResult['previousSpendingBasis'];
    };
    truncated.transactions = undefined;
    Reflect.deleteProperty(truncated, 'previousSpendingBasis');
    expect(
      isAnalysisResultCoherent(truncated, { truncatedTransactionCount: 2 }),
    ).toBe(false);
  });

  test('requires exact basis-dependent presence of the redundant user option', () => {
    const missingUserOption = cloneResult();
    missingUserOption.previousSpendingBasis = {
      kind: 'user-total',
      amount: 300_000,
    };
    expect(isAnalysisResultCoherent(missingUserOption)).toBe(false);

    const exactUserOption = cloneResult();
    exactUserOption.previousSpendingBasis = {
      kind: 'user-total',
      amount: 300_000,
    };
    exactUserOption.previousMonthSpendingOption = 300_000;
    expect(isAnalysisResultCoherent(exactUserOption)).toBe(true);

    exactUserOption.previousMonthSpendingOption = 299_999;
    expect(isAnalysisResultCoherent(exactUserOption)).toBe(false);

    const statementWithUserOption = cloneResult();
    statementWithUserOption.previousMonthSpendingOption = 300_000;
    expect(isAnalysisResultCoherent(statementWithUserOption)).toBe(false);

    const truncated = cloneResult();
    truncated.transactions = undefined;
    truncated.previousMonthSpendingOption = 300_000;
    expect(
      isAnalysisResultCoherent(truncated, { truncatedTransactionCount: 2 }),
    ).toBe(false);
  });

  test('accepts an explicit no-benefit result with all spending unassigned', () => {
    const result = coherentResult();
    result.transactions = [result.transactions![1]!];
    result.totalTransactionCount = 1;
    result.fullStatementPeriod = result.statementPeriod;
    result.monthlyBreakdown = [
      { month: '2026-07', spending: 10_000, transactionCount: 1 },
    ];
    result.previousSpendingBasis = {
      kind: 'missing-calendar-month',
      month: '2026-06',
      assumedAmount: 0,
    };
    result.optimization = {
      assignments: [],
      cardResults: [],
      totalReward: 0,
      totalSpending: 10_000,
      unassignedSpending: 10_000,
      unassignedTransactionCount: 1,
      effectiveRate: 0,
      savingsVsSingleCard: 0,
      bestSingleCard: null,
    };

    expect(isAnalysisResultCoherent(result)).toBe(true);
  });

  test('requires explicit honest provenance for an intentional truncation', () => {
    const result = coherentResult();
    result.transactions = undefined;

    expect(isAnalysisResultCoherent(result)).toBe(false);
    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 1 }),
    ).toBe(false);
    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 2 }),
    ).toBe(true);
    result.transactionCount = 0;
    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 2 }),
    ).toBe(false);
  });

  test('does not sort transaction-sized arrays during coherence validation', () => {
    const transactionCount = 2_000;
    const result = coherentResult();
    result.transactions = Array.from(
      { length: transactionCount },
      (_, index) => ({
        id: `tx-${index}`,
        date: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
        merchant: `가맹점 ${index}`,
        amount: 1,
        category: 'dining',
        subcategory: undefined,
        confidence: 1,
      }),
    );
    result.statementPeriod = {
      start: '2026-07-01',
      end: '2026-07-28',
    };
    result.fullStatementPeriod = result.statementPeriod;
    result.transactionCount = transactionCount;
    result.totalTransactionCount = transactionCount;
    result.categoryBreakdown = [{
      category: 'dining',
      categoryNameKo: '외식',
      spending: transactionCount,
      transactionCount,
    }];
    result.optimization = {
      assignments: [],
      cardResults: [],
      totalReward: 0,
      totalSpending: transactionCount,
      unassignedSpending: transactionCount,
      unassignedTransactionCount: transactionCount,
      effectiveRate: 0,
      savingsVsSingleCard: 0,
      bestSingleCard: null,
    };
    result.monthlyBreakdown = [{
      month: '2026-07',
      spending: transactionCount,
      transactionCount,
    }];
    result.previousSpendingBasis = {
      kind: 'missing-calendar-month',
      month: '2026-06',
      assumedAmount: 0,
    };

    const originalSort = Array.prototype.sort;
    let transactionSizedSorts = 0;
    Array.prototype.sort = function (...args) {
      if (this.length >= transactionCount) transactionSizedSorts++;
      return originalSort.apply(this, args as [compareFn?: (a: unknown, b: unknown) => number]);
    };
    try {
      expect(isAnalysisResultCoherent(result)).toBe(true);
    } finally {
      Array.prototype.sort = originalSort;
    }
    expect(transactionSizedSorts).toBe(0);
  });

  test('normalizes an explicit replacement card selection before validation', () => {
    expect(
      normalizeCardIdsOption(['card-2', 'card-2'], ['card-1']),
    ).toEqual(['card-2']);
    expect(normalizeCardIdsOption([], ['card-1'])).toBeUndefined();
    expect(normalizeCardIdsOption(undefined, ['card-1', 'card-1'])).toEqual([
      'card-1',
    ]);
  });

  test('persists the normalized selection used for reoptimization', () => {
    const store = readFileSync(
      new URL('../src/lib/store.svelte.ts', import.meta.url),
      'utf8',
    );
    expect(store).toContain('const selectedCardIds = normalizeCardIdsOption(');
    expect(store).toContain('cardIds: selectedCardIds');
    expect(store).toContain('cardIdsOption: selectedCardIds');
    expect(store).toContain('if (!isAnalysisResultCoherent(nextResult))');
  });

  test('rejects a balanced cross-card allocation contradiction', () => {
    const result = cloneResult();
    const card = result.optimization.cardResults[0]!;
    card.totalSpending = 6_000;
    card.totalReward = 300;
    card.byCategory[0]!.spending = 6_000;
    card.byCategory[0]!.reward = 300;
    result.optimization.cardResults.push({
      ...structuredClone(card),
      cardId: 'card-2',
      cardName: '카드 2',
      totalSpending: 4_000,
      totalReward: 200,
      byCategory: [
        {
          ...structuredClone(card.byCategory[0]!),
          spending: 4_000,
          reward: 200,
        },
      ],
    });

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('rejects a card/category allocation contradiction with balanced totals', () => {
    const result = cloneResult();
    result.optimization.cardResults[0]!.byCategory[0]!.category = 'grocery';

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('rejects coordinated assignment and card category relabeling', () => {
    const result = cloneResult();
    result.optimization.assignments[0]!.category = 'grocery';
    result.optimization.cardResults[0]!.byCategory[0]!.category = 'grocery';

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('requires the exact transaction count when every purchase is unassigned', () => {
    const result = coherentResult();
    const current = result.transactions![1]!;
    result.transactions = [
      current,
      {
        ...current,
        id: 'tx-current-2',
        amount: 5_000,
      },
    ];
    result.transactionCount = 2;
    result.totalTransactionCount = 2;
    result.fullStatementPeriod = result.statementPeriod;
    result.monthlyBreakdown = [
      { month: '2026-07', spending: 15_000, transactionCount: 2 },
    ];
    result.categoryBreakdown[0]!.spending = 15_000;
    result.categoryBreakdown[0]!.transactionCount = 2;
    result.previousSpendingBasis = {
      kind: 'missing-calendar-month',
      month: '2026-06',
      assumedAmount: 0,
    };
    result.optimization = {
      assignments: [],
      cardResults: [],
      totalReward: 0,
      totalSpending: 15_000,
      unassignedSpending: 15_000,
      unassignedTransactionCount: 1,
      effectiveRate: 0,
      savingsVsSingleCard: 0,
      bestSingleCard: null,
    };

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test.each([
    [
      'applied reward above actual reward',
      (result: AnalysisResult) => {
        const category = result.optimization.cardResults[0]!.byCategory[0]!;
        category.capReached = true;
        result.optimization.cardResults[0]!.capsHit = [
          {
            category: 'dining',
            capType: 'monthly_total',
            capAmount: 500,
            actualReward: 100,
            appliedReward: 101,
          },
        ];
      },
    ],
    [
      'unknown cap category',
      (result: AnalysisResult) => {
        result.optimization.cardResults[0]!.capsHit = [
          {
            category: 'grocery',
            capType: 'monthly_total',
            capAmount: 500,
            actualReward: 100,
            appliedReward: 100,
          },
        ];
      },
    ],
    [
      'capReached without telemetry',
      (result: AnalysisResult) => {
        result.optimization.cardResults[0]!.byCategory[0]!.capReached = true;
      },
    ],
    [
      'monthly-category cap amount mismatch',
      (result: AnalysisResult) => {
        const category = result.optimization.cardResults[0]!.byCategory[0]!;
        category.capReached = true;
        category.capAmount = 500;
        result.optimization.cardResults[0]!.capsHit = [
          {
            category: 'dining',
            capType: 'monthly_category',
            capAmount: 400,
            actualReward: 500,
            appliedReward: 400,
          },
        ];
      },
    ],
  ])('rejects impossible cap telemetry: %s', (_name, mutate) => {
    const result = cloneResult();
    mutate(result);
    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test.each([
    [
      'optimized-month count',
      (result: AnalysisResult) => {
        result.transactionCount += 1;
      },
    ],
    [
      'all-month count',
      (result: AnalysisResult) => {
        result.totalTransactionCount = 1;
      },
    ],
    [
      'statement period',
      (result: AnalysisResult) => {
        result.statementPeriod!.start = '2026-07-01';
      },
    ],
    [
      'monthly spending',
      (result: AnalysisResult) => {
        result.monthlyBreakdown![1]!.spending += 1;
      },
    ],
    [
      'monthly count',
      (result: AnalysisResult) => {
        result.monthlyBreakdown![0]!.transactionCount += 1;
      },
    ],
    [
      'optimization spending',
      (result: AnalysisResult) => {
        result.optimization.totalSpending += 1;
      },
    ],
    [
      'optimization reward',
      (result: AnalysisResult) => {
        result.optimization.totalReward += 1;
      },
    ],
    [
      'optimization rate',
      (result: AnalysisResult) => {
        result.optimization.effectiveRate = 0.5;
      },
    ],
    [
      'assignment spending',
      (result: AnalysisResult) => {
        result.optimization.assignments[0]!.spending += 1;
      },
    ],
    [
      'assignment reward',
      (result: AnalysisResult) => {
        result.optimization.assignments[0]!.reward += 1;
      },
    ],
    [
      'assignment rate',
      (result: AnalysisResult) => {
        result.optimization.assignments[0]!.rate = 0.5;
      },
    ],
    [
      'card result spending',
      (result: AnalysisResult) => {
        result.optimization.cardResults[0]!.totalSpending += 1;
      },
    ],
    [
      'card result reward',
      (result: AnalysisResult) => {
        result.optimization.cardResults[0]!.totalReward += 1;
      },
    ],
    [
      'category rate',
      (result: AnalysisResult) => {
        result.optimization.cardResults[0]!.byCategory[0]!.rate = 0.5;
      },
    ],
    [
      'savings comparison',
      (result: AnalysisResult) => {
        result.optimization.savingsVsSingleCard += 1;
      },
    ],
    [
      'duplicate transaction identity',
      (result: AnalysisResult) => {
        result.transactions![1]!.id = result.transactions![0]!.id;
      },
    ],
    [
      'assignment card reference',
      (result: AnalysisResult) => {
        result.optimization.assignments[0]!.assignedCardId = 'missing-card';
      },
    ],
  ])('rejects an independently corrupted %s', (_name, mutate) => {
    const result = cloneResult();
    mutate(result);
    expect(isAnalysisResultCoherent(result)).toBe(false);
  });
});
