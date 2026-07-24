import type {
  CapSuppressionCause,
  OptimizationResult,
  PortfolioCapLoss,
} from '@cherrypicker/core';
import {
  isYearMonth,
  previousCalendarMonth,
  yearMonthOfDate,
  type PreviousSpendingBasis,
  type YearMonth,
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
  previousSpendingBasis: PreviousSpendingBasis;
}

const VALIDATED_ANALYSIS_RESULT = Symbol('validated-analysis-result');

/**
 * Fresh producer result that already passed exhaustive coherence validation.
 * The symbol is intentionally non-serializable and only bridges the immediate
 * analyzer-to-replacement boundary.
 */
export type ValidatedAnalysisResult = AnalysisResult & {
  readonly [VALIDATED_ANALYSIS_RESULT]: true;
};

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

export function resolveReoptimizationPreviousSpending(
  options: AnalyzeOptions | undefined,
  snapshot: Pick<
    AnalysisResult,
    'previousSpendingBasis' | 'previousMonthSpendingOption'
  >,
): number | undefined {
  if (options?.previousMonthSpending !== undefined) {
    return options.previousMonthSpending;
  }
  if (options?.previousSpendingBasis?.kind === 'user-total') {
    return options.previousSpendingBasis.amount;
  }
  return snapshot.previousSpendingBasis.kind === 'user-total'
    ? snapshot.previousSpendingBasis.amount
    : undefined;
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

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isCapSuppressionCauseCoherent(
  value: unknown,
): value is CapSuppressionCause {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const cause = value as Partial<CapSuppressionCause>;
  return (
    isNonemptyString(cause.ruleId) &&
    isNonemptyString(cause.capGroup) &&
    (
      cause.capType === 'monthly_category' ||
      cause.capType === 'monthly_total' ||
      cause.capType === 'per_transaction'
    ) &&
    isSafeNonnegativeInteger(cause.capAmount) &&
    isSafeNonnegativeInteger(cause.rewardBeforeCap) &&
    isSafeNonnegativeInteger(cause.rewardAfterCap) &&
    cause.rewardBeforeCap > cause.rewardAfterCap &&
    cause.rewardAfterCap <= cause.capAmount
  );
}

function hasConsistentKnownCardName(
  optimization: OptimizationResult,
  cardId: string,
  cardName: string,
): boolean {
  return (
    !optimization.assignments.some(
      ({ assignedCardId, assignedCardName, alternatives }) =>
        (
          assignedCardId === cardId &&
          assignedCardName !== cardName
        ) ||
        alternatives.some(
          (alternative) =>
            alternative.cardId === cardId &&
            alternative.cardName !== cardName,
        ),
    ) &&
    !optimization.cardResults.some(
      (card) => card.cardId === cardId && card.cardName !== cardName,
    ) &&
    (
      optimization.bestSingleCard === null ||
      optimization.bestSingleCard.cardId !== cardId ||
      optimization.bestSingleCard.cardName === cardName
    )
  );
}

function isPortfolioCapLossCoherent(
  value: unknown,
  optimization: OptimizationResult,
): value is PortfolioCapLoss {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const loss = value as Partial<PortfolioCapLoss>;
  const hasSelectedCard =
    isNonemptyString(loss.selectedCardId) &&
    isNonemptyString(loss.selectedCardName);
  const hasNoSelectedCard =
    loss.selectedCardId === null && loss.selectedCardName === null;
  if (
    !isNonemptyString(loss.transactionId) ||
    !isSafeNonnegativeInteger(loss.transactionOccurrence) ||
    !isNonemptyString(loss.category) ||
    !isNonemptyString(loss.counterfactualCardId) ||
    !isNonemptyString(loss.counterfactualCardName) ||
    (!hasSelectedCard && !hasNoSelectedCard) ||
    !isSafeNonnegativeInteger(loss.counterfactualReward) ||
    !isSafeNonnegativeInteger(loss.selectedReward) ||
    !isSafeNonnegativeInteger(loss.grossSuppressedReward) ||
    !isSafeNonnegativeInteger(loss.replacementReward) ||
    !isSafeNonnegativeInteger(loss.netLostReward) ||
    loss.counterfactualReward <= loss.selectedReward ||
    loss.grossSuppressedReward <= 0 ||
    loss.netLostReward <= 0 ||
    loss.counterfactualReward - loss.selectedReward !== loss.netLostReward ||
    addSafe(loss.replacementReward, loss.netLostReward) !==
      loss.grossSuppressedReward ||
    loss.grossSuppressedReward > loss.counterfactualReward ||
    !Array.isArray(loss.causes) ||
    loss.causes.length === 0 ||
    !loss.causes.every(isCapSuppressionCauseCoherent) ||
    !hasConsistentKnownCardName(
      optimization,
      loss.counterfactualCardId,
      loss.counterfactualCardName,
    )
  ) {
    return false;
  }

  let grossCauseDelta = 0;
  const causeKeys = new Set<string>();
  for (const cause of loss.causes) {
    const causeKey = JSON.stringify([
      cause.ruleId,
      cause.capGroup,
      cause.capType,
    ]);
    if (causeKeys.has(causeKey)) return false;
    causeKeys.add(causeKey);
    const next = addSafe(
      grossCauseDelta,
      cause.rewardBeforeCap - cause.rewardAfterCap,
    );
    if (next === null) return false;
    grossCauseDelta = next;
  }
  if (grossCauseDelta !== loss.grossSuppressedReward) return false;

  if (hasNoSelectedCard) {
    return loss.selectedReward === 0;
  }
  if (
    !isNonemptyString(loss.selectedCardId) ||
    !isNonemptyString(loss.selectedCardName) ||
    loss.selectedReward <= 0
  ) {
    return false;
  }
  if (
    !hasConsistentKnownCardName(
      optimization,
      loss.selectedCardId,
      loss.selectedCardName,
    ) ||
    !optimization.assignments.some(
      ({ assignedCardId, assignedCardName, category }) =>
        assignedCardId === loss.selectedCardId &&
        assignedCardName === loss.selectedCardName &&
        category === loss.category,
    ) ||
    !optimization.cardResults.some(
      ({ cardId, cardName }) =>
        cardId === loss.selectedCardId &&
        cardName === loss.selectedCardName,
    )
  ) {
    return false;
  }
  return (
    loss.counterfactualCardId !== loss.selectedCardId ||
    loss.counterfactualCardName === loss.selectedCardName
  );
}

function hasCoherentPortfolioCapLosses(
  optimization: OptimizationResult,
): boolean {
  const losses = optimization.portfolioCapLosses;
  if (losses === undefined) return true;
  if (!Array.isArray(losses)) return false;
  const transactionIdentities = new Set<string>();
  const selectedRewards = new Map<string, number>();
  const assignmentRewards = new Map(
    optimization.assignments.map(
      ({ assignedCardId, category, reward }) => [
        `${assignedCardId}\u0000${category}`,
        reward,
      ],
    ),
  );
  for (const loss of losses) {
    const transactionIdentity = JSON.stringify([
      loss.transactionId,
      loss.category,
      loss.transactionOccurrence,
    ]);
    if (
      !isPortfolioCapLossCoherent(loss, optimization) ||
      transactionIdentities.has(transactionIdentity)
    ) {
      return false;
    }
    transactionIdentities.add(transactionIdentity);
    if (loss.selectedCardId !== null) {
      const key = `${loss.selectedCardId}\u0000${loss.category}`;
      const selectedReward = addSafe(
        selectedRewards.get(key) ?? 0,
        loss.selectedReward,
      );
      const assignmentReward = assignmentRewards.get(key);
      if (
        selectedReward === null ||
        assignmentReward === undefined ||
        selectedReward > assignmentReward
      ) {
        return false;
      }
      selectedRewards.set(key, selectedReward);
    }
  }
  return true;
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
  if (!hasCoherentPortfolioCapLosses(optimization)) return false;

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
      const isRuleScoped =
        cap.capType === 'monthly_category' ||
        cap.capType === 'per_transaction';
      const hasNoIdentity =
        cap.ruleId === undefined && cap.capGroup === undefined;
      const hasValidIdentity =
        typeof cap.ruleId === 'string' &&
        cap.ruleId.length > 0 &&
        typeof cap.capGroup === 'string' &&
        cap.capGroup.length > 0;
      const validIdentity = isRuleScoped
        ? hasNoIdentity || hasValidIdentity
        : (
            cap.capType === 'monthly_total' &&
            hasNoIdentity
          );
      if (
        !Number.isSafeInteger(cap.capAmount) ||
        cap.capAmount < 0 ||
        !Number.isSafeInteger(cap.actualReward) ||
        cap.actualReward < 0 ||
        !Number.isSafeInteger(cap.appliedReward) ||
        cap.appliedReward < 0 ||
        cap.appliedReward > cap.actualReward ||
        !validIdentity ||
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
        (category) => {
          const monthlyCategoryCaps = (
            capsByCategory.get(category.category) ?? []
          ).filter((cap) => cap.capType === 'monthly_category');
          const legacyCapAmount = (
            category as { capAmount?: number }
          ).capAmount;
          const mismatchedLegacyCap =
            legacyCapAmount !== undefined &&
            monthlyCategoryCaps.length === 1 &&
            monthlyCategoryCaps[0]!.capAmount !== legacyCapAmount;
          return (
            assignmentByCategory.get(category.category)?.spending !==
              category.spending ||
            assignmentByCategory.get(category.category)?.reward !==
              category.reward ||
            category.capReached !== capsByCategory.has(category.category) ||
            mismatchedLegacyCap ||
            !sameRate(category.rate, category.reward, category.spending)
          );
        },
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
  const categories = new Set<string>();
  let spending = 0;
  let transactionCount = 0;
  for (const summary of categoryBreakdown) {
    if (
      categories.has(summary.category) ||
      summary.category.length === 0 ||
      summary.categoryNameKo.length === 0 ||
      !Number.isSafeInteger(summary.spending) ||
      summary.spending <= 0 ||
      !Number.isSafeInteger(summary.transactionCount) ||
      summary.transactionCount <= 0
    ) {
      return null;
    }
    categories.add(summary.category);
    const nextSpending = addSafe(spending, summary.spending);
    const nextTransactionCount = addSafe(
      transactionCount,
      summary.transactionCount,
    );
    if (nextSpending === null || nextTransactionCount === null) return null;
    spending = nextSpending;
    transactionCount = nextTransactionCount;
  }
  return { spending, transactionCount };
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

interface TransactionFacts {
  validTransactionCount: number;
  latestMonth: YearMonth;
  latestTransactionCount: number;
  latestSpending: number;
  latestPeriod: { start: string; end: string };
  fullPeriod: { start: string; end: string };
  months: Map<YearMonth, { spending: number; transactionCount: number }>;
  latestCategories: Map<
    string,
    { spending: number; transactionCount: number }
  >;
  latestPositiveTransactionCounts: Map<string, number>;
}

function collectTransactionFacts(
  transactions: readonly CategorizedTx[],
): TransactionFacts | null {
  const months = new Map<
    YearMonth,
    { spending: number; transactionCount: number }
  >();
  let validTransactionCount = 0;
  let latestMonth: YearMonth | undefined;
  let fullStart: string | undefined;
  let fullEnd: string | undefined;

  for (const transaction of transactions) {
    const month = yearMonthOfDate(transaction.date);
    if (month === null) continue;
    validTransactionCount += 1;
    if (!Number.isSafeInteger(validTransactionCount)) return null;
    if (latestMonth === undefined || month > latestMonth) latestMonth = month;
    if (fullStart === undefined || transaction.date < fullStart) {
      fullStart = transaction.date;
    }
    if (fullEnd === undefined || transaction.date > fullEnd) {
      fullEnd = transaction.date;
    }

    const current = months.get(month) ?? {
      spending: 0,
      transactionCount: 0,
    };
    const transactionCount = addSafe(current.transactionCount, 1);
    if (transactionCount === null) return null;
    current.transactionCount = transactionCount;
    if (transaction.amount > 0) {
      const spending = addSafe(current.spending, transaction.amount);
      if (spending === null) return null;
      current.spending = spending;
    }
    months.set(month, current);
  }

  if (
    latestMonth === undefined ||
    fullStart === undefined ||
    fullEnd === undefined
  ) {
    return null;
  }

  const latestCategories = new Map<
    string,
    { spending: number; transactionCount: number }
  >();
  const latestPositiveTransactionCounts = new Map<string, number>();
  let latestTransactionCount = 0;
  let latestSpending = 0;
  let latestStart: string | undefined;
  let latestEnd: string | undefined;
  for (const transaction of transactions) {
    if (yearMonthOfDate(transaction.date) !== latestMonth) continue;
    const transactionCount = addSafe(latestTransactionCount, 1);
    if (transactionCount === null) return null;
    latestTransactionCount = transactionCount;
    if (latestStart === undefined || transaction.date < latestStart) {
      latestStart = transaction.date;
    }
    if (latestEnd === undefined || transaction.date > latestEnd) {
      latestEnd = transaction.date;
    }
    if (transaction.amount <= 0) continue;

    const spending = addSafe(latestSpending, transaction.amount);
    if (spending === null) return null;
    latestSpending = spending;

    const category = categoryKeyOf(transaction);
    const transactionIdentity = JSON.stringify([transaction.id, category]);
    latestPositiveTransactionCounts.set(
      transactionIdentity,
      (latestPositiveTransactionCounts.get(transactionIdentity) ?? 0) + 1,
    );
    const current = latestCategories.get(category) ?? {
      spending: 0,
      transactionCount: 0,
    };
    const categorySpending = addSafe(current.spending, transaction.amount);
    const categoryTransactionCount = addSafe(current.transactionCount, 1);
    if (
      categorySpending === null ||
      categoryTransactionCount === null
    ) {
      return null;
    }
    current.spending = categorySpending;
    current.transactionCount = categoryTransactionCount;
    latestCategories.set(category, current);
  }

  if (latestStart === undefined || latestEnd === undefined) return null;
  return {
    validTransactionCount,
    latestMonth,
    latestTransactionCount,
    latestSpending,
    latestPeriod: { start: latestStart, end: latestEnd },
    fullPeriod: { start: fullStart, end: fullEnd },
    months,
    latestCategories,
    latestPositiveTransactionCounts,
  };
}

function hasCoherentPortfolioLossCategories(
  result: AnalysisResult,
  latestPositiveTransactionCounts?: ReadonlyMap<string, number>,
): boolean {
  const losses = result.optimization.portfolioCapLosses;
  if (losses === undefined) return true;
  const categories = new Set(
    result.categoryBreakdown.map(({ category }) => category),
  );
  return losses.every(
    ({ transactionId, transactionOccurrence, category }) =>
      categories.has(category) &&
      (
        latestPositiveTransactionCounts === undefined ||
        transactionOccurrence <
          (
            latestPositiveTransactionCounts.get(
              JSON.stringify([transactionId, category]),
            ) ?? 0
          )
      ),
  );
}

function hasExactPreviousSpendingBasis(
  result: AnalysisResult,
  latestMonth: YearMonth,
  hasStatementMonth: (month: YearMonth) => boolean,
): boolean {
  const basis = result.previousSpendingBasis;
  const option = result.previousMonthSpendingOption;
  if (!basis) return false;
  if (basis.kind === 'user-total') {
    return (
      Number.isSafeInteger(basis.amount) &&
      basis.amount >= 0 &&
      option === basis.amount
    );
  }
  if (option !== undefined) return false;

  const previousMonth =
    latestMonth === '0000-01'
      ? null
      : previousCalendarMonth(latestMonth);
  if (previousMonth === null) return false;
  if (basis.kind === 'statement-month') {
    return basis.month === previousMonth && hasStatementMonth(previousMonth);
  }
  return (
    basis.kind === 'missing-calendar-month' &&
    basis.month === previousMonth &&
    basis.assumedAmount === 0 &&
    !hasStatementMonth(previousMonth)
  );
}

function hasCoherentTruncatedFacts(
  result: AnalysisResult,
  truncatedTransactionCount: number | undefined,
): boolean {
  if (!result.monthlyBreakdown || result.monthlyBreakdown.length === 0) {
    return false;
  }

  const months = new Map<YearMonth, number>();
  let representedTransactionCount = 0;
  let latest:
    | { month: YearMonth; spending: number; transactionCount: number }
    | undefined;
  for (const entry of result.monthlyBreakdown) {
    if (
      !isYearMonth(entry.month) ||
      months.has(entry.month) ||
      !Number.isSafeInteger(entry.spending) ||
      entry.spending < 0 ||
      !Number.isSafeInteger(entry.transactionCount) ||
      entry.transactionCount <= 0
    ) {
      return false;
    }
    months.set(entry.month, entry.transactionCount);
    const count = addSafe(
      representedTransactionCount,
      entry.transactionCount,
    );
    if (count === null) return false;
    representedTransactionCount = count;
    if (!latest || entry.month > latest.month) {
      latest = {
        month: entry.month,
        spending: entry.spending,
        transactionCount: entry.transactionCount,
      };
    }
  }
  if (!latest) return false;

  const categoryTotals = categorySummaryTotals(result.categoryBreakdown);
  return (
    Number.isSafeInteger(truncatedTransactionCount) &&
    (truncatedTransactionCount ?? 0) > 0 &&
    representedTransactionCount > 0 &&
    (truncatedTransactionCount ?? 0) >= representedTransactionCount &&
    result.transactionCount === latest.transactionCount &&
    result.totalTransactionCount === representedTransactionCount &&
    categoryTotals !== null &&
    latest.transactionCount >= categoryTotals.transactionCount &&
    latest.spending === categoryTotals.spending &&
    latest.spending === result.optimization.totalSpending &&
    hasExactPreviousSpendingBasis(
      result,
      latest.month,
      (month) => (months.get(month) ?? 0) > 0,
    )
  );
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
      result.optimization.portfolioCapLosses?.some(
        ({ counterfactualCardId, selectedCardId }) =>
          !selectedCardIds.includes(counterfactualCardId) ||
          (
            selectedCardId !== null &&
            !selectedCardIds.includes(selectedCardId)
          ),
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
    return (
      hasCoherentPortfolioLossCategories(result) &&
      hasCoherentTruncatedFacts(
        result,
        context?.truncatedTransactionCount,
      )
    );
  }

  const facts = collectTransactionFacts(result.transactions);
  if (
    facts === null ||
    !hasCoherentPortfolioLossCategories(
      result,
      facts.latestPositiveTransactionCounts,
    )
  ) {
    return false;
  }
  if (
    result.categoryBreakdown.length !== facts.latestCategories.size ||
    result.categoryBreakdown.some((summary) => {
      const expected = facts.latestCategories.get(summary.category);
      return (
        expected?.spending !== summary.spending ||
        expected.transactionCount !== summary.transactionCount
      );
    }) ||
    result.transactionCount !== facts.latestTransactionCount ||
    (
      result.totalTransactionCount !== undefined &&
      result.totalTransactionCount !== facts.validTransactionCount
    ) ||
    result.optimization.totalSpending !== facts.latestSpending ||
    !samePeriod(result.statementPeriod, facts.latestPeriod) ||
    !samePeriod(result.fullStatementPeriod, facts.fullPeriod)
  ) {
    return false;
  }

  if (!result.monthlyBreakdown) return false;
  const seenMonths = new Set<YearMonth>();
  if (
    result.monthlyBreakdown.length !== facts.months.size ||
    result.monthlyBreakdown.some((entry) => {
      if (!isYearMonth(entry.month) || seenMonths.has(entry.month)) return true;
      seenMonths.add(entry.month);
      const expected = facts.months.get(entry.month);
      return (
        !expected ||
        entry.spending !== expected.spending ||
        entry.transactionCount !== expected.transactionCount
      );
    })
  ) {
    return false;
  }

  return hasExactPreviousSpendingBasis(
    result,
    facts.latestMonth,
    (month) => facts.months.has(month),
  );
}

export function validateAnalysisResult(
  result: AnalysisResult,
  context?: AnalysisCoherenceContext,
): ValidatedAnalysisResult | null {
  if (!isAnalysisResultCoherent(result, context)) return null;
  Object.defineProperty(result, VALIDATED_ANALYSIS_RESULT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return result as ValidatedAnalysisResult;
}

export function isValidatedAnalysisResult(
  result: AnalysisResult,
): result is ValidatedAnalysisResult {
  return (
    result as Partial<ValidatedAnalysisResult>
  )[VALIDATED_ANALYSIS_RESULT] === true;
}
