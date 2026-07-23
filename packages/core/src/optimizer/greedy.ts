import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../models/transaction.js';
import type {
  OptimizationResult,
  CardAssignment,
  CardRewardResult,
  CategoryReward,
  CapInfo,
  CalculationIssue,
} from '../models/result.js';
import type { OptimizationConstraints } from './constraints.js';
import { calculateRewards, buildCategoryKey } from '../calculator/reward.js';

interface CardScore {
  cardId: string;
  cardName: string;
  reward: number;
  rate: number;
}

interface CardScoringResult {
  scores: CardScore[];
  unsupportedRules: CalculationIssue[];
}

interface TxAssignment {
  tx: CategorizedTransaction;
  assignedCardId: string;
  assignedCardName: string;
  reward: number;
  rate: number;
  alternatives: CardScore[];
}

function getCardName(rule: CardRuleSet): string {
  return rule.card.nameKo || rule.card.name;
}

function calculateCardOutput(
  transactions: CategorizedTransaction[],
  previousMonthSpending: number,
  cardRule: CardRuleSet,
) {
  return calculateRewards({
    transactions,
    previousMonthSpending,
    cardRule,
  });
}

function scoreCardsForTransaction(
  transaction: CategorizedTransaction,
  cardRules: CardRuleSet[],
  cardPreviousSpending: Map<string, number>,
  assignedTransactionsByCard: Map<string, CategorizedTransaction[]>,
): CardScoringResult {
  // Defensive guard: callers should pre-filter, but division by zero
  // would produce Infinity and corrupt sort ordering.
  if (transaction.amount <= 0 || !Number.isFinite(transaction.amount)) {
    return { scores: [], unsupportedRules: [] };
  }
  const scores: CardScore[] = [];
  const unsupportedRules: CalculationIssue[] = [];

  for (const rule of cardRules) {
    const currentTransactions = assignedTransactionsByCard.get(rule.card.id) ?? [];
    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;

    const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
    const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule);
    const reward = Math.max(0, after.totalReward - before);
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
    });
  }

  return {
    scores: scores.sort((a, b) => b.reward - a.reward),
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
  return [...unique.values()];
}

function buildAssignments(txAssignments: TxAssignment[], categoryLabels: Map<string, string>): CardAssignment[] {
  const assignmentMap = new Map<string, CardAssignment>();
  const alternativeRewardMap = new Map<string, Map<string, { cardName: string; reward: number }>>();

  for (const assignment of txAssignments) {
    const categoryKey = buildCategoryKey(assignment.tx.category, assignment.tx.subcategory);
    const key = `${categoryKey}::${assignment.assignedCardId}`;
    const current = assignmentMap.get(key);

    if (current) {
      current.spending += assignment.tx.amount;
      current.reward += assignment.reward;
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
        reward: assignment.reward,
        rate: assignment.rate,
        alternatives: [],
      });
    }

    const alternativesForAssignment = alternativeRewardMap.get(key) ?? new Map<string, { cardName: string; reward: number }>();
    for (const alternative of assignment.alternatives) {
      const currentAlternative = alternativesForAssignment.get(alternative.cardId);
      if (currentAlternative) {
        currentAlternative.reward += alternative.reward;
      } else {
        alternativesForAssignment.set(alternative.cardId, {
          cardName: alternative.cardName,
          reward: alternative.reward,
        });
      }
    }
    alternativeRewardMap.set(key, alternativesForAssignment);
  }

  for (const [key, assignment] of assignmentMap) {
    const alternatives = [...(alternativeRewardMap.get(key)?.entries() ?? [])]
      .map(([cardId, value]) => ({
        cardId,
        cardName: value.cardName,
        reward: value.reward,
        rate: assignment.spending > 0 ? value.reward / assignment.spending : 0,
      }))
      .sort((a, b) => b.reward - a.reward)
      .slice(0, 5);

    assignment.alternatives = alternatives;
  }

  // Reporting still stays category-based, but now reflects the real set of
  // transactions that ended up on each card instead of synthetic category totals.
  return [...assignmentMap.values()].sort((a, b) => b.spending - a.spending);
}

function buildCardResults(
  cardRules: CardRuleSet[],
  cardPreviousSpending: Map<string, number>,
  assignedTransactionsByCard: Map<string, CategorizedTransaction[]>,
  categoryLabels: Map<string, string>,
): CardRewardResult[] {
  const cardResults: CardRewardResult[] = [];

  for (const rule of cardRules) {
    const assignedTransactions = assignedTransactionsByCard.get(rule.card.id) ?? [];
    if (assignedTransactions.length === 0) continue;

    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const output = calculateCardOutput(assignedTransactions, previousMonthSpending, rule);
    // Optimizer only assigns positive-amount transactions (filtered at line 271),
    // so Math.abs() is unnecessary — use tx.amount directly (C33-06).
    // IMPORTANT: buildCardResults requires pre-filtered positive-amount
    // transactions as input. If called with unfiltered data (including negative
    // or zero amounts), totalSpending and effectiveRate would be incorrect (C40-04).
    const totalSpending = assignedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
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
      unsupportedRules: output.unsupportedRules,
    });
  }

  return cardResults;
}

/**
 * Greedy optimizer: assigns each transaction to the card with the highest
 * marginal reward while preserving the original transaction facts.
 */
export function greedyOptimize(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
): OptimizationResult {
  const cardPreviousSpending = new Map(
    constraints.cards.map((c) => [c.cardId, c.previousMonthSpending]),
  );
  const assignedTransactionsByCard = new Map<string, CategorizedTransaction[]>();
  for (const rule of cardRules) {
    assignedTransactionsByCard.set(rule.card.id, []);
  }

  // Filter out zero/negative amounts AND NaN/Infinity values (C23-01).
  // NaN > 0 is false so NaN amounts are already excluded by the > 0 check,
  // but Number.isFinite also guards the sort comparator against NaN
  // comparisons which sort inconsistently across JS engines.
  const sortedTransactions = [...constraints.transactions]
    .filter((tx) => tx.amount > 0 && Number.isFinite(tx.amount))
    .sort((a, b) => {
      const amountDiff = b.amount - a.amount;
      if (amountDiff !== 0) return amountDiff;
      // Secondary sort keys for deterministic ordering (C32-V12)
      const merchantDiff = a.merchant.localeCompare(b.merchant);
      if (merchantDiff !== 0) return merchantDiff;
      return a.date.localeCompare(b.date);
    });

  const txAssignments: TxAssignment[] = [];
  const candidateUnsupportedRules: CalculationIssue[] = [];

  for (const transaction of sortedTransactions) {
    const scoring = scoreCardsForTransaction(
      transaction,
      cardRules,
      cardPreviousSpending,
      assignedTransactionsByCard,
    );
    const { scores } = scoring;
    candidateUnsupportedRules.push(...scoring.unsupportedRules);
    const best = scores[0];
    if (!best) continue;

    // On first insertion, create a new array and store it in the map.
    // On subsequent insertions, push in-place — the map already holds the
    // same reference so no .set() is needed (C31-02).
    let currentTransactions = assignedTransactionsByCard.get(best.cardId);
    if (!currentTransactions) {
      currentTransactions = [transaction];
      assignedTransactionsByCard.set(best.cardId, currentTransactions);
    } else {
      currentTransactions.push(transaction);
    }

    txAssignments.push({
      tx: transaction,
      assignedCardId: best.cardId,
      assignedCardName: best.cardName,
      reward: best.reward,
      rate: best.rate,
      alternatives: scores.filter((score) => score.cardId !== best.cardId).slice(0, 5),
    });
  }

  const assignments = buildAssignments(txAssignments, constraints.categoryLabels);
  const cardResults = buildCardResults(cardRules, cardPreviousSpending, assignedTransactionsByCard, constraints.categoryLabels);

  const totalReward = cardResults.reduce((sum, cardResult) => sum + cardResult.totalReward, 0);
  const totalSpending = txAssignments.reduce((sum, assignment) => sum + assignment.tx.amount, 0);
  const effectiveRate = totalSpending > 0 ? totalReward / totalSpending : 0;

  let bestSingleCard = { cardId: '', cardName: '', totalReward: 0 };
  for (const rule of cardRules) {
    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const output = calculateCardOutput(sortedTransactions, previousMonthSpending, rule);

    if (output.totalReward > bestSingleCard.totalReward) {
      bestSingleCard = {
        cardId: rule.card.id,
        cardName: getCardName(rule),
        totalReward: output.totalReward,
      };
    }
  }

  const savingsVsSingleCard = totalReward - bestSingleCard.totalReward;
  const unsupportedRules = deduplicateCalculationIssues([
    ...candidateUnsupportedRules,
    ...cardResults.flatMap((result) => result.unsupportedRules ?? []),
  ]);

  return {
    assignments,
    totalReward,
    totalSpending,
    effectiveRate,
    savingsVsSingleCard,
    bestSingleCard,
    cardResults,
    unsupportedRules,
  };
}
