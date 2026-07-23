import type { OptimizationResult } from '@cherrypicker/core';
import {
  isValidIsoDate,
  previousCalendarMonth,
  yearMonthOfDate,
  type PreviousSpendingBasis,
} from '@cherrypicker/core/analysis/context';
import type { PerformanceExclusionId } from '@cherrypicker/rules/browser';
import type {
  FileParseProgress,
  FileParseRun,
} from './file-parse-queue.js';
import type { RawTransaction } from './parser/types.js';

/**
 * Framework-free transaction facts owned by the web analysis domain.
 * Producers, persistence, and Svelte state all depend on this contract.
 */
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

export interface CategorySpendingSummary {
  category: string;
  categoryNameKo: string;
  spending: number;
  /** Number of positive transactions represented by this category. */
  transactionCount: number;
}

export interface AnalysisParseWarning {
  fileName: string;
  format: string;
  line?: number;
  message: string;
  raw?: string;
  count?: number;
  kind?: 'summary';
  affectedFileCount?: number;
}

export interface AnalysisResult {
  success: boolean;
  bank: string | null;
  format: string;
  /** Period and count for the optimized month only. */
  statementPeriod?: { start: string; end: string };
  transactionCount: number;
  /** Period and count spanning all uploaded months. */
  fullStatementPeriod?: { start: string; end: string };
  totalTransactionCount?: number;
  parseErrors: AnalysisParseWarning[];
  transactions?: CategorizedTx[];
  /** Canonical latest-month positive spending, independent of card rewards. */
  categoryBreakdown: CategorySpendingSummary[];
  optimization: OptimizationResult;
  monthlyBreakdown?: {
    month: string;
    spending: number;
    transactionCount: number;
  }[];
  /** The user's explicit previous-month spending input, when provided. */
  previousMonthSpendingOption?: number;
  /** The user's explicit card selection, when provided. */
  cardIdsOption?: string[];
  /** Inspectable provenance for the performance-spending input. */
  previousSpendingBasis?: PreviousSpendingBasis;
}

export interface AnalyzeOptions {
  bank?: string;
  previousMonthSpending?: number;
  cardIds?: string[];
  /** Internal normalized context shared by initial analysis/reoptimization. */
  previousSpendingBasis?: PreviousSpendingBasis;
  /** Exact previous-calendar-month rows for card-specific exclusions. */
  previousMonthTransactions?: CategorizedTx[];
}

export interface AnalyzeExecution {
  run: FileParseRun;
  onProgress?: (progress: FileParseProgress) => void;
}

export interface AnalysisCoherenceContext {
  /** Explicit persistence provenance for intentionally omitted transactions. */
  truncatedTransactionCount?: number;
}

export function normalizeCardIdsOption(
  requested: readonly string[] | undefined,
  fallback?: readonly string[],
): string[] | undefined {
  const source = requested === undefined ? fallback : requested;
  if (!source || source.length === 0) return undefined;
  return [...new Set(source)];
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function categoryKeyOf(transaction: CategorizedTx): string {
  return transaction.subcategory
    ? `${transaction.category}.${transaction.subcategory}`
    : transaction.category;
}

/**
 * Builds the compact canonical spending witness used by persistence and UI.
 * Callers pass only the latest-month transactions.
 */
export function buildCategorySpendingSummary(
  transactions: readonly CategorizedTx[],
  categoryLabels: ReadonlyMap<string, string>,
): CategorySpendingSummary[] {
  const summaries = new Map<string, CategorySpendingSummary>();
  for (const transaction of transactions) {
    if (transaction.amount <= 0) continue;
    const category = categoryKeyOf(transaction);
    const current = summaries.get(category);
    if (current) {
      const spending = addSafe(current.spending, transaction.amount);
      if (spending === null) {
        throw new RangeError(`category spending overflow for ${category}`);
      }
      current.spending = spending;
      current.transactionCount += 1;
      if (!Number.isSafeInteger(current.transactionCount)) {
        throw new RangeError(
          `category transaction count overflow for ${category}`,
        );
      }
      continue;
    }
    summaries.set(category, {
      category,
      categoryNameKo:
        categoryLabels.get(category) ??
        categoryLabels.get(transaction.category) ??
        category,
      spending: transaction.amount,
      transactionCount: 1,
    });
  }
  return [...summaries.values()].sort(
    (left, right) =>
      right.spending - left.spending ||
      compareAscii(left.category, right.category),
  );
}

function addSafe(total: number, value: number): number | null {
  const sum = total + value;
  return Number.isSafeInteger(sum) && sum >= 0 ? sum : null;
}

function sumSafe(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    const next = addSafe(total, value);
    if (next === null) return null;
    total = next;
  }
  return total;
}

function sameRate(actual: number, reward: number, spending: number): boolean {
  const expected = spending > 0 ? reward / spending : 0;
  const tolerance =
    Number.EPSILON * 8 * Math.max(1, Math.abs(actual), Math.abs(expected));
  return Math.abs(actual - expected) <= tolerance;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function samePeriod(
  actual: { start: string; end: string } | undefined,
  expected: { start: string; end: string },
): boolean {
  return actual?.start === expected.start && actual.end === expected.end;
}

function isOptimizationCoherent(optimization: OptimizationResult): boolean {
  const assignmentKeys = optimization.assignments.map(
    ({ assignedCardId, category }) => `${assignedCardId}\u0000${category}`,
  );
  if (!unique(assignmentKeys)) return false;

  for (const assignment of optimization.assignments) {
    if (
      assignment.spending <= 0 ||
      !Number.isSafeInteger(assignment.transactionCount) ||
      assignment.transactionCount <= 0 ||
      assignment.reward <= 0 ||
      !sameRate(assignment.rate, assignment.reward, assignment.spending)
    ) {
      return false;
    }
    if (
      !unique(assignment.alternatives.map(({ cardId }) => cardId)) ||
      assignment.alternatives.some(
        (alternative) =>
          alternative.cardId === assignment.assignedCardId ||
          alternative.reward <= 0 ||
          !sameRate(
            alternative.rate,
            alternative.reward,
            assignment.spending,
          ),
      )
    ) {
      return false;
    }
  }

  const cardIds = optimization.cardResults.map(({ cardId }) => cardId);
  if (!unique(cardIds)) return false;
  const cardIdSet = new Set(cardIds);
  const assignmentsByCard = new Map<
    string,
    typeof optimization.assignments
  >();
  for (const assignment of optimization.assignments) {
    const cardAssignments =
      assignmentsByCard.get(assignment.assignedCardId) ?? [];
    cardAssignments.push(assignment);
    assignmentsByCard.set(assignment.assignedCardId, cardAssignments);
  }
  if (
    optimization.assignments.some(
      ({ assignedCardId }) => !cardIdSet.has(assignedCardId),
    )
  ) {
    return false;
  }

  for (const card of optimization.cardResults) {
    const cardAssignments = assignmentsByCard.get(card.cardId);
    if (!cardAssignments || cardAssignments.length === 0) return false;
    const assignedCardSpending = sumSafe(
      cardAssignments.map(({ spending }) => spending),
    );
    const assignedCardReward = sumSafe(
      cardAssignments.map(({ reward }) => reward),
    );
    const assignmentByCategory = new Map(
      cardAssignments.map((assignment) => [assignment.category, assignment]),
    );
    const categoryKeys = card.byCategory.map(({ category }) => category);
    if (!unique(categoryKeys)) return false;
    const capsByCategory = new Map<string, typeof card.capsHit>();
    for (const cap of card.capsHit) {
      if (
        !Number.isSafeInteger(cap.capAmount) ||
        cap.capAmount < 0 ||
        !Number.isSafeInteger(cap.actualReward) ||
        cap.actualReward < 0 ||
        !Number.isSafeInteger(cap.appliedReward) ||
        cap.appliedReward < 0 ||
        cap.appliedReward > cap.actualReward ||
        !assignmentByCategory.has(cap.category)
      ) {
        return false;
      }
      const categoryCaps = capsByCategory.get(cap.category) ?? [];
      categoryCaps.push(cap);
      capsByCategory.set(cap.category, categoryCaps);
    }
    const categorySpending = sumSafe(
      card.byCategory.map(({ spending }) => spending),
    );
    const categoryReward = sumSafe(
      card.byCategory.map(({ reward }) => reward),
    );
    if (
      card.totalSpending <= 0 ||
      card.totalReward <= 0 ||
      assignedCardSpending !== card.totalSpending ||
      assignedCardReward !== card.totalReward ||
      assignmentByCategory.size !== card.byCategory.length ||
      categorySpending !== card.totalSpending ||
      categoryReward !== card.totalReward ||
      !sameRate(card.effectiveRate, card.totalReward, card.totalSpending) ||
      card.byCategory.some(
        (category) =>
          assignmentByCategory.get(category.category)?.spending !==
            category.spending ||
          assignmentByCategory.get(category.category)?.reward !==
            category.reward ||
          category.capReached !== capsByCategory.has(category.category) ||
          (
            capsByCategory
              .get(category.category)
              ?.some(
                (cap) =>
                  cap.capType === 'monthly_category' &&
                  cap.capAmount !== category.capAmount,
              ) ?? false
          ) ||
          !sameRate(category.rate, category.reward, category.spending),
      )
    ) {
      return false;
    }
  }

  const assignedSpending = sumSafe(
    optimization.assignments.map(({ spending }) => spending),
  );
  const assignmentReward = sumSafe(
    optimization.assignments.map(({ reward }) => reward),
  );
  const cardSpending = sumSafe(
    optimization.cardResults.map(({ totalSpending }) => totalSpending),
  );
  const cardReward = sumSafe(
    optimization.cardResults.map(({ totalReward }) => totalReward),
  );
  if (
    assignedSpending === null ||
    assignmentReward === null ||
    cardSpending === null ||
    cardReward === null ||
    addSafe(assignedSpending, optimization.unassignedSpending) !==
      optimization.totalSpending ||
    assignmentReward !== optimization.totalReward ||
    cardSpending !== assignedSpending ||
    cardReward !== optimization.totalReward ||
    !sameRate(
      optimization.effectiveRate,
      optimization.totalReward,
      optimization.totalSpending,
    )
  ) {
    return false;
  }

  if (
    (optimization.unassignedSpending === 0) !==
    (optimization.unassignedTransactionCount === 0)
  ) {
    return false;
  }

  if (optimization.bestSingleCard === null) {
    return (
      optimization.totalReward === 0 &&
      optimization.savingsVsSingleCard === 0
    );
  }
  return (
    optimization.bestSingleCard.totalReward > 0 &&
    Number.isSafeInteger(
      optimization.totalReward -
        optimization.bestSingleCard.totalReward,
    ) &&
    optimization.savingsVsSingleCard ===
      optimization.totalReward - optimization.bestSingleCard.totalReward
  );
}

function categorySummaryTotals(
  categoryBreakdown: readonly CategorySpendingSummary[],
): { spending: number; transactionCount: number } | null {
  if (
    !unique(categoryBreakdown.map(({ category }) => category)) ||
    categoryBreakdown.some(
      ({ category, categoryNameKo, spending, transactionCount }) =>
        category.length === 0 ||
        categoryNameKo.length === 0 ||
        !Number.isSafeInteger(spending) ||
        spending <= 0 ||
        !Number.isSafeInteger(transactionCount) ||
        transactionCount <= 0,
    )
  ) {
    return null;
  }
  const spending = sumSafe(categoryBreakdown.map((summary) => summary.spending));
  const transactionCount = sumSafe(
    categoryBreakdown.map((summary) => summary.transactionCount),
  );
  return spending === null || transactionCount === null
    ? null
    : { spending, transactionCount };
}

function hasSameCategoryFacts(
  actual: readonly CategorySpendingSummary[],
  expected: readonly CategorySpendingSummary[],
): boolean {
  if (actual.length !== expected.length) return false;
  const actualByCategory = new Map(
    actual.map((summary) => [summary.category, summary]),
  );
  return expected.every((summary) => {
    const candidate = actualByCategory.get(summary.category);
    return (
      candidate?.spending === summary.spending &&
      candidate.transactionCount === summary.transactionCount
    );
  });
}

function hasCoherentCategoryAllocation(result: AnalysisResult): boolean {
  const totals = categorySummaryTotals(result.categoryBreakdown);
  if (
    totals === null ||
    totals.spending !== result.optimization.totalSpending
  ) {
    return false;
  }

  const canonical = new Map(
    result.categoryBreakdown.map((summary) => [
      summary.category,
      { spending: summary.spending, transactionCount: summary.transactionCount },
    ]),
  );
  const assigned = new Map<
    string,
    { spending: number; transactionCount: number }
  >();
  for (const assignment of result.optimization.assignments) {
    if (!canonical.has(assignment.category)) return false;
    const current = assigned.get(assignment.category) ?? {
      spending: 0,
      transactionCount: 0,
    };
    const spending = addSafe(current.spending, assignment.spending);
    const transactionCount = addSafe(
      current.transactionCount,
      assignment.transactionCount,
    );
    if (spending === null || transactionCount === null) return false;
    current.spending = spending;
    current.transactionCount = transactionCount;
    assigned.set(assignment.category, current);
  }

  let unassignedSpending = 0;
  let unassignedTransactionCount = 0;
  for (const [category, summary] of canonical) {
    const allocation = assigned.get(category) ?? {
      spending: 0,
      transactionCount: 0,
    };
    if (
      allocation.spending > summary.spending ||
      allocation.transactionCount > summary.transactionCount
    ) {
      return false;
    }
    const spending = addSafe(
      unassignedSpending,
      summary.spending - allocation.spending,
    );
    const transactionCount = addSafe(
      unassignedTransactionCount,
      summary.transactionCount - allocation.transactionCount,
    );
    if (spending === null || transactionCount === null) return false;
    unassignedSpending = spending;
    unassignedTransactionCount = transactionCount;
  }
  return (
    unassignedSpending === result.optimization.unassignedSpending &&
    unassignedTransactionCount ===
      result.optimization.unassignedTransactionCount
  );
}

function expectedPeriod(
  transactions: readonly CategorizedTx[],
): { start: string; end: string } {
  const dates = transactions.map(({ date }) => date).sort();
  return { start: dates[0]!, end: dates.at(-1)! };
}

/**
 * Reconciles persisted derivations with their least-derived transaction and
 * optimization facts. Callers still perform structural validation first.
 */
export function isAnalysisResultCoherent(
  result: AnalysisResult,
  context?: AnalysisCoherenceContext,
): boolean {
  if (
    !isOptimizationCoherent(result.optimization) ||
    !hasCoherentCategoryAllocation(result)
  ) {
    return false;
  }

  const selectedCardIds = result.cardIdsOption;
  if (
    selectedCardIds &&
    (
      !unique(selectedCardIds) ||
      result.optimization.assignments.some(
        ({ assignedCardId, alternatives }) =>
          !selectedCardIds.includes(assignedCardId) ||
          alternatives.some(
            ({ cardId }) => !selectedCardIds.includes(cardId),
          ),
      ) ||
      result.optimization.cardResults.some(
        ({ cardId }) => !selectedCardIds.includes(cardId),
      ) ||
      (
        result.optimization.bestSingleCard !== null &&
        !selectedCardIds.includes(result.optimization.bestSingleCard.cardId)
      )
    )
  ) {
    return false;
  }

  if (!result.transactions) {
    const truncatedCount = context?.truncatedTransactionCount;
    if (
      !result.monthlyBreakdown ||
      result.monthlyBreakdown.length === 0 ||
      !unique(result.monthlyBreakdown.map(({ month }) => month))
    ) {
      return false;
    }
    const representedTransactionCount = sumSafe(
      result.monthlyBreakdown.map(({ transactionCount }) => transactionCount),
    );
    const latest = [...result.monthlyBreakdown]
      .sort((left, right) => compareAscii(left.month, right.month))
      .at(-1)!;
    const categoryTotals = categorySummaryTotals(result.categoryBreakdown);
    return (
      Number.isSafeInteger(truncatedCount) &&
      (truncatedCount ?? 0) > 0 &&
      representedTransactionCount !== null &&
      representedTransactionCount > 0 &&
      (truncatedCount ?? 0) >= representedTransactionCount &&
      result.transactionCount === latest.transactionCount &&
      result.totalTransactionCount === representedTransactionCount &&
      categoryTotals !== null &&
      latest.transactionCount >= categoryTotals.transactionCount &&
      latest.spending === categoryTotals.spending &&
      latest.spending === result.optimization.totalSpending
    );
  }
  if (!unique(result.transactions.map(({ id }) => id))) return false;

  const validTransactions = result.transactions.filter(({ date }) =>
    isValidIsoDate(date),
  );
  if (validTransactions.length === 0) return false;
  const latestMonth = validTransactions
    .map(({ date }) => yearMonthOfDate(date)!)
    .sort()
    .at(-1)!;
  const latestTransactions = validTransactions.filter(
    ({ date }) => yearMonthOfDate(date) === latestMonth,
  );
  const positiveLatest = latestTransactions.filter(({ amount }) => amount > 0);
  const latestSpending = sumSafe(positiveLatest.map(({ amount }) => amount));
  let expectedCategoryBreakdown: CategorySpendingSummary[];
  try {
    expectedCategoryBreakdown = buildCategorySpendingSummary(
      latestTransactions,
      new Map(
        result.categoryBreakdown.map(({ category, categoryNameKo }) => [
          category,
          categoryNameKo,
        ]),
      ),
    );
  } catch {
    return false;
  }
  if (
    latestSpending === null ||
    !hasSameCategoryFacts(result.categoryBreakdown, expectedCategoryBreakdown) ||
    result.transactionCount !== latestTransactions.length ||
    (
      result.totalTransactionCount !== undefined &&
      result.totalTransactionCount !== validTransactions.length
    ) ||
    result.optimization.totalSpending !== latestSpending ||
    !samePeriod(
      result.statementPeriod,
      expectedPeriod(latestTransactions),
    ) ||
    !samePeriod(
      result.fullStatementPeriod,
      expectedPeriod(validTransactions),
    )
  ) {
    return false;
  }

  if (!result.monthlyBreakdown) return false;
  const expectedMonths = new Map<
    string,
    { spending: number; transactionCount: number }
  >();
  for (const transaction of validTransactions) {
    const month = yearMonthOfDate(transaction.date)!;
    const current = expectedMonths.get(month) ?? {
      spending: 0,
      transactionCount: 0,
    };
    current.transactionCount += 1;
    if (transaction.amount > 0) {
      const spending = addSafe(current.spending, transaction.amount);
      if (spending === null) return false;
      current.spending = spending;
    }
    expectedMonths.set(month, current);
  }
  if (
    result.monthlyBreakdown.length !== expectedMonths.size ||
    !unique(result.monthlyBreakdown.map(({ month }) => month)) ||
    result.monthlyBreakdown.some((entry) => {
      const expected = expectedMonths.get(entry.month);
      return (
        !expected ||
        entry.spending !== expected.spending ||
        entry.transactionCount !== expected.transactionCount
      );
    })
  ) {
    return false;
  }

  const previousMonth = previousCalendarMonth(latestMonth);
  const basis = result.previousSpendingBasis;
  if (
    result.previousMonthSpendingOption !== undefined &&
    (
      basis?.kind !== 'user-total' ||
      basis.amount !== result.previousMonthSpendingOption
    )
  ) {
    return false;
  }
  if (
    basis?.kind === 'statement-month' &&
    (
      basis.month !== previousMonth ||
      !validTransactions.some(
        ({ date }) => yearMonthOfDate(date) === previousMonth,
      )
    )
  ) {
    return false;
  }
  if (
    basis?.kind === 'missing-calendar-month' &&
    (
      basis.month !== previousMonth ||
      validTransactions.some(
        ({ date }) => yearMonthOfDate(date) === previousMonth,
      )
    )
  ) {
    return false;
  }

  return true;
}
