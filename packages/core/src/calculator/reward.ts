import type { RewardRule, RewardTierRate, PerformanceTier } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../models/transaction.js';
import type { CategoryReward, CapInfo } from '../models/result.js';
import type {
  CalculationInput,
  CalculationOutput,
  SkippedTransaction,
  UnsupportedReason,
  UnsupportedRule,
} from './types.js';
import { calculateDiscount } from './discount.js';
import { calculatePoints } from './points.js';
import { calculateCashback } from './cashback.js';
import { normalizeMerchantText } from '../categorizer/normalize.js';

function selectTier(
  performanceTiers: PerformanceTier[],
  previousMonthSpending: number,
): PerformanceTier | undefined {
  // Guard against out-of-order tiers — sort ascending by minSpending so
  // that filtering and reduce behave deterministically regardless of
  // YAML authoring order.
  const sortedTiers = performanceTiers.length > 1
    ? [...performanceTiers].sort((a, b) => a.minSpending - b.minSpending)
    : performanceTiers;
  // Find the highest tier the user qualifies for
  const qualifying = sortedTiers.filter(
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

function buildRuleKey(rule: RewardRule, ruleIndex: number): string {
  return rule.capGroup ?? rule.id ?? `${buildCategoryKey(rule.category, rule.subcategory)}#${ruleIndex}`;
}

interface ConditionResult {
  status: 'match' | 'miss' | 'unsupported';
  reason?: UnsupportedReason;
  detail?: string;
  occurrenceKey?: string;
}

const RESTRICTION_NOTE_PATTERN =
  /(월\s*\d+\s*회|일\s*\d+\s*회|주중|주말|요일|오프라인|온라인\s*(?:제외|전용)|자동이체|결제계좌|택\s*1|건당|회당|시간대)/;

function isValidIsoDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function ruleConditionsMatch(
  rule: RewardRule,
  tx: CategorizedTransaction,
  ruleId: string,
  occurrenceUses: Map<string, number>,
): ConditionResult {
  if (rule.support?.status === 'unsupported') {
    return {
      status: 'unsupported',
      reason: 'rule_marked_unsupported',
      detail: rule.support.reason,
    };
  }
  if (
    rule.support?.status !== 'supported' &&
    rule.conditions?.note &&
    RESTRICTION_NOTE_PATTERN.test(rule.conditions.note)
  ) {
    return {
      status: 'unsupported',
      reason: 'restriction_in_note',
      detail: rule.conditions.note,
    };
  }
  if (rule.conditions?.minTransaction !== undefined && tx.amount < rule.conditions.minTransaction) {
    return { status: 'miss' };
  }
  if (rule.conditions?.maxTransaction !== undefined && tx.amount > rule.conditions.maxTransaction) {
    return { status: 'miss' };
  }
  if (rule.conditions?.paymentType) {
    if (!tx.paymentType) {
      return { status: 'unsupported', reason: 'missing_payment_type' };
    }
    if (tx.paymentType !== rule.conditions.paymentType) return { status: 'miss' };
  }
  if (rule.conditions?.channel) {
    if (!tx.channel) {
      return { status: 'unsupported', reason: 'missing_channel' };
    }
    if (tx.channel !== rule.conditions.channel) return { status: 'miss' };
  }
  if (rule.conditions?.weekdays) {
    if (!isValidIsoDate(tx.date)) {
      return {
        status: 'unsupported',
        reason: 'missing_occurrence_context',
        detail: 'weekday condition requires a valid ISO transaction date',
      };
    }
    const weekday = new Date(`${tx.date}T00:00:00Z`).getUTCDay();
    if (!rule.conditions.weekdays.includes(weekday)) return { status: 'miss' };
  }
  if (rule.conditions?.maxUses !== undefined && rule.conditions.usePeriod) {
    if (!isValidIsoDate(tx.date)) {
      return {
        status: 'unsupported',
        reason: 'missing_occurrence_context',
        detail: 'occurrence condition requires a valid ISO transaction date',
      };
    }
    const period = rule.conditions.usePeriod === 'day' ? tx.date : tx.date.slice(0, 7);
    const occurrenceKey = `${ruleId}:${period}`;
    if ((occurrenceUses.get(occurrenceKey) ?? 0) >= rule.conditions.maxUses) {
      return { status: 'miss' };
    }
    return { status: 'match', occurrenceKey };
  }
  return { status: 'match' };
}

function merchantAllowlistMatches(
  merchant: string,
  allowlist: readonly string[],
): boolean {
  const normalizedMerchant = normalizeMerchantText(merchant);
  return allowlist.some((candidate) => {
    const normalizedCandidate = normalizeMerchantText(candidate);
    return (
      normalizedCandidate.length > 0 &&
      normalizedMerchant.includes(normalizedCandidate)
    );
  });
}

function ruleSpecificity(rule: RewardRule): number {
  let score = 0;
  if (rule.category !== '*') score += 100;
  if (rule.subcategory) score += 50;
  // An explicit merchant allowlist is a stronger identifier than an inferred
  // category. It also keeps merchant-authored benefits reachable when a
  // statement categorizer assigns the merchant to a different valid vertical.
  if (rule.conditions?.specificMerchants?.length) score += 1000;
  if (rule.conditions?.paymentType || rule.conditions?.channel) score += 10;
  if (rule.conditions?.minTransaction !== undefined) score += 5;
  if (rule.conditions?.maxTransaction !== undefined) score += 5;
  return score;
}

interface SelectedRule {
  rule: RewardRule;
  ruleIndex: number;
  occurrenceKey?: string;
}

interface RuleSelection {
  rules: SelectedRule[];
  unsupported: UnsupportedRule[];
}

function compareRuleCandidates(
  a: SelectedRule,
  b: SelectedRule,
): number {
  const diff = ruleSpecificity(b.rule) - ruleSpecificity(a.rule);
  if (diff !== 0) return diff;
  const priorityDiff = (b.rule.priority ?? 0) - (a.rule.priority ?? 0);
  if (priorityDiff !== 0) return priorityDiff;
  const idDiff = (a.rule.id ?? '').localeCompare(b.rule.id ?? '');
  if (idDiff !== 0) return idDiff;
  return a.ruleIndex - b.ruleIndex;
}

function findRules(
  cardId: string,
  rules: RewardRule[],
  tx: CategorizedTransaction,
  occurrenceUses: Map<string, number>,
): RuleSelection {
  const candidates: SelectedRule[] = [];
  const unsupported: UnsupportedRule[] = [];

  for (const [ruleIndex, rule] of rules.entries()) {
    const hasMerchantAllowlist = (rule.conditions?.specificMerchants?.length ?? 0) > 0;
    if (hasMerchantAllowlist) {
      if (
        !merchantAllowlistMatches(
          tx.merchant,
          rule.conditions?.specificMerchants ?? [],
        )
      ) {
        continue;
      }
    } else {
      if (rule.category !== '*' && rule.category !== tx.category) continue;
      if (rule.subcategory && rule.subcategory !== tx.subcategory) continue;
      if (!tx.subcategory && rule.subcategory) continue;
    }

    const ruleId = rule.id ?? `${buildCategoryKey(rule.category, rule.subcategory)}#${ruleIndex}`;
    const condition = ruleConditionsMatch(rule, tx, ruleId, occurrenceUses);
    if (condition.status === 'unsupported') {
      unsupported.push({
        cardId,
        transactionId: tx.id,
        ruleId,
        category: buildCategoryKey(rule.category, rule.subcategory),
        reason: condition.reason ?? 'rule_marked_unsupported',
        detail: condition.detail,
      });
      continue;
    }
    if (condition.status === 'match') {
      candidates.push({ rule, ruleIndex, occurrenceKey: condition.occurrenceKey });
    }
  }

  if (candidates.length === 0) return { rules: [], unsupported };

  const groups = new Map<string, SelectedRule[]>();
  for (const candidate of candidates) {
    const group = candidate.rule.stackingGroup ?? '__default__';
    const members = groups.get(group) ?? [];
    members.push(candidate);
    groups.set(group, members);
  }

  const selected: SelectedRule[] = [];
  for (const group of [...groups.keys()].sort()) {
    const members = groups.get(group)!;
    const additive = members
      .filter(({ rule }) => rule.combination === 'additive')
      .sort(compareRuleCandidates);
    selected.push(...additive);

    const exclusive = members
      .filter(({ rule }) => rule.combination !== 'additive')
      .sort(compareRuleCandidates);
    if (exclusive[0]) selected.push(exclusive[0]);
  }

  return { rules: selected, unsupported };
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
      throw new Error(`Unknown reward type: ${type}. Expected one of: discount, points, cashback, mileage`);
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
): { reward: number; unsupportedReason?: UnsupportedReason; detail?: string } {
  const fixedAmount = tierRate.fixedAmount ?? 0;
  if (fixedAmount <= 0) return { reward: 0 };

  if (tierRate.unit === 'won_per_day') {
    const dayKey = `${ruleKey}:${tx.date}`;
    if (dayRewardTracker.has(dayKey)) return { reward: 0 };
    dayRewardTracker.add(dayKey);
    return { reward: fixedAmount };
  }

  if (tierRate.unit === 'mile_per_1500won') {
    return { reward: Math.floor(tx.amount / 1500) * fixedAmount };
  }

  if (tierRate.unit === 'won_per_liter') {
    const liters = tx.fuelVolumeLiters;
    if (
      !Number.isFinite(liters) ||
      (liters ?? 0) <= 0 ||
      !tx.factProvenance?.fuelVolumeLiters
    ) {
      return {
        reward: 0,
        unsupportedReason: 'missing_fuel_volume',
        detail: 'fuel-per-liter reward requires positive volume with provenance',
      };
    }
    return { reward: fixedAmount * liters! };
  }

  if (tierRate.unit === null || tierRate.unit === undefined) {
    return { reward: fixedAmount };
  }

  return {
    reward: 0,
    unsupportedReason: 'unsupported_reward_unit',
    detail: `unsupported reward unit: ${String(tierRate.unit)}`,
  };
}

export function calculateRewards(input: CalculationInput): CalculationOutput {
  const { transactions, previousMonthSpending, cardRule } = input;

  // Guard against NaN/Infinity/negative previousMonthSpending which would
  // silently produce zero rewards (no tier matches NaN comparisons) (C39-BUG01).
  if (!Number.isFinite(previousMonthSpending) || previousMonthSpending < 0) {
    throw new Error(
      `previousMonthSpending must be a non-negative finite number, got ${previousMonthSpending}`
    );
  }

  const { card, performanceTiers, rewards: rewardRules, globalConstraints } = cardRule;

  // 1. Determine performance tier
  const tier = selectTier(performanceTiers, previousMonthSpending);
  const tierId = tier?.id ?? 'none';

  // When the card has performance tiers but none matched, the user's
  // previousMonthSpending is below the lowest tier's threshold and all
  // rewards will be 0. This is most likely to affect CLI/standalone usage
  // where previousMonthSpending defaults to 0.
  if (tierId === 'none' && performanceTiers.length > 0) {
    // Intentionally silent — callers should inspect the 'none' tier and
    // zero rewards rather than receiving side-effect console output.
  }

  // 2. Track monthly caps per rule and global while accumulating per-category outputs
  const ruleMonthUsed = new Map<string, number>();
  const dayRewardTracker = new Set<string>();
  const occurrenceUses = new Map<string, number>();
  let globalMonthUsed = 0;
  const globalCap = globalConstraints.monthlyTotalDiscountCap;

  const categoryRewards = new Map<string, CategoryReward>();
  const capsHit: CapInfo[] = [];
  const skippedTransactions: SkippedTransaction[] = [];
  const unsupportedRules: UnsupportedRule[] = [];

  // Track cumulative reward per rewardType within each category bucket,
  // so the dominant type (highest cumulative reward) is reported rather
  // than the type of the last transaction processed.
  const rewardTypeAccum = new Map<string, Map<string, number>>();

  for (const tx of transactions) {
    // Public calculator boundary: statement amounts are Won integers and must
    // be representable exactly. Reject invalid numeric input instead of
    // allowing NaN/Infinity/unsafe integers to corrupt reward totals.
    if (!Number.isFinite(tx.amount) || !Number.isSafeInteger(tx.amount)) {
      throw new Error(
        `transaction amount must be a finite safe integer, got ${tx.amount} for ${tx.id}`,
      );
    }
    // Skip negative-amount transactions (refunds, reversals)
    if (tx.amount <= 0) {
      skippedTransactions.push({ id: tx.id, amount: tx.amount, currency: tx.currency ?? 'KRW', reason: 'negative_amount' });
      continue;
    }
    // Skip non-KRW transactions — reward math assumes Won amounts
    if (tx.currency && tx.currency !== 'KRW') {
      skippedTransactions.push({ id: tx.id, amount: tx.amount, currency: tx.currency, reason: 'non_krw' });
      continue;
    }

    const categoryKey = buildCategoryKey(tx.category, tx.subcategory);
    const selection: RuleSelection = tierId === 'none'
      ? { rules: [], unsupported: [] as UnsupportedRule[] }
      : findRules(card.id, rewardRules, tx, occurrenceUses);
    unsupportedRules.push(...selection.unsupported);
    const firstRule = selection.rules[0]?.rule;
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
        rewardType: firstRule?.type ?? 'none',
        capReached: false,
      };
      categoryRewards.set(categoryKey, bucket);
    }

    bucket.spending += tx.amount;

    if (selection.rules.length === 0) {
      continue;
    }

    for (const selectedRule of selection.rules) {
      const { rule, ruleIndex, occurrenceKey } = selectedRule;
      const rewardKey = buildRuleKey(rule, ruleIndex);
      if (occurrenceKey) {
        occurrenceUses.set(
          occurrenceKey,
          (occurrenceUses.get(occurrenceKey) ?? 0) + 1,
        );
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
    let uncappedReward = 0;
    let ruleResult: { reward: number; newMonthUsed: number; capReached: boolean };
    const hasFixedReward = (tierRate.fixedAmount ?? 0) > 0;
    if (normalizedRate !== null && normalizedRate > 0) {
      if (tierRate.unit !== null && tierRate.unit !== undefined) {
        unsupportedRules.push({
          cardId: card.id,
          transactionId: tx.id,
          ruleId: rule.id ?? rewardKey,
          category: categoryKey,
          reason: 'unsupported_reward_unit',
          detail: `rate-based reward carries unit ${tierRate.unit}`,
        });
        continue;
      }
      const calcFn = getCalcFn(rule.type);
      uncappedReward = calcFn(tx.amount, normalizedRate, null, 0).reward;
      rawReward = perTxCap !== null ? Math.min(uncappedReward, perTxCap) : uncappedReward;
      ruleResult = applyMonthlyCap(rawReward, monthlyCap, currentRuleMonthUsed);
    } else if (hasFixedReward) {
      const fixed = calculateFixedReward(tx, tierRate, rewardKey, dayRewardTracker);
      if (fixed.unsupportedReason) {
        unsupportedRules.push({
          cardId: card.id,
          transactionId: tx.id,
          ruleId: rule.id ?? rewardKey,
          category: categoryKey,
          reason: fixed.unsupportedReason,
          detail: fixed.detail,
        });
        continue;
      }
      uncappedReward = fixed.reward;
      rawReward = perTxCap !== null
        ? Math.min(uncappedReward, perTxCap)
        : uncappedReward;
      ruleResult = applyMonthlyCap(rawReward, monthlyCap, currentRuleMonthUsed);
    } else {
      // Rule has neither rate nor fixed amount — produces 0 reward.
      // Wildcard rules (category === '*') legitimately have no rate.
      rawReward = 0;
      ruleResult = applyMonthlyCap(0, monthlyCap, currentRuleMonthUsed);
    }

    if (perTxCap !== null && uncappedReward > perTxCap) {
      capsHit.push({
        category: categoryKey,
        capType: 'per_transaction',
        capAmount: perTxCap,
        actualReward: uncappedReward,
        appliedReward: rawReward,
      });
      bucket.capReached = true;
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
        bucket.capReached = true;
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
    skippedTransactions,
    unsupportedRules,
  };
}
