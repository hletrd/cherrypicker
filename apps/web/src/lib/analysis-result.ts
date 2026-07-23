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
  if (!isOptimizationCoherent(result.optimization)) return false;

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
    const representedTransactionCount = result.monthlyBreakdown
      ? sumSafe(
          result.monthlyBreakdown.map(({ transactionCount }) =>
            transactionCount
          ),
        )
      : null;
    return (
      Number.isSafeInteger(truncatedCount) &&
      (truncatedCount ?? 0) > 0 &&
      result.transactionCount === 0 &&
      result.totalTransactionCount === 0 &&
      representedTransactionCount !== null &&
      representedTransactionCount > 0 &&
      (truncatedCount ?? 0) >= representedTransactionCount
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
  if (
    latestSpending === null ||
    result.transactionCount !== latestTransactions.length ||
    (
      result.totalTransactionCount !== undefined &&
      result.totalTransactionCount !== validTransactions.length
    ) ||
    result.optimization.totalSpending !== latestSpending ||
    result.optimization.unassignedTransactionCount > positiveLatest.length ||
    (
      result.optimization.assignments.length === 0 &&
      result.optimization.unassignedTransactionCount !== positiveLatest.length
    ) ||
    result.optimization.assignments.length +
      result.optimization.unassignedTransactionCount >
      positiveLatest.length ||
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
