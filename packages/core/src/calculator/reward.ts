import type { RewardRule, RewardTierRate, PerformanceTier } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../models/transaction.js';
import type { CategoryReward, CapInfo } from '../models/result.js';
import type { CalculationInput, CalculationOutput } from './types.js';
import { calculateDiscount } from './discount.js';
import { calculatePoints } from './points.js';
import { calculateCashback } from './cashback.js';

function selectTier(
  performanceTiers: PerformanceTier[],
  previousMonthSpending: number,
): PerformanceTier | undefined {
  // Find the highest tier the user qualifies for
  const qualifying = performanceTiers.filter(
    (t) =>
      previousMonthSpending >= t.minSpending &&
      (t.maxSpending === null || previousMonthSpending <= t.maxSpending),
  );
  if (qualifying.length === 0) return undefined;
  // Return the tier with the highest minSpending (most beneficial)
  return qualifying.reduce((best, t) => (t.minSpending > best.minSpending ? t : best));
}

function findTierRate(rule: RewardRule, tierId: string): RewardTierRate | undefined {
  return rule.tiers.find((t) => t.performanceTier === tierId);
}

function groupByCategory(
  transactions: CategorizedTransaction[],
): Map<string, CategorizedTransaction[]> {
  const map = new Map<string, CategorizedTransaction[]>();
  for (const tx of transactions) {
    const key = tx.category;
    const existing = map.get(key);
    if (existing) {
      existing.push(tx);
    } else {
      map.set(key, [tx]);
    }
  }
  return map;
}

function findRule(rules: RewardRule[], category: string): RewardRule | undefined {
  // Exact match first, then wildcard '*'
  return rules.find((r) => r.category === category) ?? rules.find((r) => r.category === '*');
}

type RewardCalcFn = (
  amount: number,
  rate: number,
  monthlyCap: number | null,
  currentMonthUsed: number,
) => { reward: number; newMonthUsed: number; capReached: boolean };

function getCalcFn(type: string): RewardCalcFn {
  switch (type) {
    case 'discount':
      return calculateDiscount;
    case 'points':
      return calculatePoints;
    case 'cashback':
      return calculateCashback;
    case 'mileage':
      // Mileage calculated same as points (Won-equivalent)
      return calculatePoints;
    default:
      return calculateDiscount;
  }
}

export function calculateRewards(input: CalculationInput): CalculationOutput {
  const { transactions, previousMonthSpending, cardRule } = input;
  const { card, performanceTiers, rewards: rewardRules, globalConstraints } = cardRule;

  // 1. Determine performance tier
  const tier = selectTier(performanceTiers, previousMonthSpending);
  const tierId = tier?.id ?? 'none';

  // 2. Group transactions by category
  const byCategory = groupByCategory(transactions);

  // 3. Track monthly caps per category and global
  const categoryMonthUsed = new Map<string, number>();
  let globalMonthUsed = 0;
  const globalCap = globalConstraints.monthlyTotalDiscountCap;

  const categoryRewards: CategoryReward[] = [];
  const capsHit: CapInfo[] = [];

  for (const [category, txList] of byCategory) {
    const rule = findRule(rewardRules, category);
    if (!rule || tierId === 'none') {
      // No rule or no qualifying tier — zero reward for this category
      const spending = txList.reduce((s, t) => s + t.amount, 0);
      categoryRewards.push({
        category,
        categoryNameKo: category,
        spending,
        reward: 0,
        rate: 0,
        rewardType: 'discount',
        capReached: false,
      });
      continue;
    }

    const tierRate = findTierRate(rule, tierId);
    if (!tierRate) {
      const spending = txList.reduce((s, t) => s + t.amount, 0);
      categoryRewards.push({
        category,
        categoryNameKo: category,
        spending,
        reward: 0,
        rate: 0,
        rewardType: rule.type,
        capReached: false,
      });
      continue;
    }

    const calcFn = getCalcFn(rule.type);
    const monthlyCap = tierRate.monthlyCap;
    const perTxCap = tierRate.perTransactionCap;

    let catMonthUsed = categoryMonthUsed.get(category) ?? 0;
    let categoryTotalReward = 0;
    let categoryTotalSpending = 0;
    let catCapReached = false;

    for (const tx of txList) {
      // Check conditions
      if (rule.conditions?.minTransaction !== undefined && tx.amount < rule.conditions.minTransaction) {
        continue;
      }
      if (rule.conditions?.excludeOnline && tx.isOnline) {
        continue;
      }
      if (
        rule.conditions?.specificMerchants &&
        rule.conditions.specificMerchants.length > 0 &&
        !rule.conditions.specificMerchants.some((m) => tx.merchant.includes(m))
      ) {
        continue;
      }

      categoryTotalSpending += tx.amount;

      // Per-transaction cap: limit the amount that earns reward per transaction
      const effectiveAmount = perTxCap !== null ? Math.min(tx.amount, perTxCap) : tx.amount;

      // Category monthly cap
      const catResult = calcFn(effectiveAmount, tierRate.rate, monthlyCap, catMonthUsed);
      catMonthUsed = catResult.newMonthUsed;
      if (catResult.capReached) catCapReached = true;

      // Global monthly cap
      if (globalCap !== null) {
        const globalRemaining = Math.max(0, globalCap - globalMonthUsed);
        const globalCapped = Math.min(catResult.reward, globalRemaining);
        if (catResult.reward > globalRemaining) {
          // Global cap hit
          capsHit.push({
            category,
            capType: 'monthly_total',
            capAmount: globalCap,
            actualReward: catResult.reward,
            appliedReward: globalCapped,
          });
        }
        globalMonthUsed += globalCapped;
        categoryTotalReward += globalCapped;
      } else {
        categoryTotalReward += catResult.reward;
      }
    }

    categoryMonthUsed.set(category, catMonthUsed);

    if (catCapReached && monthlyCap !== null) {
      capsHit.push({
        category,
        capType: 'monthly_category',
        capAmount: monthlyCap,
        actualReward: categoryTotalReward + (catMonthUsed - (categoryMonthUsed.get(category) ?? 0)),
        appliedReward: categoryTotalReward,
      });
    }

    const effectiveRate =
      categoryTotalSpending > 0 ? categoryTotalReward / categoryTotalSpending : 0;

    categoryRewards.push({
      category,
      categoryNameKo: category,
      spending: categoryTotalSpending,
      reward: categoryTotalReward,
      rate: effectiveRate,
      rewardType: rule.type,
      capReached: catCapReached,
      capAmount: monthlyCap ?? undefined,
    });
  }

  const totalReward = categoryRewards.reduce((s, c) => s + c.reward, 0);
  const totalSpending = categoryRewards.reduce((s, c) => s + c.spending, 0);

  return {
    cardId: card.id,
    performanceTier: tierId,
    rewards: categoryRewards,
    totalReward,
    totalSpending,
    capsHit,
  };
}
