import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../models/transaction.js';
import type { OptimizationResult, CardAssignment, CardRewardResult, CategoryReward, CapInfo } from '../models/result.js';
import type { OptimizationConstraints } from './constraints.js';
import { calculateRewards, buildCategoryKey } from '../calculator/reward.js';

export const CATEGORY_NAMES_KO: Record<string, string> = {
  // Parent categories
  dining: '외식',
  restaurant: '음식점',
  cafe: '카페',
  fast_food: '패스트푸드',
  delivery: '배달',
  grocery: '식료품',
  supermarket: '대형마트',
  traditional_market: '전통시장',
  online_grocery: '온라인장보기',
  convenience_store: '편의점',
  online_shopping: '온라인쇼핑',
  offline_shopping: '오프라인쇼핑',
  department_store: '백화점',
  fashion: '패션',
  public_transit: '대중교통',
  subway: '지하철',
  bus: '버스',
  taxi: '택시',
  transportation: '교통',
  fuel: '주유',
  parking: '주차',
  toll: '통행료',
  telecom: '통신',
  insurance: '보험',
  medical: '의료',
  hospital: '병원',
  pharmacy: '약국',
  education: '교육',
  academy: '학원',
  books: '도서',
  entertainment: '엔터테인먼트',
  movie: '영화',
  streaming: '스트리밍',
  subscription: '구독',
  travel: '여행',
  hotel: '숙박',
  airline: '항공',
  utilities: '공과금',
  electricity: '전기',
  gas: '가스',
  water: '수도',
  uncategorized: '미분류',

  // Subcategory keys (dot notation) — fallback for CLI/standalone usage
  // when categoryLabels Map is not provided
  'dining.cafe': '카페',
  'dining.restaurant': '음식점',
  'dining.fast_food': '패스트푸드',
  'dining.delivery': '배달',
  'grocery.supermarket': '대형마트',
  'grocery.traditional_market': '전통시장',
  'grocery.online_grocery': '온라인장보기',
  'grocery.convenience_store': '편의점',
  'online_shopping.fashion': '패션',
  'offline_shopping.department_store': '백화점',
  'public_transit.subway': '지하철',
  'public_transit.bus': '버스',
  'public_transit.taxi': '택시',
  'transportation.fuel': '주유',
  'transportation.parking': '주차',
  'transportation.toll': '통행료',
  'medical.hospital': '병원',
  'medical.pharmacy': '약국',
  'education.academy': '학원',
  'education.books': '도서',
  'entertainment.movie': '영화',
  'entertainment.streaming': '스트리밍',
  'entertainment.subscription': '구독',
  'travel.hotel': '숙박',
  'travel.airline': '항공',
  'utilities.electricity': '전기',
  'utilities.gas': '가스',
  'utilities.water': '수도',
};

interface CardScore {
  cardId: string;
  cardName: string;
  reward: number;
  rate: number;
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
): CardScore[] {
  const scores: CardScore[] = [];

  for (const rule of cardRules) {
    const currentTransactions = assignedTransactionsByCard.get(rule.card.id) ?? [];
    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;

    const before = calculateCardOutput(currentTransactions, previousMonthSpending, rule).totalReward;
    const after = calculateCardOutput([...currentTransactions, transaction], previousMonthSpending, rule).totalReward;
    const reward = Math.max(0, after - before);
    const rate = transaction.amount > 0 ? reward / transaction.amount : 0;

    scores.push({
      cardId: rule.card.id,
      cardName: getCardName(rule),
      reward,
      rate,
    });
  }

  return scores.sort((a, b) => b.reward - a.reward);
}

function buildAssignments(txAssignments: TxAssignment[], categoryLabels?: Map<string, string>): CardAssignment[] {
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
        categoryNameKo: categoryLabels?.get(categoryKey) ?? categoryLabels?.get(assignment.tx.category) ?? CATEGORY_NAMES_KO[categoryKey] ?? CATEGORY_NAMES_KO[assignment.tx.category] ?? categoryKey,
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
  categoryLabels?: Map<string, string>,
): CardRewardResult[] {
  const cardResults: CardRewardResult[] = [];

  for (const rule of cardRules) {
    const assignedTransactions = assignedTransactionsByCard.get(rule.card.id) ?? [];
    if (assignedTransactions.length === 0) continue;

    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const output = calculateCardOutput(assignedTransactions, previousMonthSpending, rule);
    const totalSpending = assignedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    // Replace English categoryKey in categoryNameKo with the Korean label
    // from the taxonomy (if available). calculateRewards sets categoryNameKo
    // to the raw categoryKey (e.g. "dining.cafe"); we want "카페" instead.
    const byCategory: CategoryReward[] = output.rewards.map(r => ({
      ...r,
      categoryNameKo: categoryLabels?.get(r.category) ?? CATEGORY_NAMES_KO[r.category] ?? r.categoryNameKo,
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
    .sort((a, b) => b.amount - a.amount);

  const txAssignments: TxAssignment[] = [];

  for (const transaction of sortedTransactions) {
    const scores = scoreCardsForTransaction(
      transaction,
      cardRules,
      cardPreviousSpending,
      assignedTransactionsByCard,
    );
    const best = scores[0];
    if (!best) continue;

    // Mutation contract: assignedTransactionsByCard stores arrays that are
    // mutated in-place via push. The .set() call is redundant on cache hit
    // (same reference) but needed when the Map returns a new empty array.
    const currentTransactions = assignedTransactionsByCard.get(best.cardId) ?? [];
    currentTransactions.push(transaction);
    assignedTransactionsByCard.set(best.cardId, currentTransactions);

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

  return {
    assignments,
    totalReward,
    totalSpending,
    effectiveRate,
    savingsVsSingleCard,
    bestSingleCard,
    cardResults,
  };
}
