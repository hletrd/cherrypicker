import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../models/transaction.js';
import type { OptimizationResult, CardAssignment, CardRewardResult, CategoryReward, CapInfo } from '../models/result.js';
import type { OptimizationConstraints } from './constraints.js';
import { calculateRewards } from '../calculator/reward.js';

const CATEGORY_NAMES_KO: Record<string, string> = {
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
};

interface CategoryCardScore {
  cardId: string;
  cardName: string;
  reward: number;
  rate: number;
}

/**
 * Build synthetic per-category transactions so we can run calculateRewards
 * for a specific category only.
 */
function makeCategoryTransactions(
  category: string,
  spending: number,
): CategorizedTransaction[] {
  return [
    {
      id: `synthetic-${category}`,
      date: new Date().toISOString().slice(0, 10),
      merchant: category,
      amount: spending,
      currency: 'KRW',
      category,
      confidence: 1.0,
    },
  ];
}

/**
 * Score every card for a given category and spending amount.
 */
function scoreCardsForCategory(
  category: string,
  spending: number,
  cardRules: CardRuleSet[],
  cardPreviousSpending: Map<string, number>,
): CategoryCardScore[] {
  const scores: CategoryCardScore[] = [];

  for (const rule of cardRules) {
    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const output = calculateRewards({
      transactions: makeCategoryTransactions(category, spending),
      previousMonthSpending,
      cardRule: rule,
    });

    const categoryResult = output.rewards.find((r) => r.category === category);
    const reward = categoryResult?.reward ?? 0;
    const rate = spending > 0 ? reward / spending : 0;

    scores.push({
      cardId: rule.card.id,
      cardName: rule.card.nameKo || rule.card.name,
      reward,
      rate,
    });
  }

  // Sort descending by reward
  return scores.sort((a, b) => b.reward - a.reward);
}

/**
 * Greedy optimizer: assigns each category to the best card independently.
 * Categories are processed from highest spending to lowest to respect caps.
 */
export function greedyOptimize(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
): OptimizationResult {
  const cardPreviousSpending = new Map(
    constraints.cards.map((c) => [c.cardId, c.previousMonthSpending]),
  );

  // Sort categories by spending descending
  const sortedCategories = [...constraints.categorySpending.entries()].sort(
    (a, b) => b[1] - a[1],
  );

  const assignments: CardAssignment[] = [];

  for (const [category, spending] of sortedCategories) {
    if (spending <= 0) continue;

    const scores = scoreCardsForCategory(category, spending, cardRules, cardPreviousSpending);
    const best = scores[0];
    if (!best) continue;

    const MAX_ALTERNATIVES = 5;
    const alternatives = scores.slice(1, 1 + MAX_ALTERNATIVES).map((s) => ({
      cardId: s.cardId,
      cardName: s.cardName,
      reward: s.reward,
      rate: s.rate,
    }));

    assignments.push({
      category,
      categoryNameKo: CATEGORY_NAMES_KO[category] ?? category,
      assignedCardId: best.cardId,
      assignedCardName: best.cardName,
      spending,
      reward: best.reward,
      rate: best.rate,
      alternatives,
    });
  }

  const totalReward = assignments.reduce((s, a) => s + a.reward, 0);
  const totalSpending = assignments.reduce((s, a) => s + a.spending, 0);
  const effectiveRate = totalSpending > 0 ? totalReward / totalSpending : 0;

  // Build per-card results
  const cardResultMap = new Map<string, { rule: CardRuleSet; categories: CardAssignment[] }>();
  for (const rule of cardRules) {
    cardResultMap.set(rule.card.id, { rule, categories: [] });
  }
  for (const assignment of assignments) {
    const entry = cardResultMap.get(assignment.assignedCardId);
    if (entry) {
      entry.categories.push(assignment);
    }
  }

  const cardResults: CardRewardResult[] = [];
  for (const { rule, categories } of cardResultMap.values()) {
    if (categories.length === 0) continue;
    const cardTotalReward = categories.reduce((s, c) => s + c.reward, 0);
    const cardTotalSpending = categories.reduce((s, c) => s + c.spending, 0);

    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const allTransactions: CategorizedTransaction[] = categories.map((c) =>
      makeCategoryTransactions(c.category, c.spending)[0],
    );
    const output = calculateRewards({
      transactions: allTransactions,
      previousMonthSpending,
      cardRule: rule,
    });

    const byCategory: CategoryReward[] = output.rewards;
    const capsHit: CapInfo[] = output.capsHit;

    cardResults.push({
      cardId: rule.card.id,
      cardName: rule.card.nameKo || rule.card.name,
      totalReward: cardTotalReward,
      totalSpending: cardTotalSpending,
      effectiveRate: cardTotalSpending > 0 ? cardTotalReward / cardTotalSpending : 0,
      byCategory,
      performanceTier: output.performanceTier,
      capsHit,
    });
  }

  // Compute best single-card scenario for comparison
  let bestSingleCard = { cardId: '', cardName: '', totalReward: 0 };
  for (const rule of cardRules) {
    const previousMonthSpending = cardPreviousSpending.get(rule.card.id) ?? 0;
    const allTransactions: CategorizedTransaction[] = sortedCategories
      .filter(([, s]) => s > 0)
      .map(([cat, spending]) => makeCategoryTransactions(cat, spending)[0]);

    const output = calculateRewards({
      transactions: allTransactions,
      previousMonthSpending,
      cardRule: rule,
    });

    if (output.totalReward > bestSingleCard.totalReward) {
      bestSingleCard = {
        cardId: rule.card.id,
        cardName: rule.card.nameKo || rule.card.name,
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
