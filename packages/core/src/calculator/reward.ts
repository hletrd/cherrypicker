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

export function buildCategoryKey(category: string, subcategory?: string): string {
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
    // Broad category rules (no subcategory) should not match transactions
    // that have a subcategory — Korean card terms typically exclude
    // subcategories like cafe from the broader dining category.
    //
    // Rationale: In Korean credit card reward structures, a "dining 5%"
    // rule usually does NOT cover cafe subcategory transactions; cafe
    // gets its own separate rule (possibly with a different rate). If we
    // allowed broad rules to match subcategorized transactions, the
    // optimizer would over-count rewards for those transactions.
    //
    // TODO: If a future card's terms explicitly include subcategories
    // under a broad category rule, add an `includeSubcategories: true`
    // field to the RewardRule schema and check it here before skipping.
    if (tx.subcategory && !rule.subcategory && rule.category !== '*') return false;
    return ruleConditionsMatch(rule, tx);
  });

  if (candidates.length === 0) return undefined;

  // Secondary sort by index ensures deterministic ordering when two rules
  // have equal specificity. Without this, Array.sort is not guaranteed
  // stable across JS engines, causing non-deterministic rule selection (C1-12).
  return candidates.sort((a, b) => {
    const diff = ruleSpecificity(b) - ruleSpecificity(a);
    if (diff !== 0) return diff;
    return rules.indexOf(a) - rules.indexOf(b);
  })[0];
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
  // All YAML rates are stored in percentage form (e.g., 1.5 means 1.5%).
  // For mileage rules, the rate represents Won-equivalent percentage return
  // rather than literal "miles per 1,500 Won". For example, rate: 1.0 means
  // "1% Won-equivalent return as mileage value" which yields ~15 Won per
  // 1,500 Won transaction (approximately 1 mile at ~15 Won/mile valuation).
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

  if (tierRate.unit === 'won_per_liter') {
    // Transaction model doesn't carry fuel volume, so apply fixedAmount
    // as a per-transaction discount — matches per-transaction display
    // in Korean card apps for fuel discounts.
    return fixedAmount;
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

  // Warn when the card has performance tiers but none matched — this means
  // the user's previousMonthSpending is below the lowest tier's threshold
  // and all rewards will be 0. This is most likely to affect CLI/standalone
  // usage where previousMonthSpending defaults to 0.
  if (tierId === 'none' && performanceTiers.length > 0) {
    const minRequired = performanceTiers.reduce(
      (min, t) => Math.min(min, t.minSpending),
      Infinity,
    );
    console.warn(
      `[cherrypicker] No performance tier matched for card "${card.id}" ` +
        `with previousMonthSpending=${previousMonthSpending}. ` +
        `All rewards will be 0. Minimum tier requires ${minRequired} Won.`,
    );
  }

  // 2. Track monthly caps per rule and global while accumulating per-category outputs
  const ruleMonthUsed = new Map<string, number>();
  const dayRewardTracker = new Set<string>();
  let globalMonthUsed = 0;
  const globalCap = globalConstraints.monthlyTotalDiscountCap;

  const categoryRewards = new Map<string, CategoryReward>();
  const capsHit: CapInfo[] = [];

  // Track cumulative reward per rewardType within each category bucket,
  // so the dominant type (highest cumulative reward) is reported rather
  // than the type of the last transaction processed.
  const rewardTypeAccum = new Map<string, Map<string, number>>();

  for (const tx of transactions) {
    // Skip negative-amount transactions (refunds, reversals)
    if (tx.amount <= 0) continue;
    // Skip non-KRW transactions — reward math assumes Won amounts
    if (tx.currency && tx.currency !== 'KRW') continue;

    const categoryKey = buildCategoryKey(tx.category, tx.subcategory);
    const rule = tierId === 'none' ? undefined : findRule(rewardRules, tx);
    const rewardKey = rule ? buildRuleKey(rule) : categoryKey;
    // Register the bucket in the Map immediately after creation so that it is
    // always present before any mutations. Prior code deferred .set() until
    // later, which worked in JS's single-threaded execution but was fragile
    // during maintenance — a future early return between creation and .set()
    // would leave the bucket unregistered (C8-02).
    let bucket = categoryRewards.get(categoryKey);
    if (!bucket) {
      bucket = {
        category: categoryKey,
        categoryNameKo: categoryKey,
        spending: 0,
        reward: 0,
        rate: 0,
        rewardType: rule?.type ?? 'none',
        capReached: false,
      };
      categoryRewards.set(categoryKey, bucket);
    }

    bucket.spending += tx.amount;

    if (!rule) {
      continue;
    }

    const tierRate = findTierRate(rule, tierId);
    if (!tierRate) {
      bucket.rewardType = rule.type;
      continue;
    }

    const normalizedRate = normalizeRate(rule.type, tierRate.rate);
    const perTxCap = tierRate.perTransactionCap;
    const monthlyCap = tierRate.monthlyCap;
    const currentRuleMonthUsed = ruleMonthUsed.get(rewardKey) ?? 0;

    let rawReward = 0;
    let ruleResult: { reward: number; newMonthUsed: number; capReached: boolean };
    const hasFixedReward = (tierRate.fixedAmount ?? 0) > 0;
    if (normalizedRate !== null && normalizedRate > 0 && hasFixedReward) {
      // Both rate and fixedAmount are present on the same tier — this is
      // unusual for Korean card rules (none of the current 81 YAML files
      // use both). Warn and use rate-based reward as the primary, since
      // the if/else structure can only apply one. Future schema-level
      // enforcement should make these mutually exclusive.
      console.warn(
        `[cherrypicker] Rule for "${buildRuleKey(rule)}" tier "${tierId}" has both rate (${tierRate.rate}) ` +
        `and fixedAmount (${tierRate.fixedAmount}) — using rate-based reward only. ` +
        `Make rate and fixedAmount mutually exclusive in the YAML.`
      );
      const calcFn = getCalcFn(rule.type);
      const effectiveAmount = perTxCap !== null ? Math.min(tx.amount, perTxCap) : tx.amount;
      rawReward = calcFn(effectiveAmount, normalizedRate, null, 0).reward;
      ruleResult = applyMonthlyCap(rawReward, monthlyCap, currentRuleMonthUsed);
    } else if (normalizedRate !== null && normalizedRate > 0) {
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
      // Rule has neither rate nor fixed amount — likely a misconfiguration
      if (rule.category !== '*') {
        console.warn(`[cherrypicker] Rule for "${buildRuleKey(rule)}" tier "${tierId}" has no rate or fixedAmount — producing 0 reward`);
      }
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
        // When the global cap clips a reward, the rule-level tracker was
        // advanced by the full pre-clip amount (rewardAfterMonthlyCap).
        // We must roll it back to reflect only what was actually applied,
        // so subsequent transactions see the correct remaining rule-level
        // cap relative to the global constraint.
        const overcount = rewardAfterMonthlyCap - appliedReward;
        ruleMonthUsed.set(rewardKey, ruleResult.newMonthUsed - overcount);
      }
      globalMonthUsed += appliedReward;
    }

    bucket.reward += appliedReward;
    // Accumulate reward per rewardType so we can determine the dominant
    // type (highest cumulative reward) at the end of the loop, rather than
    // unconditionally overwriting with the last transaction's type.
    const typeMap = rewardTypeAccum.get(categoryKey) ?? new Map<string, number>();
    typeMap.set(rule.type, (typeMap.get(rule.type) ?? 0) + appliedReward);
    rewardTypeAccum.set(categoryKey, typeMap);
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
    // No need for categoryRewards.set() here — the bucket was registered
    // immediately after creation and mutations are reflected by reference (C8-02).
  }

  const categoryRewardList = [...categoryRewards.values()].map((bucket) => {
    // Determine the dominant rewardType for this category — the type that
    // contributed the most cumulative reward, not just the last one seen.
    const typeMap = rewardTypeAccum.get(bucket.category);
    let dominantType = bucket.rewardType;
    if (typeMap && typeMap.size > 0) {
      let bestAmount = -1;
      for (const [type, amount] of typeMap) {
        if (amount > bestAmount) {
          bestAmount = amount;
          dominantType = type;
        }
      }
    }
    return {
      ...bucket,
      rewardType: dominantType,
      rate: bucket.spending > 0 ? bucket.reward / bucket.spending : 0,
    };
  });

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
