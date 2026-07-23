import { MerchantMatcher, buildConstraints, greedyOptimize } from '@cherrypicker/core';
import type { CategorizedTransaction } from '@cherrypicker/core';
import type { PerformanceExclusionId } from '@cherrypicker/rules/browser';
import { parseFile } from './parser/index.js';
import type { RawTransaction } from './parser/types.js';
import type { BankId } from './parser/types.js';
import { loadCategories, loadOptimizerCatalog } from './cards.js';

const VALID_BANK_IDS: Set<string> = new Set([
  'hyundai', 'kb', 'ibk', 'woori', 'samsung', 'shinhan', 'lotte', 'hana', 'nh', 'bc',
  'kakao', 'toss', 'kbank', 'bnk', 'dgb', 'suhyup', 'jb', 'kwangju', 'jeju', 'sc',
  'mg', 'cu', 'kdb', 'epost',
]);
import type { CategoryNode } from './cards.js';
import { buildCategoryLabelMap } from './category-labels.js';
import type {
  AnalysisResult,
  AnalyzeExecution,
  AnalyzeOptions,
} from './store.svelte.js';
import {
  buildAnalysisContext,
  type PreviousSpendingBasis,
} from './analysis-context.js';
import {
  assertCatalogAvailable,
  assertRequestedCardsResolved,
  attachParseWarningIdentity,
  toRulesCategoryNodes,
} from './analyzer-helpers.js';
import { calculatePerformanceSpending } from './performance-spending.js';
import { runFileParseQueue } from './file-parse-queue.js';

export interface CategorizedTx {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  installments?: number;
  category: string;
  subcategory: string | undefined;
  confidence: number;
  rawCategory?: string;
  memo?: string;
  paymentType?: 'domestic' | 'overseas';
  channel?: 'online' | 'offline';
  fuelVolumeLiters?: number;
  performanceExclusionTags?: PerformanceExclusionId[];
}

export async function parseAndCategorize(
  file: File,
  options?: AnalyzeOptions,
  fileIndex?: number,
  matcher?: MerchantMatcher,
  categoryNodes?: CategoryNode[],
): Promise<{ transactions: CategorizedTx[]; bank: string | null; format: string; statementPeriod?: { start: string; end: string }; parseErrors: { line?: number; message: string; raw?: string }[]; categoryNodes: CategoryNode[] }> {
  const resolvedBank: BankId | undefined =
    options?.bank && VALID_BANK_IDS.has(options.bank)
      ? (options.bank as BankId)
      : undefined;
  const parseResult = await parseFile(file, resolvedBank);
  if (parseResult.transactions.length === 0) {
    throw new Error('거래 내역을 찾을 수 없어요');
  }

  // Use provided categoryNodes (from analyzeMultipleFiles) or fetch fresh.
  // When a matcher is provided, the caller already loaded categories — skip
  // the redundant loadCategories() call to avoid an unnecessary await (C81-03).
  const nodes = categoryNodes ?? await loadCategories();
  // Guard against empty categories — loadCategories() returns [] on AbortError
  // (component unmount during fetch). Proceeding would produce silently wrong
  // results with all transactions as "uncategorized" (C71-02).
  if (nodes.length === 0) {
    throw new Error('카테고리 데이터를 불러올 수 없어요. 다시 시도해 보세요.');
  }
  // Reuse the provided matcher (from analyzeMultipleFiles) or construct a new
  // one for backward compatibility (e.g., analyzeFile single-call path).
  // MerchantMatcher expects CategoryNode[] from @cherrypicker/rules which has
  // { id, labelKo, labelEn, keywords, subcategories? }. We project our local
  // type (which has an extra `label` field) to the rules shape via the adapter.
  const effectiveMatcher = matcher ?? new MerchantMatcher(toRulesCategoryNodes(nodes));

  // Include fileIndex in the ID to prevent collisions when multiple files
  // are uploaded — without it, each file produces tx-0 through tx-N and
  // the merged list has duplicate IDs, breaking Svelte keyed-each and
  // the changeCategory function in TransactionReview.
  const idPrefix = fileIndex !== undefined ? `f${fileIndex}-` : '';

  const transactions: CategorizedTx[] = parseResult.transactions.map(
    (tx: RawTransaction, idx: number) => {
      const match = effectiveMatcher.match(tx.merchant, tx.category);
      return {
        id: `tx-${idPrefix}${idx}`,
        date: tx.date,
        merchant: tx.merchant,
        amount: tx.amount,
        installments: tx.installments,
        category: match.category,
        subcategory: match.subcategory,
        confidence: match.confidence,
        rawCategory: tx.category,
        memo: tx.memo,
      };
    },
  );

  return {
    transactions,
    bank: parseResult.bank ?? null,
    format: parseResult.format ?? 'csv',
    statementPeriod: parseResult.statementPeriod,
    parseErrors: parseResult.errors ?? [],
    categoryNodes: nodes,
  };
}

export async function optimizeFromTransactions(
  transactions: CategorizedTx[],
  options?: AnalyzeOptions,
  prebuiltCategoryLabels?: Map<string, string>,
): Promise<AnalysisResult['optimization']> {
  // Convert CategorizedTx to CategorizedTransaction for the optimizer
  const categorized: CategorizedTransaction[] = transactions.map(tx => ({
    id: tx.id,
    date: tx.date,
    merchant: tx.merchant,
    amount: tx.amount,
    currency: 'KRW',
    installments: tx.installments,
    rawCategory: tx.rawCategory,
    memo: tx.memo,
    category: tx.category,
    subcategory: tx.subcategory,
    confidence: tx.confidence,
    paymentType: tx.paymentType,
    channel: tx.channel,
    fuelVolumeLiters: tx.fuelVolumeLiters,
    performanceExclusionTags: tx.performanceExclusionTags,
  }));

  // The generated optimizer artifact already has the canonical core shape.
  // Its loader validates and caches the original JSON object graph once.
  let coreRules = await loadOptimizerCatalog();
  assertCatalogAvailable(coreRules.length);

  // Apply cardIds filter AFTER cache retrieval to avoid returning stale
  // unfiltered rules when a filtered set is requested.
  if (options?.cardIds && options.cardIds.length > 0) {
    const idSet = new Set(options.cardIds);
    coreRules = coreRules.filter(r => idSet.has(r.card.id));
  }
  assertRequestedCardsResolved(options?.cardIds, coreRules.length);

  // 전월실적 기본값: 사용자가 입력하지 않으면 이번 달 총 지출과 같다고 가정
  // 단, 카드사별 performanceExclusions에 포함된 카테고리의 지출은 전월실적에서 제외
  // 각 카드마다 제외 항목이 다르므로 카드별로 개별 계산
  // Pre-compute total positive spending for the fast-path (cards with no exclusions).
  const previousBasis: PreviousSpendingBasis | undefined =
    options?.previousSpendingBasis ??
    (options?.previousMonthSpending !== undefined &&
    Number.isFinite(options.previousMonthSpending) &&
    options.previousMonthSpending >= 0
      ? { kind: 'user-total', amount: options.previousMonthSpending }
      : undefined);
  const performanceTransactions =
    options?.previousMonthTransactions ?? transactions;
  const totalPositiveSpending = performanceTransactions.reduce(
    (sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0),
    0,
  );
  const cardPreviousSpending = new Map<string, number>();
  const performanceBasisIssues: NonNullable<
    AnalysisResult['optimization']['unsupportedRules']
  > = [];
  for (const rule of coreRules) {
    if (previousBasis?.kind === 'user-total') {
      cardPreviousSpending.set(rule.card.id, previousBasis.amount);
    } else if (previousBasis?.kind === 'missing-calendar-month') {
      cardPreviousSpending.set(rule.card.id, previousBasis.assumedAmount);
    } else if (rule.performanceExclusions.length === 0) {
      // Fast path: no exclusions means all positive spending qualifies
      cardPreviousSpending.set(rule.card.id, totalPositiveSpending);
    } else {
      const performance = calculatePerformanceSpending(
        performanceTransactions,
        rule.performanceExclusions,
      );
      cardPreviousSpending.set(rule.card.id, performance.amount);
      if (performance.unknownExclusions.length > 0) {
        performanceBasisIssues.push({
          transactionId: 'performance-basis',
          ruleId: `${rule.card.id}:performance-exclusions`,
          category: 'performance',
          reason: 'missing_performance_exclusion_fact',
          detail:
            '전월실적 제외 여부를 확인할 거래 정보가 없어 실적을 0원으로 처리했어요: ' +
            performance.unknownExclusions.join(', '),
        });
      }
    }
  }
  // Build category labels map from taxonomy for the optimizer
  // Skip loadCategories() if labels were pre-built by the caller
  let categoryLabels = prebuiltCategoryLabels;
  if (!categoryLabels) {
    const categoryNodes = await loadCategories();
    categoryLabels = buildCategoryLabelMap(categoryNodes);
  }

  if (categoryLabels.size === 0) {
    throw new Error('카테고리 레이블을 생성할 수 없어요. 카테고리 데이터를 확인해 주세요.');
  }

  const constraints = buildConstraints(categorized, cardPreviousSpending, categoryLabels);

  const optimizationResult = greedyOptimize(constraints, coreRules);
  if (performanceBasisIssues.length > 0) {
    optimizationResult.unsupportedRules = [
      ...(optimizationResult.unsupportedRules ?? []),
      ...performanceBasisIssues,
    ];
    const issuesByCard = new Map<string, typeof performanceBasisIssues>();
    for (const issue of performanceBasisIssues) {
      const cardId = issue.ruleId.replace(/:performance-exclusions$/, '');
      const issues = issuesByCard.get(cardId) ?? [];
      issues.push(issue);
      issuesByCard.set(cardId, issues);
    }
    for (const cardResult of optimizationResult.cardResults) {
      const issues = issuesByCard.get(cardResult.cardId);
      if (!issues) continue;
      cardResult.unsupportedRules = [
        ...(cardResult.unsupportedRules ?? []),
        ...issues,
      ];
    }
  }

  return optimizationResult;
}

export async function analyzeMultipleFiles(
  files: File[],
  options?: AnalyzeOptions,
  execution?: AnalyzeExecution,
): Promise<AnalysisResult> {
  // 1. Construct MerchantMatcher once (shared across all files) to avoid
  // redundant loadCategories() fetches and matcher construction per file.
  const categoryNodes = await loadCategories();
  // Guard against empty categories — loadCategories() returns [] on AbortError
  // (component unmount during fetch). Proceeding with empty categories would
  // create a MerchantMatcher that categorizes everything as "uncategorized"
  // with 0 confidence, producing silently wrong results (C71-02).
  if (categoryNodes.length === 0) {
    throw new Error('카테고리 데이터를 불러올 수 없어요. 다시 시도해 보세요.');
  }
  if (execution && !execution.run.isCurrent()) {
    const error = new Error('분석이 취소되었어요.');
    error.name = 'AbortError';
    throw error;
  }
  const sharedMatcher = new MerchantMatcher(toRulesCategoryNodes(categoryNodes));

  // 2. Parse and categorize ALL files using the shared matcher
  // Pass categoryNodes to avoid redundant loadCategories() calls inside
  // parseAndCategorize() — the caller already has the data (C81-03).
  // Each worker returns only normalized transactions and warnings. Parser
  // buffers/workbooks remain local to parseFile and are released before this
  // promise settles and the queue yields/dequeues another file.
  const fallbackExecution = execution ?? {
    run: {
      generation: 0,
      signal: new AbortController().signal,
      isCurrent: () => true,
      commit: (effect: () => void) => {
        effect();
        return true;
      },
    },
  };
  const parseQueue = await runFileParseQueue(
    files,
    async (file, index) => ({
      ...(await parseAndCategorize(
        file,
        options,
        index,
        sharedMatcher,
        categoryNodes,
      )),
      fileName: file.name,
    }),
    {
      run: fallbackExecution.run,
      onProgress: execution?.onProgress,
    },
  );
  if (parseQueue.cancelled || parseQueue.stale) {
    const error = new Error('분석이 취소되었어요.');
    error.name = 'AbortError';
    throw error;
  }

  // 2. Merge all transactions and build category labels from the first parsed result
  const allTransactions: CategorizedTx[] = [];
  const allErrors: AnalysisResult['parseErrors'] = [];
  const failedFileNames: string[] = [];
  let bank: string | null = null;
  let format = 'csv';

  // Consume settled outcomes in input order even when workers completed in a
  // different order. This keeps transactions and every warning/error stable.
  let categoryLabels: Map<string, string> | undefined;
  for (const [index, outcome] of parseQueue.outcomes.entries()) {
    const file = files[index]!;
    if (outcome.status === 'cancelled') {
      const error = new Error('분석이 취소되었어요.');
      error.name = 'AbortError';
      throw error;
    }
    if (outcome.status === 'rejected') {
      failedFileNames.push(file.name);
      allErrors.push({
        fileName: file.name,
        format: file.name.split('.').at(-1)?.toLowerCase() ?? 'unknown',
        message:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : '파일을 분석할 수 없어요',
        count: 1,
      });
      continue;
    }

    const parsed = outcome.value;
    allTransactions.push(...parsed.transactions);
    allErrors.push(
      ...attachParseWarningIdentity(
        parsed.parseErrors,
        parsed.fileName,
        parsed.format,
      ),
    );
    if (parsed.bank) bank = parsed.bank;
    format = parsed.format;
    // Build labels from the first parsed result (all results use the same taxonomy)
    if (!categoryLabels && parsed.categoryNodes) {
      categoryLabels = buildCategoryLabelMap(parsed.categoryNodes);
    }
  }

  if (allTransactions.length === 0) {
    const errorDetail = failedFileNames.join(', ');
    throw new Error(
      errorDetail
        ? `거래 내역을 찾을 수 없어요: ${errorDetail}`
        : '거래 내역을 찾을 수 없어요'
    );
  }

  // 3. Build one strict calendar/provenance context for every downstream
  // consumer. Invalid-date rows stay in `transactions` for review but cannot
  // affect month selection, periods, counts, or optimization.
  const context = buildAnalysisContext(
    allTransactions,
    options?.previousMonthSpending,
  );
  if (!context) {
    throw new Error('거래 내역의 날짜를 해석할 수 없어요. 파일 형식을 확인해 주세요.');
  }

  // 4. Optimize the latest valid month. Automatic performance spending uses
  // only the exact previous calendar month's transactions and is computed
  // separately for each card after its exclusions.
  const optimization = await optimizeFromTransactions(context.latestTransactions, {
    ...options,
    previousSpendingBasis: context.previousSpendingBasis,
    previousMonthTransactions: context.previousTransactions,
  }, categoryLabels);

  // Note: `transactions` includes ALL months for display/editing, but the
  // optimization only covers the latest month. When reoptimize is called
  // with edited transactions, it includes all months. This is acceptable
  // because non-latest-month transactions still contribute to per-card
  // previousMonthSpending calculations and don't distort the optimization
  // — they just add more data for the optimizer to consider.
  return {
    success: true,
    bank,
    format,
    statementPeriod: context.statementPeriod,
    transactionCount: context.latestTransactions.length,
    fullStatementPeriod: context.fullStatementPeriod,
    totalTransactionCount: context.validTransactions.length,
    parseErrors: allErrors,
    transactions: allTransactions,
    optimization,
    monthlyBreakdown: context.monthlyBreakdown,
    previousSpendingBasis: context.previousSpendingBasis,
  };
}

// Keep the original combined function for backward compatibility
export async function analyzeFile(
  file: File,
  options?: AnalyzeOptions,
): Promise<AnalysisResult> {
  return analyzeMultipleFiles([file], options);
}
