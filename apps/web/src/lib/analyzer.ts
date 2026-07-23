import {
  MerchantMatcher,
  buildConstraints,
  resolveCardPreviousSpending,
} from '@cherrypicker/core';
import type { CategorizedTransaction } from '@cherrypicker/core';
import type { PerformanceExclusionId } from '@cherrypicker/rules/browser';
import { isValidFuelVolumeLiters } from '@cherrypicker/parser/browser';
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
  emptyParseResultMessage,
} from './analyzer-helpers.js';
import { runFileParseQueue } from './file-parse-queue.js';
import { runCancellableOptimizer } from './optimizer/worker-runner.js';

function analysisAbortError(): DOMException {
  return new DOMException('분석이 취소되었어요.', 'AbortError');
}

function assertSignalCurrent(signal?: AbortSignal): void {
  if (signal?.aborted) throw analysisAbortError();
}

function assertExecutionCurrent(execution?: AnalyzeExecution): void {
  if (
    execution &&
    (execution.run.signal.aborted || !execution.run.isCurrent())
  ) {
    throw analysisAbortError();
  }
}

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
  factProvenance?: RawTransaction['factProvenance'];
}

export function appendCategorizedTransactions(
  target: CategorizedTx[],
  source: readonly CategorizedTx[],
): void {
  for (const transaction of source) {
    target.push(transaction);
  }
}

interface CategoryMatcher {
  match(
    merchantName: string,
    rawCategory?: string,
  ): { category: string; subcategory?: string; confidence: number };
}

export function categorizeParsedTransactions(
  transactions: readonly RawTransaction[],
  matcher: CategoryMatcher,
  fileIndex?: number,
): CategorizedTx[] {
  const idPrefix = fileIndex !== undefined ? `f${fileIndex}-` : '';
  return transactions.map((tx, index) => {
    if (
      tx.fuelVolumeLiters !== undefined &&
      !isValidFuelVolumeLiters(tx.fuelVolumeLiters)
    ) {
      throw new Error(`유효하지 않은 주유량입니다: ${tx.fuelVolumeLiters}`);
    }
    const match = matcher.match(tx.merchant, tx.category);
    return {
      id: `tx-${idPrefix}${index}`,
      date: tx.date,
      merchant: tx.merchant,
      amount: tx.amount,
      installments: tx.installments,
      category: match.category,
      subcategory: match.subcategory,
      confidence: match.confidence,
      rawCategory: tx.category,
      memo: tx.memo,
      paymentType: tx.paymentType,
      channel: tx.channel,
      fuelVolumeLiters: tx.fuelVolumeLiters,
      performanceExclusionTags: tx.performanceExclusionTags,
      factProvenance: tx.factProvenance,
    };
  });
}

export function toCoreTransactions(
  transactions: readonly CategorizedTx[],
): CategorizedTransaction[] {
  return transactions.map((tx) => {
    if (
      tx.fuelVolumeLiters !== undefined &&
      !isValidFuelVolumeLiters(tx.fuelVolumeLiters)
    ) {
      throw new Error(`유효하지 않은 주유량입니다: ${tx.fuelVolumeLiters}`);
    }
    return {
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
      factProvenance: tx.factProvenance,
    };
  });
}

export async function parseAndCategorize(
  file: File,
  options?: AnalyzeOptions,
  fileIndex?: number,
  matcher?: MerchantMatcher,
  categoryNodes?: CategoryNode[],
  signal?: AbortSignal,
): Promise<{ transactions: CategorizedTx[]; bank: string | null; format: string; statementPeriod?: { start: string; end: string }; parseErrors: { line?: number; message: string; raw?: string }[]; categoryNodes: CategoryNode[] }> {
  const resolvedBank: BankId | undefined =
    options?.bank && VALID_BANK_IDS.has(options.bank)
      ? (options.bank as BankId)
      : undefined;
  const parseResult = await parseFile(file, resolvedBank, signal);
  assertSignalCurrent(signal);
  if (parseResult.transactions.length === 0) {
    throw new Error(emptyParseResultMessage(parseResult.errors));
  }

  // Use provided categoryNodes (from analyzeMultipleFiles) or fetch fresh.
  // When a matcher is provided, the caller already loaded categories — skip
  // the redundant loadCategories() call to avoid an unnecessary await (C81-03).
  const nodes = categoryNodes ?? await loadCategories(signal);
  assertSignalCurrent(signal);
  // Guard against malformed or unexpectedly empty taxonomy data. Proceeding
  // would produce silently wrong results with every row uncategorized.
  if (nodes.length === 0) {
    throw new Error('카테고리 데이터를 불러올 수 없어요. 다시 시도해 보세요.');
  }
  // Reuse the provided matcher (from analyzeMultipleFiles) or construct a new
  // one for backward compatibility (e.g., analyzeFile single-call path).
  const effectiveMatcher = matcher ?? new MerchantMatcher(nodes);

  const transactions = categorizeParsedTransactions(
    parseResult.transactions,
    effectiveMatcher,
    fileIndex,
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
  execution?: AnalyzeExecution,
): Promise<AnalysisResult['optimization']> {
  assertExecutionCurrent(execution);
  const categorized = toCoreTransactions(transactions);

  // The generated optimizer artifact already has the canonical core shape.
  // Its loader validates and caches the original JSON object graph once.
  let coreRules = await loadOptimizerCatalog(execution?.run.signal);
  assertExecutionCurrent(execution);
  assertCatalogAvailable(coreRules.length);

  // Apply cardIds filter AFTER cache retrieval to avoid returning stale
  // unfiltered rules when a filtered set is requested.
  if (options?.cardIds && options.cardIds.length > 0) {
    const idSet = new Set(options.cardIds);
    coreRules = coreRules.filter(r => idSet.has(r.card.id));
  }
  assertRequestedCardsResolved(options?.cardIds, coreRules.length);

  // 전월실적은 직접 입력한 값, 정확한 이전 달 명세서, 또는 명세서가
  // 없을 때의 0원 가정 중 하나이며 provenance를 함께 보존한다.
  // 카드사별 performanceExclusions는 명세서 기반일 때 개별 계산한다.
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
  const {
    cardPreviousSpending,
    issues: performanceBasisIssues,
  } = resolveCardPreviousSpending(
    coreRules,
    performanceTransactions,
    previousBasis,
  );
  // Build category labels map from taxonomy for the optimizer
  // Skip loadCategories() if labels were pre-built by the caller
  let categoryLabels = prebuiltCategoryLabels;
  if (!categoryLabels) {
    const categoryNodes = await loadCategories(execution?.run.signal);
    assertExecutionCurrent(execution);
    categoryLabels = buildCategoryLabelMap(categoryNodes);
  }

  assertExecutionCurrent(execution);
  if (categoryLabels.size === 0) {
    throw new Error('카테고리 레이블을 생성할 수 없어요. 카테고리 데이터를 확인해 주세요.');
  }

  const constraints = buildConstraints(categorized, cardPreviousSpending, categoryLabels);

  const optimizationResult = await runCancellableOptimizer(
    constraints,
    coreRules,
    execution?.run.signal,
  );
  assertExecutionCurrent(execution);
  if (performanceBasisIssues.length > 0) {
    optimizationResult.unsupportedRules = [
      ...(optimizationResult.unsupportedRules ?? []),
      ...performanceBasisIssues,
    ];
    const issuesByCard = new Map<string, typeof performanceBasisIssues>();
    for (const issue of performanceBasisIssues) {
      const issues = issuesByCard.get(issue.cardId) ?? [];
      issues.push(issue);
      issuesByCard.set(issue.cardId, issues);
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

  assertExecutionCurrent(execution);
  return optimizationResult;
}

export async function analyzeMultipleFiles(
  files: File[],
  options?: AnalyzeOptions,
  execution?: AnalyzeExecution,
): Promise<AnalysisResult> {
  assertExecutionCurrent(execution);
  // 1. Construct MerchantMatcher once (shared across all files) to avoid
  // redundant loadCategories() fetches and matcher construction per file.
  const categoryNodes = await loadCategories(execution?.run.signal);
  assertExecutionCurrent(execution);
  // Guard against malformed or unexpectedly empty taxonomy data. Proceeding
  // would categorize everything as "uncategorized" with zero confidence.
  if (categoryNodes.length === 0) {
    throw new Error('카테고리 데이터를 불러올 수 없어요. 다시 시도해 보세요.');
  }
  const sharedMatcher = new MerchantMatcher(categoryNodes);

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
    async (file, index, signal) => ({
      ...(await parseAndCategorize(
        file,
        options,
        index,
        sharedMatcher,
        categoryNodes,
        signal,
      )),
      fileName: file.name,
    }),
    {
      run: fallbackExecution.run,
      onProgress: execution?.onProgress,
    },
  );
  assertExecutionCurrent(execution);
  if (parseQueue.cancelled || parseQueue.stale) {
    throw analysisAbortError();
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
      throw analysisAbortError();
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
    appendCategorizedTransactions(allTransactions, parsed.transactions);
    const identifiedErrors = attachParseWarningIdentity(
      parsed.parseErrors,
      parsed.fileName,
      parsed.format,
    );
    for (const error of identifiedErrors) allErrors.push(error);
    if (parsed.bank) bank = parsed.bank;
    format = parsed.format;
    // Build labels from the first parsed result (all results use the same taxonomy)
    if (!categoryLabels && parsed.categoryNodes) {
      categoryLabels = buildCategoryLabelMap(parsed.categoryNodes);
    }
  }

  if (allTransactions.length === 0) {
    const genericEmptyMessage = '거래 내역을 찾을 수 없어요';
    const actionableError = allErrors.find(
      ({ message }) =>
        message.trim().length > 0 && message !== genericEmptyMessage,
    );
    if (actionableError) {
      throw new Error(
        `${actionableError.fileName}: ${actionableError.message}`,
      );
    }
    const errorDetail = failedFileNames.join(', ');
    throw new Error(
      errorDetail
        ? `${genericEmptyMessage}: ${errorDetail}`
        : genericEmptyMessage,
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
  }, categoryLabels, execution);
  assertExecutionCurrent(execution);

  // `transactions` keeps every uploaded month for display/editing, while
  // optimization uses only the latest valid month and the exact predecessor
  // month remains available solely as the performance-spending basis.
  assertExecutionCurrent(execution);
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
