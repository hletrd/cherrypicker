import { describe, expect, test } from 'bun:test';
import {
  buildConstraints,
  greedyOptimize,
  parseYearMonth,
  type CategorizedTransaction,
} from '@cherrypicker/core';
import { loadCardRule } from '@cherrypicker/rules';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
      {
        month: parseYearMonth('2026-06'),
        spending: 2_000,
        transactionCount: 1,
      },
      {
        month: parseYearMonth('2026-07'),
        spending: 10_000,
        transactionCount: 1,
      },
    ],
    previousSpendingBasis: {
      kind: 'statement-month',
      month: parseYearMonth('2026-06'),
    },
  };
}

function cloneResult(): AnalysisResult {
  return structuredClone(coherentResult());
}

function truncatedResultAt(month: string): AnalysisResult {
  const result = cloneResult();
  result.transactions = undefined;
  result.statementPeriod = {
    start: `${month}-23`,
    end: `${month}-23`,
  };
  result.fullStatementPeriod = result.statementPeriod;
  result.transactionCount = 1;
  result.totalTransactionCount = 1;
  result.monthlyBreakdown = [
    {
      month: parseYearMonth(month),
      spending: 10_000,
      transactionCount: 1,
    },
  ];
  return result;
}

type PortfolioCapLoss =
  NonNullable<AnalysisResult['optimization']['portfolioCapLosses']>[number];

function portfolioCapLossFixture(
  overrides: Partial<PortfolioCapLoss> = {},
): PortfolioCapLoss {
  return {
    transactionId: 'tx-current',
    transactionOccurrence: 0,
    category: 'dining',
    counterfactualCardId: 'card-2',
    counterfactualCardName: '카드 2',
    selectedCardId: 'card-1',
    selectedCardName: '카드 1',
    counterfactualReward: 1_000,
    selectedReward: 500,
    grossSuppressedReward: 700,
    replacementReward: 200,
    netLostReward: 500,
    causes: [
      {
        ruleId: 'reward-1',
        capGroup: 'reward-group',
        capType: 'monthly_category',
        capAmount: 300,
        rewardBeforeCap: 1_000,
        rewardAfterCap: 300,
      },
    ],
    ...overrides,
  };
}

async function kbAllAnalysis(
  transactionCount: number,
): Promise<AnalysisResult> {
  const card = await loadCardRule(
    fileURLToPath(
      new URL(
        '../../../packages/rules/data/cards/kb/kb-all.yaml',
        import.meta.url,
      ),
    ),
  );
  type KbAllTransaction =
    CategorizedTransaction &
    NonNullable<AnalysisResult['transactions']>[number];
  const transactions = Array.from(
    { length: transactionCount },
    (_, index): KbAllTransaction => ({
      id: `amazon-${index + 1}`,
      date: '2026-07-23',
      merchant: 'AMAZON',
      amount: 100_000,
      currency: 'KRW',
      category: 'online_shopping',
      subcategory: undefined,
      confidence: 1,
      paymentType: 'overseas',
      channel: 'online',
      factProvenance: {
        paymentType: 'statement',
        channel: 'statement',
      },
    }),
  );
  const categoryLabels = new Map([
    ['online_shopping', '온라인쇼핑'],
  ]);
  const optimization = greedyOptimize(
    buildConstraints(
      transactions,
      new Map([[card.card.id, 500_000]]),
      categoryLabels,
    ),
    [card],
  );
  const spending = transactionCount * 100_000;

  return {
    success: true,
    bank: 'kb',
    format: 'json',
    statementPeriod: {
      start: '2026-07-23',
      end: '2026-07-23',
    },
    transactionCount,
    fullStatementPeriod: {
      start: '2026-07-23',
      end: '2026-07-23',
    },
    totalTransactionCount: transactionCount,
    parseErrors: [],
    transactions,
    categoryBreakdown: [
      {
        category: 'online_shopping',
        categoryNameKo: '온라인쇼핑',
        spending,
        transactionCount,
      },
    ],
    optimization,
    monthlyBreakdown: [
      {
        month: '2026-07',
        spending,
        transactionCount,
      },
    ],
    previousMonthSpendingOption: 500_000,
    previousSpendingBasis: {
      kind: 'user-total',
      amount: 500_000,
    },
  };
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

  test('distinguishes legacy-unknown telemetry from a coherent current array', () => {
    const legacy = cloneResult();
    expect(legacy.optimization.portfolioCapLosses).toBeUndefined();
    expect(isAnalysisResultCoherent(legacy)).toBe(true);

    const current = cloneResult();
    current.cardIdsOption = ['card-1', 'card-2'];
    current.optimization.portfolioCapLosses = [
      portfolioCapLossFixture(),
    ];
    expect(
      current.optimization.cardResults.some(
        ({ cardId }) => cardId === 'card-2',
      ),
    ).toBe(false);
    expect(isAnalysisResultCoherent(current)).toBe(true);

    current.optimization.portfolioCapLosses = [];
    expect(isAnalysisResultCoherent(current)).toBe(true);
  });

  test.each([
    [
      'transaction occurrence',
      (loss: PortfolioCapLoss) => {
        loss.transactionOccurrence = 0.5;
      },
    ],
    [
      'counterfactual/net arithmetic',
      (loss: PortfolioCapLoss) => {
        loss.netLostReward = 499;
        loss.replacementReward = 201;
      },
    ],
    [
      'gross/replacement arithmetic',
      (loss: PortfolioCapLoss) => {
        loss.replacementReward += 1;
      },
    ],
    [
      'gross cause reconciliation',
      (loss: PortfolioCapLoss) => {
        loss.causes[0]!.rewardBeforeCap = 999;
      },
    ],
    [
      'strict cap reduction',
      (loss: PortfolioCapLoss) => {
        loss.causes = [
          {
            ...loss.causes[0]!,
            capAmount: 1_000,
            rewardAfterCap: 1_000,
          },
          {
            ruleId: 'reward-2',
            capGroup: 'reward-group-2',
            capType: 'monthly_category',
            capAmount: 0,
            rewardBeforeCap: 700,
            rewardAfterCap: 0,
          },
        ];
      },
    ],
    [
      'selected-card nullability',
      (loss: PortfolioCapLoss) => {
        loss.selectedCardId = null;
      },
    ],
    [
      'selected reward without a card',
      (loss: PortfolioCapLoss) => {
        loss.selectedCardId = null;
        loss.selectedCardName = null;
      },
    ],
    [
      'selected card identity',
      (loss: PortfolioCapLoss) => {
        loss.selectedCardId = 'missing-card';
        loss.selectedCardName = '없는 카드';
      },
    ],
    [
      'known counterfactual card identity',
      (loss: PortfolioCapLoss) => {
        loss.counterfactualCardName = '잘못된 카드 이름';
      },
    ],
    [
      'same-card name identity',
      (loss: PortfolioCapLoss) => {
        loss.counterfactualCardId = 'card-1';
      },
    ],
  ])('rejects incoherent portfolio cap loss %s', (_name, mutate) => {
    const result = cloneResult();
    const loss = portfolioCapLossFixture();
    mutate(loss);
    result.optimization.portfolioCapLosses = [loss];

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('rejects duplicate portfolio loss transaction identities', () => {
    const result = cloneResult();
    const loss = portfolioCapLossFixture();
    result.optimization.portfolioCapLosses = [
      loss,
      structuredClone(loss),
    ];

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('bounds grouped selected rewards by their matching assignment', () => {
    const result = cloneResult();
    const second = {
      ...result.transactions![1]!,
      amount: 1,
    };
    result.transactions!.push(second);
    result.transactionCount = 2;
    result.totalTransactionCount = 3;
    result.categoryBreakdown[0]!.spending = 10_001;
    result.categoryBreakdown[0]!.transactionCount = 2;
    result.monthlyBreakdown![1]!.spending = 10_001;
    result.monthlyBreakdown![1]!.transactionCount = 2;
    const assignment = result.optimization.assignments[0]!;
    assignment.spending = 10_001;
    assignment.transactionCount = 2;
    assignment.rate = 500 / 10_001;
    assignment.alternatives[0]!.rate = 400 / 10_001;
    const card = result.optimization.cardResults[0]!;
    card.totalSpending = 10_001;
    card.effectiveRate = 500 / 10_001;
    card.byCategory[0]!.spending = 10_001;
    card.byCategory[0]!.rate = 500 / 10_001;
    result.optimization.totalSpending = 10_001;
    result.optimization.effectiveRate = 500 / 10_001;
    result.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({
        counterfactualReward: 800,
        selectedReward: 300,
      }),
      portfolioCapLossFixture({
        transactionOccurrence: 1,
        counterfactualReward: 700,
        selectedReward: 200,
      }),
    ];
    expect(isAnalysisResultCoherent(result)).toBe(true);

    result.optimization.portfolioCapLosses[1]!.counterfactualReward = 800;
    result.optimization.portfolioCapLosses[1]!.selectedReward = 300;
    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('rejects duplicate cap-cause identities with balanced arithmetic', () => {
    const result = cloneResult();
    const duplicatedCause = {
      ...portfolioCapLossFixture().causes[0]!,
      rewardBeforeCap: 650,
    };
    result.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({
        causes: [duplicatedCause, structuredClone(duplicatedCause)],
      }),
    ];

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('rejects gross suppression above the counterfactual reward', () => {
    const result = cloneResult();
    result.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({
        grossSuppressedReward: 1_100,
        replacementReward: 600,
        causes: [
          {
            ruleId: 'reward-1',
            capGroup: 'reward-group',
            capType: 'monthly_category',
            capAmount: 0,
            rewardBeforeCap: 1_100,
            rewardAfterCap: 0,
          },
        ],
      }),
    ];

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('rejects safe-integer overflow while summing cap causes', () => {
    const result = cloneResult();
    result.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({
        selectedCardId: null,
        selectedCardName: null,
        counterfactualReward: Number.MAX_SAFE_INTEGER,
        selectedReward: 0,
        grossSuppressedReward: Number.MAX_SAFE_INTEGER,
        replacementReward: 0,
        netLostReward: Number.MAX_SAFE_INTEGER,
        causes: [
          {
            ruleId: 'reward-1',
            capGroup: 'reward-group-1',
            capType: 'monthly_category',
            capAmount: 0,
            rewardBeforeCap: Number.MAX_SAFE_INTEGER,
            rewardAfterCap: 0,
          },
          {
            ruleId: 'reward-2',
            capGroup: 'reward-group-2',
            capType: 'monthly_category',
            capAmount: 0,
            rewardBeforeCap: 1,
            rewardAfterCap: 0,
          },
        ],
      }),
    ];

    expect(isAnalysisResultCoherent(result)).toBe(false);
  });

  test('requires full-snapshot losses to identify a latest-month positive transaction', () => {
    const priorMonth = cloneResult();
    priorMonth.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({ transactionId: 'tx-previous' }),
    ];
    expect(isAnalysisResultCoherent(priorMonth)).toBe(false);

    const wrongCategory = cloneResult();
    wrongCategory.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({ category: 'grocery' }),
    ];
    expect(isAnalysisResultCoherent(wrongCategory)).toBe(false);

    const missingOccurrence = cloneResult();
    missingOccurrence.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({ transactionOccurrence: 1 }),
    ];
    expect(isAnalysisResultCoherent(missingOccurrence)).toBe(false);
  });

  test('uses only the category witness when cap-loss transactions were truncated', () => {
    const result = cloneResult();
    result.transactions = undefined;
    result.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({ transactionId: 'omitted-transaction' }),
    ];

    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 2 }),
    ).toBe(true);
    result.optimization.portfolioCapLosses[0]!.category = 'grocery';
    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 2 }),
    ).toBe(false);
  });

  test('checks a counterfactual card against an explicit card selection', () => {
    const result = cloneResult();
    result.optimization.portfolioCapLosses = [
      portfolioCapLossFixture({
        counterfactualCardId: 'card-3',
        counterfactualCardName: '카드 3',
      }),
    ];
    expect(isAnalysisResultCoherent(result)).toBe(true);

    result.cardIdsOption = ['card-1', 'card-2'];
    expect(isAnalysisResultCoherent(result)).toBe(false);
    result.cardIdsOption.push('card-3');
    expect(isAnalysisResultCoherent(result)).toBe(true);
  });

  test.each([
    [
      1,
      5_000,
      [
        {
          ruleId: 'reward-004',
          capGroup: 'reward-004',
          capAmount: 5_000,
        },
      ],
    ],
    [
      2,
      15_000,
      [
        {
          ruleId: 'reward-004',
          capGroup: 'reward-004',
          capAmount: 5_000,
        },
        {
          ruleId: 'reward-001',
          capGroup: 'reward-001',
          capAmount: 10_000,
        },
      ],
    ],
  ] as const)(
    'accepts real kb-all telemetry for %i overseas Amazon purchase(s)',
    async (transactionCount, totalReward, expectedCaps) => {
      const result = await kbAllAnalysis(transactionCount);
      const card = result.optimization.cardResults[0]!;

      expect(result.optimization.totalReward).toBe(totalReward);
      expect(card.capsHit.map(({ capAmount }) => capAmount)).toEqual(
        expectedCaps.map(({ capAmount }) => capAmount),
      );
      expect(isAnalysisResultCoherent(result)).toBe(true);
      expect(card.byCategory[0]).not.toHaveProperty('capAmount');
      expect(
        card.capsHit.map(({ ruleId, capGroup, capAmount }) => ({
          ruleId,
          capGroup,
          capAmount,
        })),
      ).toEqual([...expectedCaps]);
    },
  );

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

  test('rejects a positive-spending zero-count bucket in truncated facts', () => {
    const result = cloneResult();
    result.transactions = undefined;
    result.monthlyBreakdown![0] = {
      month: parseYearMonth('2026-06'),
      spending: 777_777,
      transactionCount: 0,
    };
    result.totalTransactionCount = 1;
    result.previousSpendingBasis = {
      kind: 'missing-calendar-month',
      month: parseYearMonth('2026-06'),
      assumedAmount: 0,
    };

    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 1 }),
    ).toBe(false);
  });

  test('accepts zero spending with a positive previous-month count', () => {
    const result = cloneResult();
    result.transactions = undefined;
    result.monthlyBreakdown![0] = {
      month: parseYearMonth('2026-06'),
      spending: 0,
      transactionCount: 1,
    };
    result.previousSpendingBasis = {
      kind: 'statement-month',
      month: parseYearMonth('2026-06'),
    };

    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 2 }),
    ).toBe(true);
  });

  test('accepts a truncated user-total at the lower calendar bound', () => {
    const result = truncatedResultAt('0000-01');
    result.previousMonthSpendingOption = 300_000;
    result.previousSpendingBasis = {
      kind: 'user-total',
      amount: 300_000,
    };

    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 1 }),
    ).toBe(true);
  });

  test.each([
    'statement-month',
    'missing-calendar-month',
  ] as const)(
    'rejects a truncated %s basis with no representable predecessor',
    (kind) => {
      const result = truncatedResultAt('0000-01');
      result.previousSpendingBasis =
        kind === 'statement-month'
          ? {
              kind,
              month: parseYearMonth('0000-01'),
            }
          : {
              kind,
              month: parseYearMonth('0000-01'),
              assumedAmount: 0,
            };

      let coherent: boolean | undefined;
      expect(() => {
        coherent = isAnalysisResultCoherent(result, {
          truncatedTransactionCount: 1,
        });
      }).not.toThrow();
      expect(coherent).toBe(false);
    },
  );

  test('accepts 0000-01 as the predecessor of truncated 0000-02 facts', () => {
    const result = truncatedResultAt('0000-02');
    result.monthlyBreakdown = [
      {
        month: parseYearMonth('0000-01'),
        spending: 2_000,
        transactionCount: 1,
      },
      ...(result.monthlyBreakdown ?? []),
    ];
    result.totalTransactionCount = 2;
    result.previousSpendingBasis = {
      kind: 'statement-month',
      month: parseYearMonth('0000-01'),
    };

    expect(
      isAnalysisResultCoherent(result, { truncatedTransactionCount: 2 }),
    ).toBe(true);
  });

  test('rejects full transaction facts in year 0000 without throwing', () => {
    const result = cloneResult();
    const currentTransaction = result.transactions?.[1];
    if (!currentTransaction) throw new Error('missing current transaction');
    result.transactions = [
      {
        ...currentTransaction,
        date: '0000-01-23',
      },
    ];

    let coherent: boolean | undefined;
    expect(() => {
      coherent = isAnalysisResultCoherent(result);
    }).not.toThrow();
    expect(coherent).toBe(false);
  });

  test('accepts an explicit no-benefit result with all spending unassigned', () => {
    const result = coherentResult();
    result.transactions = [result.transactions![1]!];
    result.totalTransactionCount = 1;
    result.fullStatementPeriod = result.statementPeriod;
    result.monthlyBreakdown = [
      {
        month: parseYearMonth('2026-07'),
        spending: 10_000,
        transactionCount: 1,
      },
    ];
    result.previousSpendingBasis = {
      kind: 'missing-calendar-month',
      month: parseYearMonth('2026-06'),
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
      month: parseYearMonth('2026-07'),
      spending: transactionCount,
      transactionCount,
    }];
    result.previousSpendingBasis = {
      kind: 'missing-calendar-month',
      month: parseYearMonth('2026-06'),
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
      {
        month: parseYearMonth('2026-07'),
        spending: 15_000,
        transactionCount: 2,
      },
    ];
    result.categoryBreakdown[0]!.spending = 15_000;
    result.categoryBreakdown[0]!.transactionCount = 2;
    result.previousSpendingBasis = {
      kind: 'missing-calendar-month',
      month: parseYearMonth('2026-06'),
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
        (category as { capAmount?: number }).capAmount = 500;
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
