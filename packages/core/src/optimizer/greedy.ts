import {
  isOptimizationExecutableCard,
  isRecommendationEligibleCard,
  type CardRuleSet,
} from '@cherrypicker/rules/browser';
import type { CategorizedTransaction } from '../models/transaction.js';
import type {
  OptimizationResult,
  CardAssignment,
  CardRewardResult,
  CategoryReward,
  CapInfo,
  CalculationIssue,
  PortfolioCapLoss,
} from '../models/result.js';
import type { TransactionCapSuppression } from '../calculator/types.js';
import type { OptimizationConstraints } from './constraints.js';
import {
  buildCategoryKey,
  calculateRewardsWithPreparedCard,
  getCounterfactualReservations,
  getObservedCounterfactualStatefulReward,
  getObservedStatefulReward,
  isRewardEligibleTransaction,
  prepareCardRuleForCalculation,
  type PreparedCardRule,
} from '../calculator/reward.js';
import { normalizeMerchantText } from '../categorizer/normalize.js';
import {
  addSafeNonnegativeIntegers,
  assertSafeNonnegativeInteger,
} from '../numeric.js';

interface CardScore {
  cardId: string;
  cardName: string;
  reward: number;
  rate: number;
  counterfactualReward: number;
  counterfactualComplete: boolean;
  actualStatefulReward: boolean;
  counterfactualStatefulReward: boolean;
  capSuppression?: TransactionCapSuppression;
}

interface CardScoringResult {
  scores: CardScore[];
  unsupportedRules: CalculationIssue[];
}

interface TxAssignment {
  tx: CategorizedTransaction;
  transactionOccurrence: number;
  assignedCardId: string;
  assignedCardName: string;
  reward: number;
  rate: number;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareOptionalAscii(
  left: string | undefined,
  right: string | undefined,
): number {
  if (left === right) return 0;
  if (left === undefined) return -1;
  if (right === undefined) return 1;
  return compareAscii(left, right);
}

function compareOptionalNumber(
  left: number | undefined,
  right: number | undefined,
): number {
  if (Object.is(left, right)) return 0;
  if (left === undefined) return -1;
  if (right === undefined) return 1;
  if (Number.isNaN(left)) return Number.isNaN(right) ? 0 : -1;
  if (Number.isNaN(right)) return 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareOptionalAsciiSet(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): number {
  if (left === undefined) return right === undefined ? 0 : -1;
  if (right === undefined) return 1;

  const normalizedLeft = [...new Set(left)].sort(compareAscii);
  const normalizedRight = [...new Set(right)].sort(compareAscii);
  const sharedLength = Math.min(
    normalizedLeft.length,
    normalizedRight.length,
  );
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = compareAscii(
      normalizedLeft[index]!,
      normalizedRight[index]!,
    );
    if (difference !== 0) return difference;
  }
  return normalizedLeft.length - normalizedRight.length;
}

const FACT_PROVENANCE_KEYS = [
  'paymentType',
  'channel',
  'fuelVolumeLiters',
  'performanceExclusionTags',
] as const;

/**
 * Canonically orders every immutable transaction fact that can affect reward
 * calculation. Upload-derived IDs are deliberately excluded: equivalent
 * financial facts must remain interchangeable across file permutations.
 */
export function compareRewardRelevantTransactions(
  left: CategorizedTransaction,
  right: CategorizedTransaction,
): number {
  const amountDifference = right.amount - left.amount;
  if (amountDifference !== 0) return amountDifference;

  const stringPairs: ReadonlyArray<readonly [string | undefined, string | undefined]> = [
    [normalizeMerchantText(left.merchant), normalizeMerchantText(right.merchant)],
    [left.date, right.date],
    [left.category, right.category],
    [left.subcategory, right.subcategory],
    [left.paymentType, right.paymentType],
    [left.channel, right.channel],
  ];
  for (const [leftValue, rightValue] of stringPairs) {
    const difference = compareOptionalAscii(leftValue, rightValue);
    if (difference !== 0) return difference;
  }

  const fuelDifference = compareOptionalNumber(
    left.fuelVolumeLiters,
    right.fuelVolumeLiters,
  );
  if (fuelDifference !== 0) return fuelDifference;

  for (const key of FACT_PROVENANCE_KEYS) {
    const difference = compareOptionalAscii(
      left.factProvenance?.[key],
      right.factProvenance?.[key],
    );
    if (difference !== 0) return difference;
  }

  const installmentDifference = compareOptionalNumber(
    left.installments,
    right.installments,
  );
  if (installmentDifference !== 0) return installmentDifference;

  const exclusionDifference = compareOptionalAsciiSet(
    left.performanceExclusionTags,
    right.performanceExclusionTags,
  );
  if (exclusionDifference !== 0) return exclusionDifference;

  const remainingStringPairs: ReadonlyArray<
    readonly [string | undefined, string | undefined]
  > = [
    [left.currency, right.currency],
    [left.rawCategory, right.rawCategory],
    [left.memo, right.memo],
  ];
  for (const [leftValue, rightValue] of remainingStringPairs) {
    const difference = compareOptionalAscii(leftValue, rightValue);
    if (difference !== 0) return difference;
  }

  return 0;
}

function buildCanonicalRewardInput(
  ...transactionGroups: ReadonlyArray<readonly CategorizedTransaction[]>
): CategorizedTransaction[] {
  return transactionGroups
    .flatMap((transactions) => transactions)
    .sort(compareRewardRelevantTransactions);
}

function subtractSafeRewardTotals(
  after: number,
  before: number,
  label: string,
): number {
  assertSafeNonnegativeInteger(after, `${label} after`);
  assertSafeNonnegativeInteger(before, `${label} before`);
  const difference = after - before;
  if (!Number.isSafeInteger(difference)) {
    throw new Error(`${label} difference is not safely representable: ${difference}`);
  }
  return difference;
}

function getCardName(rule: CardRuleSet): string {
  return rule.card.nameKo || rule.card.name;
}

function calculateCardOutput(
  transactions: CategorizedTransaction[],
  previousMonthSpending: number,
  preparedCardRule: PreparedCardRule,
  collectCapSuppressions = true,
  capSuppressionStartIndex = 0,
  observeStatefulRewardAtIndex?: number,
  prefixCounterfactualAlreadyReconciled = false,
) {
  return calculateRewardsWithPreparedCard({
    transactions,
    previousMonthSpending,
    preparedCardRule,
    collectCapSuppressions,
    capSuppressionStartIndex,
    observeStatefulRewardAtIndex,
    prefixCounterfactualAlreadyReconciled,
  });
}

function scoreCardsForTransaction(
  transaction: CategorizedTransaction,
  preparedCardRules: PreparedCardRule[],
  cardPreviousSpending: Map<string, number>,
  assignedTransactionsByCard: Map<string, CategorizedTransaction[]>,
  collectPortfolioTelemetry: boolean,
): CardScoringResult {
  // Defensive guard: callers should pre-filter, but division by zero
  // would produce Infinity and corrupt sort ordering.
  if (
    !Number.isSafeInteger(transaction.amount) ||
    !isRewardEligibleTransaction(transaction)
  ) {
    return { scores: [], unsupportedRules: [] };
  }
  const scores: CardScore[] = [];
  const unsupportedRules: CalculationIssue[] = [];

  for (const preparedCardRule of preparedCardRules) {
    const { cardRule: rule } = preparedCardRule;
    const currentTransactions = assignedTransactionsByCard.get(rule.card.id) ?? [];
    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const before = calculateCardOutput(
      currentTransactions,
      previousMonthSpending,
      preparedCardRule,
      false,
    ).totalReward;
    const collectCapSuppressions =
      collectPortfolioTelemetry && preparedCardRule.hasRewardCap;
    const transactionIndex = currentTransactions.length;
    // Only this exact append-scoring path may assert the prefix proof. The
    // input latch is monotonic for the current optimizer invocation, and
    // collection additionally proves this capped card participates.
    const prefixCounterfactualAlreadyReconciled = collectCapSuppressions;
    const after = calculateCardOutput(
      [...currentTransactions, transaction],
      previousMonthSpending,
      preparedCardRule,
      collectCapSuppressions,
      transactionIndex,
      collectPortfolioTelemetry ? transactionIndex : undefined,
      prefixCounterfactualAlreadyReconciled,
    );
    const reward = Math.max(0, after.totalReward - before);
    assertSafeNonnegativeInteger(reward, 'marginal reward');
    const currentSuppressions = after.capSuppressions.filter(
      (suppression) => suppression.transactionIndex === transactionIndex,
    );
    const candidateSuppression = currentSuppressions.length === 1
      ? currentSuppressions[0]
      : undefined;
    const capSuppression =
      candidateSuppression?.actualReward === reward
        ? candidateSuppression
        : undefined;
    // transaction.amount is guaranteed positive here (pre-filtered at line 198).
    const rate = reward / transaction.amount;

    // Candidate cards that lose the marginal-reward comparison do not appear
    // in cardResults. Retain only issues produced for this transaction while
    // scoring the candidate, so disclosures cover real matching limitations
    // without attributing issues from previously assigned transactions.
    unsupportedRules.push(
      ...after.unsupportedRules.filter(
        (issue) => issue.transactionId === transaction.id,
      ),
    );

    scores.push({
      cardId: rule.card.id,
      cardName: getCardName(rule),
      reward,
      rate,
      counterfactualReward:
        capSuppression?.counterfactualReward ?? reward,
      counterfactualComplete: after.capSuppressionsComplete,
      actualStatefulReward: getObservedStatefulReward(after) ?? false,
      counterfactualStatefulReward:
        getObservedCounterfactualStatefulReward(after) ?? false,
      capSuppression,
    });
  }

  return {
    scores: scores.sort(
      (a, b) => b.reward - a.reward || compareAscii(a.cardId, b.cardId),
    ),
    unsupportedRules,
  };
}

function deduplicateCalculationIssues(
  issues: readonly CalculationIssue[],
): CalculationIssue[] {
  const unique = new Map<string, CalculationIssue>();
  for (const issue of issues) {
    const key = [
      issue.cardId,
      issue.transactionId,
      issue.ruleId,
      issue.category,
      issue.reason,
    ].join('\u0000');
    if (!unique.has(key)) unique.set(key, issue);
  }
  return [...unique.values()].sort(
    (left, right) =>
      compareAscii(left.cardId, right.cardId) ||
      compareAscii(left.transactionId, right.transactionId) ||
      compareAscii(left.ruleId, right.ruleId) ||
      compareAscii(left.category, right.category) ||
      compareAscii(left.reason, right.reason) ||
      compareOptionalAscii(left.detail, right.detail),
  );
}

function buildAssignments(
  txAssignments: TxAssignment[],
  categoryLabels: Map<string, string>,
  preparedCardRules: PreparedCardRule[],
  cardPreviousSpending: Map<string, number>,
  assignedTransactionsByCard: Map<string, CategorizedTransaction[]>,
): CardAssignment[] {
  const assignmentMap = new Map<string, CardAssignment>();
  const transactionsByAssignment = new Map<string, CategorizedTransaction[]>();
  const finalRewardByCard = new Map(
    preparedCardRules.map((preparedCardRule) => {
      const { cardRule: rule } = preparedCardRule;
      const previousMonthSpending =
        cardPreviousSpending.get(rule.card.id) ?? 0;
      const actualTransactions =
        assignedTransactionsByCard.get(rule.card.id) ?? [];
      return [
        rule.card.id,
        calculateCardOutput(
          actualTransactions,
          previousMonthSpending,
          preparedCardRule,
          false,
        ).totalReward,
      ] as const;
    }),
  );

  for (const assignment of txAssignments) {
    const categoryKey = buildCategoryKey(assignment.tx.category, assignment.tx.subcategory);
    const key = `${categoryKey}::${assignment.assignedCardId}`;
    const current = assignmentMap.get(key);

    if (current) {
      current.spending = addSafeNonnegativeIntegers(
        current.spending,
        assignment.tx.amount,
        'assignment spending',
      );
      current.transactionCount = addSafeNonnegativeIntegers(
        current.transactionCount,
        1,
        'assignment transaction count',
      );
      current.reward = addSafeNonnegativeIntegers(
        current.reward,
        assignment.reward,
        'assignment reward',
      );
      // Recalculate effective rate from accumulated spending/reward.
      // For the first transaction in a category, assignment.rate (marginal
      // rate from scoreCardsForTransaction) equals reward/spending — the
      // two sources are equivalent for a single entry. For accumulated
      // entries, the effective rate must be recalculated because marginal
      // rates may differ across transactions (e.g., due to cap interactions).
      current.rate = current.spending > 0 ? current.reward / current.spending : 0;
    } else {
      assignmentMap.set(key, {
        category: categoryKey,
        categoryNameKo: categoryLabels.get(categoryKey) ?? categoryLabels.get(assignment.tx.category) ?? categoryKey,
        assignedCardId: assignment.assignedCardId,
        assignedCardName: assignment.assignedCardName,
        spending: assignment.tx.amount,
        transactionCount: 1,
        reward: assignment.reward,
        rate: assignment.rate,
        alternatives: [],
      });
    }

    const groupTransactions = transactionsByAssignment.get(key) ?? [];
    groupTransactions.push(assignment.tx);
    transactionsByAssignment.set(key, groupTransactions);
  }

  for (const [key, assignment] of assignmentMap) {
    const groupTransactions = transactionsByAssignment.get(key) ?? [];
    const alternatives = preparedCardRules
      .filter(
        ({ cardRule }) =>
          cardRule.card.id !== assignment.assignedCardId,
      )
      .flatMap((preparedCardRule) => {
        const { cardRule: rule } = preparedCardRule;
        const previousMonthSpending =
          cardPreviousSpending.get(rule.card.id) ?? 0;
        const actualTransactions =
          assignedTransactionsByCard.get(rule.card.id) ?? [];
        const before = finalRewardByCard.get(rule.card.id) ?? 0;
        const after = calculateCardOutput(
          buildCanonicalRewardInput(actualTransactions, groupTransactions),
          previousMonthSpending,
          preparedCardRule,
          false,
        ).totalReward;
        const reward = subtractSafeRewardTotals(
          after,
          before,
          `alternative reward for ${rule.card.id}`,
        );
        if (reward <= 0) return [];
        return [{
          cardId: rule.card.id,
          cardName: getCardName(rule),
          reward,
          rate: assignment.spending > 0 ? reward / assignment.spending : 0,
        }];
      })
      .sort(
        (a, b) => b.reward - a.reward || compareAscii(a.cardId, b.cardId),
      )
      .slice(0, 5);

    assignment.alternatives = alternatives;
  }

  // Reporting still stays category-based, but now reflects the real set of
  // transactions that ended up on each card instead of synthetic category totals.
  return [...assignmentMap.values()].sort(
    (a, b) =>
      b.spending - a.spending ||
      compareAscii(a.category, b.category) ||
      compareAscii(a.assignedCardId, b.assignedCardId),
  );
}

function buildCardResults(
  preparedCardRules: PreparedCardRule[],
  cardPreviousSpending: Map<string, number>,
  assignedTransactionsByCard: Map<string, CategorizedTransaction[]>,
  categoryLabels: Map<string, string>,
  txAssignments: TxAssignment[],
  collectStatefulCapSuppressions: boolean,
): {
  cardResults: CardRewardResult[];
  statefulPortfolioCapLosses: PortfolioCapLoss[];
  capSuppressionsComplete: boolean;
} {
  const cardResults: CardRewardResult[] = [];
  const statefulPortfolioCapLosses: PortfolioCapLoss[] = [];
  let capSuppressionsComplete = true;

  for (const preparedCardRule of preparedCardRules) {
    const { cardRule: rule } = preparedCardRule;
    const assignedTransactions = assignedTransactionsByCard.get(rule.card.id) ?? [];
    if (assignedTransactions.length === 0) continue;

    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const collectCapSuppressions =
      collectStatefulCapSuppressions &&
      preparedCardRule.hasRewardCap &&
      preparedCardRule.hasStatefulReward;
    const output = calculateCardOutput(
      assignedTransactions,
      previousMonthSpending,
      preparedCardRule,
      collectCapSuppressions,
    );
    if (!output.capSuppressionsComplete) {
      capSuppressionsComplete = false;
    }
    const cardAssignments = txAssignments.filter(
      (assignment) => assignment.assignedCardId === rule.card.id,
    );
    for (const suppression of output.capSuppressions) {
      if (getCounterfactualReservations(suppression).length === 0) continue;
      const assignment = cardAssignments[suppression.transactionIndex];
      if (
        !assignment ||
        assignment.tx.id !== suppression.transactionId ||
        buildCategoryKey(
          assignment.tx.category,
          assignment.tx.subcategory,
        ) !== suppression.category ||
        assignment.reward !== suppression.actualReward
      ) {
        capSuppressionsComplete = false;
        continue;
      }
      statefulPortfolioCapLosses.push({
        transactionId: suppression.transactionId,
        transactionOccurrence: assignment.transactionOccurrence,
        category: suppression.category,
        counterfactualCardId: rule.card.id,
        counterfactualCardName: getCardName(rule),
        selectedCardId: rule.card.id,
        selectedCardName: getCardName(rule),
        counterfactualReward: suppression.counterfactualReward,
        selectedReward: suppression.actualReward,
        grossSuppressedReward: suppression.grossSuppressedReward,
        replacementReward: suppression.replacementReward,
        netLostReward: suppression.netSuppressedReward,
        causes: suppression.causes,
      });
    }
    // Optimizer only assigns positive-amount transactions (filtered at line 271),
    // so Math.abs() is unnecessary — use tx.amount directly (C33-06).
    // IMPORTANT: buildCardResults requires pre-filtered positive-amount
    // transactions as input. If called with unfiltered data (including negative
    // or zero amounts), totalSpending and effectiveRate would be incorrect (C40-04).
    const totalSpending = output.totalSpending;
    // Replace English categoryKey in categoryNameKo with the Korean label
    // from the taxonomy (if available). calculateRewards sets categoryNameKo
    // to the raw categoryKey (e.g. "dining.cafe"); we want "카페" instead.
    const byCategory: CategoryReward[] = output.rewards.map(r => ({
      ...r,
      categoryNameKo: categoryLabels.get(r.category) ?? r.categoryNameKo,
    }));
    const capsHit: CapInfo[] = output.capsHit;

    cardResults.push({
      cardId: rule.card.id,
      cardName: getCardName(rule),
      totalReward: output.totalReward,
      totalSpending,
      effectiveRate: totalSpending > 0 ? output.totalReward / totalSpending : 0,
      byCategory,
      performanceTier: output.performanceTier,
      capsHit,
      unsupportedRules: deduplicateCalculationIssues(output.unsupportedRules),
    });
  }

  return {
    cardResults,
    statefulPortfolioCapLosses,
    capSuppressionsComplete,
  };
}

/**
 * Greedy optimizer: assigns each transaction to the card with the highest
 * marginal reward while preserving the original transaction facts.
 */
export function greedyOptimize(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
): OptimizationResult {
  if (cardRules.length === 0) {
    throw new Error('cardRules must contain at least one card');
  }
  const eligibleCardRules = cardRules
    .filter(isRecommendationEligibleCard)
    .sort((left, right) => compareAscii(left.card.id, right.card.id));
  if (eligibleCardRules.length === 0) {
    throw new Error(
      'cardRules must contain at least one recommendation-eligible card',
    );
  }
  const executableCardRules = eligibleCardRules.filter(
    isOptimizationExecutableCard,
  );
  const preparedCardRules = executableCardRules.map(
    prepareCardRuleForCalculation,
  );
  const eligibleCardIds = new Set(
    executableCardRules.map((rule) => rule.card.id),
  );
  for (const transaction of constraints.transactions) {
    if (
      !Number.isFinite(transaction.amount) ||
      !Number.isSafeInteger(transaction.amount)
    ) {
      throw new Error(
        `transaction amount must be a finite safe integer, got ${transaction.amount} for ${transaction.id}`,
      );
    }
  }
  for (const card of constraints.cards) {
    if (!eligibleCardIds.has(card.cardId)) continue;
    assertSafeNonnegativeInteger(
      card.previousMonthSpending,
      `previousMonthSpending for ${card.cardId}`,
    );
  }

  const cardPreviousSpending = new Map(
    constraints.cards.map((c) => [c.cardId, c.previousMonthSpending]),
  );
  const assignedTransactionsByCard = new Map<string, CategorizedTransaction[]>();
  for (const { cardRule: rule } of preparedCardRules) {
    assignedTransactionsByCard.set(rule.card.id, []);
  }

  // Filter out zero/negative amounts AND NaN/Infinity values (C23-01).
  // NaN > 0 is false so NaN amounts are already excluded by the > 0 check,
  // but Number.isFinite also guards the sort comparator against NaN
  // comparisons which sort inconsistently across JS engines.
  const sortedTransactions = buildCanonicalRewardInput(
    constraints.transactions.filter(isRewardEligibleTransaction),
  );

  const txAssignments: TxAssignment[] = [];
  const candidateUnsupportedRules: CalculationIssue[] = [];
  const portfolioCapLosses: PortfolioCapLoss[] = [];
  let portfolioCapLossesComplete = true;
  const transactionOccurrences = new Map<string, number>();
  const transactionOrderByIdentity = new Map<string, number>();
  let unassignedSpending = 0;
  let unassignedTransactionCount = 0;

  for (const [transactionOrder, transaction] of sortedTransactions.entries()) {
    const transactionCategory = buildCategoryKey(
      transaction.category,
      transaction.subcategory,
    );
    const transactionIdentity = JSON.stringify([
      transaction.id,
      transactionCategory,
    ]);
    const transactionOccurrence =
      transactionOccurrences.get(transactionIdentity) ?? 0;
    transactionOccurrences.set(
      transactionIdentity,
      transactionOccurrence + 1,
    );
    transactionOrderByIdentity.set(
      JSON.stringify([
        transaction.id,
        transactionCategory,
        transactionOccurrence,
      ]),
      transactionOrder,
    );
    const scoring = scoreCardsForTransaction(
      transaction,
      preparedCardRules,
      cardPreviousSpending,
      assignedTransactionsByCard,
      portfolioCapLossesComplete,
    );
    const { scores } = scoring;
    const currentTelemetryComplete = scores.every(
      ({ counterfactualComplete }) => counterfactualComplete,
    );
    if (!currentTelemetryComplete) {
      portfolioCapLossesComplete = false;
    }
    candidateUnsupportedRules.push(...scoring.unsupportedRules);
    const best = scores[0];
    const selectedReward = best?.reward ?? 0;
    const hasSelectedReward = best !== undefined && best.reward > 0;
    const counterfactualWouldReplaceBest = (score: CardScore): boolean =>
      score.counterfactualReward > selectedReward ||
      (
        hasSelectedReward &&
        score.counterfactualReward === selectedReward &&
        compareAscii(score.cardId, best.cardId) < 0
      );
    if (
      scores.some((score) =>
        score.capSuppression !== undefined &&
        getCounterfactualReservations(score.capSuppression).length > 0 &&
        counterfactualWouldReplaceBest(score) &&
        (
          !hasSelectedReward ||
          score.cardId !== best.cardId
        )
      )
    ) {
      // A stateful maxUses/fixed-per-day opportunity on an unassigned or
      // different-card transaction cannot be combined exactly with later
      // actual uses using transaction-local positive rows. Preserve "unknown"
      // instead of publishing a deceptively additive portfolio total.
      portfolioCapLossesComplete = false;
    }
    const selectBestCounterfactual = (
      candidates: readonly CardScore[],
    ): CardScore | undefined =>
      candidates.reduce<CardScore | undefined>(
      (current, score) => {
        if (!current) return score;
        if (score.counterfactualReward > current.counterfactualReward) {
          return score;
        }
        if (
          score.counterfactualReward === current.counterfactualReward &&
          compareAscii(score.cardId, current.cardId) < 0
        ) {
          return score;
        }
        return current;
      },
      undefined,
    );
    const winningCounterfactual = selectBestCounterfactual(scores);
    const bestCounterfactual = selectBestCounterfactual(
      scores.filter((score) =>
        score.capSuppression === undefined ||
        getCounterfactualReservations(score.capSuppression).length === 0
      ),
    );
    if (
      best &&
      (
        best.actualStatefulReward ||
        best.counterfactualStatefulReward
      ) &&
      winningCounterfactual?.capSuppression &&
      counterfactualWouldReplaceBest(winningCounterfactual) &&
      winningCounterfactual.cardId !== best.cardId
    ) {
      // Moving this transaction to a different card would free a scarce
      // maxUses/fixed-per-day opportunity on the selected card. A later
      // negative offset may cancel this local gain, so positive rows alone
      // cannot reconcile the portfolio exactly.
      portfolioCapLossesComplete = false;
    }
    if (
      currentTelemetryComplete &&
      bestCounterfactual?.capSuppression &&
      bestCounterfactual.counterfactualReward > selectedReward
    ) {
      const suppression = bestCounterfactual.capSuppression;
      const netLostReward =
        bestCounterfactual.counterfactualReward - selectedReward;
      const replacementReward =
        suppression.grossSuppressedReward - netLostReward;
      if (
        Number.isSafeInteger(netLostReward) &&
        netLostReward > 0 &&
        Number.isSafeInteger(replacementReward) &&
        replacementReward >= 0
      ) {
        portfolioCapLosses.push({
          transactionId: transaction.id,
          transactionOccurrence,
          category: suppression.category,
          counterfactualCardId: bestCounterfactual.cardId,
          counterfactualCardName: bestCounterfactual.cardName,
          selectedCardId: hasSelectedReward ? best.cardId : null,
          selectedCardName: hasSelectedReward ? best.cardName : null,
          counterfactualReward: bestCounterfactual.counterfactualReward,
          selectedReward,
          grossSuppressedReward: suppression.grossSuppressedReward,
          replacementReward,
          netLostReward,
          causes: suppression.causes,
        });
      }
    }
    if (!best || best.reward === 0) {
      unassignedSpending = addSafeNonnegativeIntegers(
        unassignedSpending,
        transaction.amount,
        'optimizer unassigned spending',
      );
      unassignedTransactionCount = addSafeNonnegativeIntegers(
        unassignedTransactionCount,
        1,
        'optimizer unassigned transaction count',
      );
      continue;
    }

    // sortedTransactions is canonical and this loop advances in that order,
    // so each card-owned array remains a canonical subsequence. On first
    // insertion, create a new array and store it in the map. On subsequent
    // insertions, push in-place — the map already holds the same reference so
    // no .set() is needed (C31-02).
    let currentTransactions = assignedTransactionsByCard.get(best.cardId);
    if (!currentTransactions) {
      currentTransactions = [transaction];
      assignedTransactionsByCard.set(best.cardId, currentTransactions);
    } else {
      currentTransactions.push(transaction);
    }

    txAssignments.push({
      tx: transaction,
      transactionOccurrence,
      assignedCardId: best.cardId,
      assignedCardName: best.cardName,
      reward: best.reward,
      rate: best.rate,
    });
  }

  const canonicalAssignedTransactionsByCard = new Map(
    [...assignedTransactionsByCard].map(([cardId, transactions]) => [
      cardId,
      buildCanonicalRewardInput(transactions),
    ] as const),
  );
  const assignments = buildAssignments(
    txAssignments,
    constraints.categoryLabels,
    preparedCardRules,
    cardPreviousSpending,
    canonicalAssignedTransactionsByCard,
  );
  const {
    cardResults,
    statefulPortfolioCapLosses,
    capSuppressionsComplete: finalCapSuppressionsComplete,
  } = buildCardResults(
    preparedCardRules,
    cardPreviousSpending,
    canonicalAssignedTransactionsByCard,
    constraints.categoryLabels,
    txAssignments,
    portfolioCapLossesComplete,
  );
  if (!finalCapSuppressionsComplete) {
    portfolioCapLossesComplete = false;
  }
  portfolioCapLosses.push(...statefulPortfolioCapLosses);
  const bestLossByTransaction = new Map<string, PortfolioCapLoss>();
  for (const loss of portfolioCapLosses) {
    const identity = JSON.stringify([
      loss.transactionId,
      loss.category,
      loss.transactionOccurrence,
    ]);
    const current = bestLossByTransaction.get(identity);
    if (
      !current ||
      loss.netLostReward > current.netLostReward ||
      (
        loss.netLostReward === current.netLostReward &&
        compareAscii(
          loss.counterfactualCardId,
          current.counterfactualCardId,
        ) < 0
      )
    ) {
      bestLossByTransaction.set(identity, loss);
    }
  }
  portfolioCapLosses.splice(
    0,
    portfolioCapLosses.length,
    ...bestLossByTransaction.values(),
  );
  portfolioCapLosses.sort((left, right) => {
    const leftOrder = transactionOrderByIdentity.get(JSON.stringify([
      left.transactionId,
      left.category,
      left.transactionOccurrence,
    ])) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = transactionOrderByIdentity.get(JSON.stringify([
      right.transactionId,
      right.category,
      right.transactionOccurrence,
    ])) ?? Number.MAX_SAFE_INTEGER;
    return (
      leftOrder - rightOrder ||
      compareAscii(left.counterfactualCardId, right.counterfactualCardId)
    );
  });

  const totalReward = cardResults.reduce(
    (sum, cardResult) => addSafeNonnegativeIntegers(
      sum,
      cardResult.totalReward,
      'optimizer total reward',
    ),
    0,
  );
  const assignedSpending = txAssignments.reduce(
    (sum, assignment) => addSafeNonnegativeIntegers(
      sum,
      assignment.tx.amount,
      'optimizer assigned spending',
    ),
    0,
  );
  const totalSpending = addSafeNonnegativeIntegers(
    assignedSpending,
    unassignedSpending,
    'optimizer total spending',
  );
  const effectiveRate = totalSpending > 0 ? totalReward / totalSpending : 0;

  let bestSingleCard:
    | { cardId: string; cardName: string; totalReward: number }
    | null = null;
  for (const preparedCardRule of preparedCardRules) {
    const { cardRule: rule } = preparedCardRule;
    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const output = calculateCardOutput(
      sortedTransactions,
      previousMonthSpending,
      preparedCardRule,
      false,
    );
    if (output.totalReward === 0) continue;

    if (
      bestSingleCard === null ||
      output.totalReward > bestSingleCard.totalReward ||
      (
        output.totalReward === bestSingleCard.totalReward &&
        compareAscii(rule.card.id, bestSingleCard.cardId) < 0
      )
    ) {
      bestSingleCard = {
        cardId: rule.card.id,
        cardName: getCardName(rule),
        totalReward: output.totalReward,
      };
    }
  }

  if (bestSingleCard === null && totalReward !== 0) {
    throw new Error(
      'optimizer invariant violated: positive optimized reward without a positive single-card result',
    );
  }
  const savingsVsSingleCard =
    bestSingleCard === null ? 0 : totalReward - bestSingleCard.totalReward;
  if (!Number.isSafeInteger(savingsVsSingleCard)) {
    throw new Error(
      `optimizer savings is not safely representable: ${savingsVsSingleCard}`,
    );
  }
  const unsupportedRules = deduplicateCalculationIssues([
    ...candidateUnsupportedRules,
    ...cardResults.flatMap((result) => result.unsupportedRules ?? []),
  ]);

  return {
    assignments,
    totalReward,
    totalSpending,
    unassignedSpending,
    unassignedTransactionCount,
    effectiveRate,
    savingsVsSingleCard,
    bestSingleCard,
    cardResults,
    unsupportedRules,
    portfolioCapLosses:
      portfolioCapLossesComplete ? portfolioCapLosses : undefined,
  };
}
