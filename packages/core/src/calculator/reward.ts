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

function buildCategoryKey(category: string, subcategory?: string): string {
  return subcategory ? `${category}.${subcategory}` : category;
}

function buildRuleKey(rule: RewardRule): string {
  return buildCategoryKey(rule.category, rule.subcategory);
}

function ruleConditionsMatch(rule: RewardRule, tx: CategorizedTransaction): boolean {
  if (rule.conditions?.minTransaction !== undefined && tx.amount < rule.conditions.minTransaction) {
    return false;
  }
  if (rule.conditions?.excludeOnline && tx.isOnline) {
    return false;
  }
  if (
    rule.conditions?.specificMerchants &&
    rule.conditions.specificMerchants.length > 0 &&
    !rule.conditions.specificMerchants.some((merchant) => tx.merchant.includes(merchant))
  ) {
    return false;
  }
  return true;
}

function ruleSpecificity(rule: RewardRule): number {
  let score = 0;
  if (rule.category !== '*') score += 100;
  if (rule.subcategory) score += 50;
  if (rule.conditions?.specificMerchants?.length) score += 25;
  if (rule.conditions?.excludeOnline) score += 10;
  if (rule.conditions?.minTransaction !== undefined) score += 5;
  return score;
}

function findRule(rules: RewardRule[], tx: CategorizedTransaction): RewardRule | undefined {
  const candidates = rules.filter((rule) => {
    if (rule.category !== '*' && rule.category !== tx.category) return false;
    if (rule.subcategory && rule.subcategory !== tx.subcategory) return false;
    if (!tx.subcategory && rule.subcategory) return false;
    return ruleConditionsMatch(rule, tx);
  });

  if (candidates.length === 0) return undefined;

  return candidates.sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a))[0];
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

function normalizeRate(ruleType: string, rate: number | null): number | null {
  if (rate === null) return null;
  // All YAML rates are stored in percentage form (e.g., 1.5 means 1.5%)
  return rate / 100;
}

function applyMonthlyCap(
  rawReward: number,
  monthlyCap: number | null,
  currentMonthUsed: number,
): { reward: number; newMonthUsed: number; capReached: boolean } {
  if (monthlyCap === null) {
    return { reward: rawReward, newMonthUsed: currentMonthUsed + rawReward, capReached: false };
  }

  const remaining = Math.max(0, monthlyCap - currentMonthUsed);
  const reward = Math.min(rawReward, remaining);
  return {
    reward,
    newMonthUsed: currentMonthUsed + reward,
    capReached: rawReward > remaining,
  };
}

function calculateFixedReward(
  tx: CategorizedTransaction,
  tierRate: RewardTierRate,
  ruleKey: string,
  dayRewardTracker: Set<string>,
): number {
  const fixedAmount = tierRate.fixedAmount ?? 0;
  if (fixedAmount <= 0) return 0;

  if (tierRate.unit === 'won_per_day') {
    const dayKey = `${ruleKey}:${tx.date}`;
    if (dayRewardTracker.has(dayKey)) return 0;
    dayRewardTracker.add(dayKey);
    return fixedAmount;
  }

  if (tierRate.unit === 'mile_per_1500won') {
    return Math.floor(tx.amount / 1500) * fixedAmount;
  }

  if (tierRate.unit === null || tierRate.unit === undefined) {
    return fixedAmount;
  }

  // Do not fabricate unit-based reward quantities from missing transaction metadata.
  // These rewards stay unsupported until the transaction model carries the relevant
  // volume / accrual basis explicitly.
  return 0;
}

export function calculateRewards(input: CalculationInput): CalculationOutput {
  const { transactions, previousMonthSpending, cardRule } = input;
  const { card, performanceTiers, rewards: rewardRules, globalConstraints } = cardRule;

  // 1. Determine performance tier
  const tier = selectTier(performanceTiers, previousMonthSpending);
  const tierId = tier?.id ?? 'none';

  // 2. Track monthly caps per rule and global while accumulating per-category outputs
  const ruleMonthUsed = new Map<string, number>();
  const dayRewardTracker = new Set<string>();
  let globalMonthUsed = 0;
  const globalCap = globalConstraints.monthlyTotalDiscountCap;

  const categoryRewards = new Map<string, CategoryReward>();
  const capsHit: CapInfo[] = [];

  for (const tx of transactions) {
    const categoryKey = buildCategoryKey(tx.category, tx.subcategory);
    const rule = tierId === 'none' ? undefined : findRule(rewardRules, tx);
    const rewardKey = rule ? buildRuleKey(rule) : categoryKey;
    const bucket =
      categoryRewards.get(categoryKey) ??
      {
        category: categoryKey,
        categoryNameKo: categoryKey,
        spending: 0,
        reward: 0,
        rate: 0,
        rewardType: rule?.type ?? 'discount',
        capReached: false,
      };

    bucket.spending += tx.amount;

    if (!rule) {
      categoryRewards.set(categoryKey, bucket);
      continue;
    }

    const tierRate = findTierRate(rule, tierId);
    if (!tierRate) {
      bucket.rewardType = rule.type;
      categoryRewards.set(categoryKey, bucket);
      continue;
    }

    const normalizedRate = normalizeRate(rule.type, tierRate.rate);
    const perTxCap = tierRate.perTransactionCap;
    const monthlyCap = tierRate.monthlyCap;
    const currentRuleMonthUsed = ruleMonthUsed.get(rewardKey) ?? 0;

    let rawReward = 0;
    let ruleResult: { reward: number; newMonthUsed: number; capReached: boolean };
    const hasFixedReward = (tierRate.fixedAmount ?? 0) > 0;
    if (normalizedRate !== null && normalizedRate > 0) {
      const calcFn = getCalcFn(rule.type);
      const effectiveAmount = perTxCap !== null ? Math.min(tx.amount, perTxCap) : tx.amount;
      rawReward = calcFn(effectiveAmount, normalizedRate, null, 0).reward;
      ruleResult = applyMonthlyCap(rawReward, monthlyCap, currentRuleMonthUsed);
    } else if (hasFixedReward) {
      rawReward = calculateFixedReward(tx, tierRate, rewardKey, dayRewardTracker);
      const effectiveFixedReward = perTxCap !== null ? Math.min(rawReward, perTxCap) : rawReward;
      rawReward = effectiveFixedReward;
      ruleResult = applyMonthlyCap(rawReward, monthlyCap, currentRuleMonthUsed);
    } else {
      rawReward = 0;
      ruleResult = applyMonthlyCap(0, monthlyCap, currentRuleMonthUsed);
    }

    ruleMonthUsed.set(rewardKey, ruleResult.newMonthUsed);
    if (ruleResult.capReached) {
      bucket.capReached = true;
    }

    const rewardAfterMonthlyCap = ruleResult.reward;
    let appliedReward = rewardAfterMonthlyCap;
    if (globalCap !== null) {
      const globalRemaining = Math.max(0, globalCap - globalMonthUsed);
      appliedReward = Math.min(rewardAfterMonthlyCap, globalRemaining);
      if (rewardAfterMonthlyCap > globalRemaining) {
        capsHit.push({
          category: categoryKey,
          capType: 'monthly_total',
          capAmount: globalCap,
          actualReward: rewardAfterMonthlyCap,
          appliedReward,
        });
        // Sync ruleMonthUsed to reflect actual applied amount so subsequent
        // transactions aren't under-rewarded at the rule level
        const overcount = rewardAfterMonthlyCap - appliedReward;
        ruleMonthUsed.set(rewardKey, ruleResult.newMonthUsed - overcount);
      }
      globalMonthUsed += appliedReward;
    }

    bucket.reward += appliedReward;
    bucket.rewardType = rule.type;
    bucket.capAmount = monthlyCap ?? undefined;

    if (ruleResult.capReached && monthlyCap !== null) {
      capsHit.push({
        category: categoryKey,
        capType: 'monthly_category',
        capAmount: monthlyCap,
        actualReward: rawReward,
        appliedReward: rewardAfterMonthlyCap,
      });
    }

    categoryRewards.set(categoryKey, bucket);
  }

  const categoryRewardList = [...categoryRewards.values()].map((bucket) => ({
    ...bucket,
    rate: bucket.spending > 0 ? bucket.reward / bucket.spending : 0,
  }));

  const totalReward = categoryRewardList.reduce((sum, categoryReward) => sum + categoryReward.reward, 0);
  const totalSpending = categoryRewardList.reduce((sum, categoryReward) => sum + categoryReward.spending, 0);

  return {
    cardId: card.id,
    performanceTier: tierId,
    rewards: categoryRewardList,
    totalReward,
    totalSpending,
    capsHit,
  };
}
