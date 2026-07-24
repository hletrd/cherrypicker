import type {
  PerformanceTier,
  RewardRule,
  RewardTierRate,
  RewardValue,
} from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../models/transaction.js';
import type {
  CapSuppressionCause,
  CategoryReward,
  CapInfo,
} from '../models/result.js';
import type {
  CalculationInput,
  CalculationOutput,
  SkippedTransaction,
  TransactionCapSuppression,
  UnsupportedReason,
  UnsupportedRule,
} from './types.js';
import {
  normalizedMerchantTermMatches,
  normalizeMerchantText,
} from '../categorizer/normalize.js';
import {
  addSafeNonnegativeIntegers,
  assertSafeNonnegativeInteger,
  floorSafeIntegerDecimalProduct,
} from '../numeric.js';

// Defense-in-depth for direct core callers that bypass the parser-owned
// canonical fact validator. Kept local to avoid reversing core→parser package
// direction; parser/web handoffs remain the source of normalized facts.
const MAX_REWARDABLE_FUEL_VOLUME_LITERS = 200;

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

function assertUniqueRewardTierReferences(rules: RewardRule[]): void {
  rules.forEach((rule, ruleIndex) => {
    const firstTierIndex = new Map<string, number>();
    rule.tiers.forEach((tier, tierIndex) => {
      const firstIndex = firstTierIndex.get(tier.performanceTier);
      if (firstIndex !== undefined) {
        const ruleId = buildRuleExecutionKey(rule, ruleIndex);
        throw new Error(
          `duplicate performance tier reference "${tier.performanceTier}" ` +
          `in reward rule "${ruleId}" at tiers.${tierIndex} ` +
          `(first referenced at tiers.${firstIndex})`,
        );
      }
      firstTierIndex.set(tier.performanceTier, tierIndex);
    });
  });
}

function assertCoherentCapGroupMonthlyCaps(rules: RewardRule[]): void {
  const capGroupDefinitions = new Map<
    string,
    Map<
      string,
      {
        ruleIndex: number;
        tierIndex: number;
        monthlyCap: number | null;
      }
    >
  >();

  rules.forEach((rule, ruleIndex) => {
    if (rule.support?.status === 'unsupported') return;
    const capGroup = buildCapGroupKey(rule, ruleIndex);
    let definitionsByTier = capGroupDefinitions.get(capGroup);
    if (!definitionsByTier) {
      definitionsByTier = new Map();
      capGroupDefinitions.set(capGroup, definitionsByTier);
    }
    rule.tiers.forEach((tier, tierIndex) => {
      const existing = definitionsByTier.get(tier.performanceTier);
      if (!existing) {
        definitionsByTier.set(tier.performanceTier, {
          ruleIndex,
          tierIndex,
          monthlyCap: tier.monthlyCap,
        });
        return;
      }
      // Duplicate tier references are rejected before this coherence check.
      if (
        existing.ruleIndex === ruleIndex ||
        existing.monthlyCap === tier.monthlyCap
      ) {
        return;
      }
      throw new Error(
        `cap group "${capGroup}" defines monthlyCap ` +
        `${String(tier.monthlyCap)} for performance tier ` +
        `"${tier.performanceTier}", but rewards.${existing.ruleIndex}.` +
        `tiers.${existing.tierIndex}.monthlyCap defines ` +
        `${String(existing.monthlyCap)}`,
      );
    });
  });
}

const preparedCardRuleToken = Symbol('prepared-card-rule');

/**
 * Invocation-scoped proof that a card's immutable reward structure passed the
 * calculator's cross-rule validations.
 *
 * This type and its constructors are internal module exports for the optimizer;
 * they are deliberately absent from the public package barrel.
 */
export interface PreparedCardRule {
  readonly cardRule: CalculationInput['cardRule'];
  /** Whether any executable reward can be reduced by a declared cap. */
  readonly hasRewardCap: boolean;
  /** Whether ordered reward selection carries maxUses/fixed-per-day state. */
  readonly hasStatefulReward: boolean;
  readonly [preparedCardRuleToken]: true;
}

function assertValidCardRuleStructure(
  cardRule: CalculationInput['cardRule'],
): void {
  assertUniqueRewardTierReferences(cardRule.rewards);
  assertCoherentCapGroupMonthlyCaps(cardRule.rewards);
}

/** @internal */
export function prepareCardRuleForCalculation(
  cardRule: CalculationInput['cardRule'],
): PreparedCardRule {
  assertValidCardRuleStructure(cardRule);
  let hasRewardCap =
    cardRule.globalConstraints.monthlyTotalDiscountCap !== null;
  let hasStatefulReward = false;
  for (const rule of cardRule.rewards) {
    if (rule.support?.status === 'unsupported') continue;
    if (
      rule.conditions?.maxUses !== undefined &&
      rule.conditions.usePeriod !== undefined
    ) {
      hasStatefulReward = true;
    }
    for (const tier of rule.tiers) {
      if (
        tier.monthlyCap !== null ||
        tier.perTransactionCap !== null
      ) {
        hasRewardCap = true;
      }
      if (
        tier.value?.kind === 'fixed_per_day' ||
        tier.unit === 'won_per_day'
      ) {
        hasStatefulReward = true;
      }
    }
  }
  return Object.freeze({
    cardRule,
    hasRewardCap,
    hasStatefulReward,
    [preparedCardRuleToken]: true as const,
  });
}

export function buildCategoryKey(category: string, subcategory?: string): string {
  return subcategory ? `${category}.${subcategory}` : category;
}

export function isRewardEligibleTransaction(
  transaction: Pick<CategorizedTransaction, 'amount' | 'currency'>,
): boolean {
  return (
    transaction.amount > 0 &&
    (!transaction.currency || transaction.currency === 'KRW')
  );
}

function buildRuleExecutionKey(rule: RewardRule, ruleIndex: number): string {
  return rule.id ??
    `${buildCategoryKey(rule.category, rule.subcategory)}#${ruleIndex}`;
}

function buildCapGroupKey(rule: RewardRule, ruleIndex: number): string {
  return rule.capGroup ?? buildRuleExecutionKey(rule, ruleIndex);
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
  if (rule.type === 'mileage') {
    return {
      status: 'unsupported',
      reason: 'unsupported_reward_unit',
      detail: 'mileage reward valuation contract is not modeled',
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
  return allowlist.some((candidate) =>
    normalizedMerchantTermMatches(
      normalizedMerchant,
      normalizeMerchantText(candidate),
    )
  );
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
  counterfactualReward: number | null;
  suppressionCauses: CapSuppressionCause[];
  counterfactualReservations: CounterfactualEligibilityReservation[];
}

interface CounterfactualEligibilityReservation {
  occurrenceKey?: string;
  fixedPerDayKey?: string;
}

const counterfactualReservationsToken = Symbol(
  'counterfactual-eligibility-reservations',
);
const observedStatefulRewardToken = Symbol(
  'observed-stateful-reward',
);
interface ObservedStatefulReward {
  actual: boolean;
  counterfactual: boolean;
}

/** @internal */
export function getCounterfactualReservations(
  suppression: TransactionCapSuppression,
): readonly CounterfactualEligibilityReservation[] {
  return (
    suppression as TransactionCapSuppression & {
      [counterfactualReservationsToken]?:
        readonly CounterfactualEligibilityReservation[];
    }
  )[counterfactualReservationsToken] ?? [];
}

/** @internal */
export function getObservedStatefulReward(
  output: CalculationOutput,
): boolean | undefined {
  return (
    output as CalculationOutput & {
      [observedStatefulRewardToken]?: ObservedStatefulReward;
    }
  )[observedStatefulRewardToken]?.actual;
}

/** @internal */
export function getObservedCounterfactualStatefulReward(
  output: CalculationOutput,
): boolean | undefined {
  return (
    output as CalculationOutput & {
      [observedStatefulRewardToken]?: ObservedStatefulReward;
    }
  )[observedStatefulRewardToken]?.counterfactual;
}

interface RuleSelectionState {
  tierId: string;
  capGroupMonthUsed: Map<string, number>;
  dayRewardTracker: Set<string>;
  globalCap: number | null;
  globalRemaining: number | null;
}

type RuleProjection =
  | {
      status: 'reward';
      uncappedReward: number;
      appliedReward: number;
      causes: CapSuppressionCause[];
      capGroupKey: string;
      projectedCapGroupMonthUsed: number | null;
      fixedPerDayKey?: string;
    }
  | { status: 'inapplicable' }
  | {
      status: 'unsupported';
      reason: UnsupportedReason;
      detail?: string;
    };

function tryAddSafeNonnegativeIntegers(
  left: number,
  right: number,
): number | null {
  const sum = left + right;
  return Number.isSafeInteger(sum) && sum >= 0 ? sum : null;
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

function previewRuleExecution(
  candidate: SelectedRule,
  tx: CategorizedTransaction,
  state: RuleSelectionState,
  collectCauses = false,
): RuleProjection {
  const { rule, ruleIndex } = candidate;
  const tierRate = findTierRate(rule, state.tierId);
  if (!tierRate) return { status: 'inapplicable' };

  const ruleExecutionKey = buildRuleExecutionKey(rule, ruleIndex);
  const capGroupKey = buildCapGroupKey(rule, ruleIndex);
  const rewardValue = rewardValueForTier(tierRate);
  if (rewardValue.amount <= 0) return { status: 'inapplicable' };

  let uncappedReward: number;
  if (rewardValue.kind === 'percentage') {
    if (tierRate.unit !== null && tierRate.unit !== undefined) {
      return {
        status: 'unsupported',
        reason: 'unsupported_reward_unit',
        detail: `rate-based reward carries unit ${tierRate.unit}`,
      };
    }
    assertKnownRewardType(rule.type);
    const reward = floorSafeIntegerDecimalProduct(
      tx.amount,
      rewardValue.amount,
      100,
    );
    if (reward === null) {
      throw new Error(
        `calculated reward is not safely representable for percentage-point rate ${rewardValue.amount}`,
      );
    }
    uncappedReward = reward;
  } else {
    // Preview fixed rewards against a copy because fixed-per-day evaluation
    // records the day when it succeeds.
    const fixed = calculateFixedReward(
      tx,
      rewardValue,
      ruleExecutionKey,
      new Set(state.dayRewardTracker),
    );
    if (fixed.unsupportedReason) {
      return {
        status: 'unsupported',
        reason: fixed.unsupportedReason,
        detail: fixed.detail,
      };
    }
    uncappedReward = fixed.reward;
  }
  if (uncappedReward <= 0) return { status: 'inapplicable' };
  assertSafeNonnegativeInteger(uncappedReward, 'uncapped reward preview');

  const perTransactionCap = tierRate.perTransactionCap;
  if (perTransactionCap !== null) {
    assertSafeNonnegativeInteger(
      perTransactionCap,
      'per-transaction reward cap',
    );
  }
  const afterPerTransaction = perTransactionCap === null
    ? uncappedReward
    : Math.min(uncappedReward, perTransactionCap);

  const currentCapGroupMonthUsed =
    state.capGroupMonthUsed.get(capGroupKey) ?? 0;
  const monthlyProjection = tierRate.monthlyCap === null
    ? null
    : applyMonthlyCap(
        afterPerTransaction,
        tierRate.monthlyCap,
        currentCapGroupMonthUsed,
      );
  const afterMonthly =
    monthlyProjection?.reward ?? afterPerTransaction;
  const appliedReward = state.globalRemaining === null
    ? afterMonthly
    : Math.min(afterMonthly, state.globalRemaining);

  const causes: CapSuppressionCause[] = [];
  if (collectCauses && uncappedReward > afterPerTransaction) {
    causes.push({
      ruleId: ruleExecutionKey,
      capGroup: capGroupKey,
      capType: 'per_transaction',
      capAmount: perTransactionCap!,
      rewardBeforeCap: uncappedReward,
      rewardAfterCap: afterPerTransaction,
    });
  }
  if (collectCauses && afterPerTransaction > afterMonthly) {
    causes.push({
      ruleId: ruleExecutionKey,
      capGroup: capGroupKey,
      capType: 'monthly_category',
      capAmount: tierRate.monthlyCap!,
      rewardBeforeCap: afterPerTransaction,
      rewardAfterCap: afterMonthly,
    });
  }
  if (collectCauses && afterMonthly > appliedReward) {
    if (state.globalCap === null) {
      throw new Error(
        'calculator invariant violated: global reward clipped without a global cap',
      );
    }
    causes.push({
      ruleId: ruleExecutionKey,
      capGroup: capGroupKey,
      capType: 'monthly_total',
      capAmount: state.globalCap,
      rewardBeforeCap: afterMonthly,
      rewardAfterCap: appliedReward,
    });
  }

  return {
    status: 'reward',
    uncappedReward,
    appliedReward,
    causes,
    capGroupKey,
    projectedCapGroupMonthUsed:
      monthlyProjection === null
        ? null
        : monthlyProjection.newMonthUsed -
          (monthlyProjection.reward - appliedReward),
    fixedPerDayKey:
      rewardValue.kind === 'fixed_per_day'
        ? `${ruleExecutionKey}:${tx.date}`
        : undefined,
  };
}

function applyRuleProjection(
  projection: Extract<RuleProjection, { status: 'reward' }>,
  state: RuleSelectionState,
): void {
  if (projection.fixedPerDayKey !== undefined) {
    state.dayRewardTracker.add(projection.fixedPerDayKey);
  }
  if (projection.projectedCapGroupMonthUsed !== null) {
    state.capGroupMonthUsed.set(
      projection.capGroupKey,
      projection.projectedCapGroupMonthUsed,
    );
  }
  if (state.globalRemaining !== null) {
    state.globalRemaining -= projection.appliedReward;
  }
}

function projectRuleExecution(
  candidate: SelectedRule,
  tx: CategorizedTransaction,
  state: RuleSelectionState,
): void {
  const { rule, ruleIndex } = candidate;
  const tierRate = findTierRate(rule, state.tierId);
  if (!tierRate) return;

  const ruleExecutionKey = buildRuleExecutionKey(rule, ruleIndex);
  const capGroupKey = buildCapGroupKey(rule, ruleIndex);
  const rewardValue = rewardValueForTier(tierRate);
  let uncappedReward = 0;
  if (rewardValue.kind === 'percentage' && rewardValue.amount > 0) {
    if (tierRate.unit !== null && tierRate.unit !== undefined) return;
    assertKnownRewardType(rule.type);
    const exactReward = floorSafeIntegerDecimalProduct(
      tx.amount,
      rewardValue.amount,
      100,
    );
    if (exactReward === null) {
      throw new Error(
        `calculated reward is not safely representable for percentage-point rate ${rewardValue.amount}`,
      );
    }
    uncappedReward = exactReward;
  } else if (rewardValue.kind !== 'percentage' && rewardValue.amount > 0) {
    const fixed = calculateFixedReward(
      tx,
      rewardValue,
      ruleExecutionKey,
      state.dayRewardTracker,
    );
    if (fixed.unsupportedReason) return;
    uncappedReward = fixed.reward;
  }

  const perTransactionReward = tierRate.perTransactionCap === null
    ? uncappedReward
    : Math.min(uncappedReward, tierRate.perTransactionCap);
  const currentCapGroupMonthUsed =
    state.capGroupMonthUsed.get(capGroupKey) ?? 0;
  const ruleResult = tierRate.monthlyCap === null
    ? {
        reward: perTransactionReward,
        newMonthUsed: currentCapGroupMonthUsed,
        capReached: false,
      }
    : applyMonthlyCap(
        perTransactionReward,
        tierRate.monthlyCap,
        currentCapGroupMonthUsed,
      );
  const appliedReward = state.globalRemaining === null
    ? ruleResult.reward
    : Math.min(ruleResult.reward, state.globalRemaining);
  if (tierRate.monthlyCap !== null) {
    state.capGroupMonthUsed.set(
      capGroupKey,
      ruleResult.newMonthUsed - (ruleResult.reward - appliedReward),
    );
  }
  if (state.globalRemaining !== null) {
    state.globalRemaining -= appliedReward;
  }
}

function findRules(
  cardId: string,
  rules: RewardRule[],
  tx: CategorizedTransaction,
  actualOccurrenceUses: Map<string, number>,
  counterfactualOccurrenceUses: Map<string, number> | undefined,
  counterfactualFixedPerDayUses: Set<string> | undefined,
  actualState: RuleSelectionState,
  collectCapSuppressions: boolean,
  collectSuppressionCauses: boolean,
): RuleSelection {
  const actualCandidates: SelectedRule[] = [];
  const counterfactualCandidates: SelectedRule[] = [];
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

    const ruleId = buildRuleExecutionKey(rule, ruleIndex);
    const actualCondition = ruleConditionsMatch(
      rule,
      tx,
      ruleId,
      actualOccurrenceUses,
    );
    if (actualCondition.status === 'unsupported') {
      unsupported.push({
        cardId,
        transactionId: tx.id,
        ruleId,
        category: buildCategoryKey(rule.category, rule.subcategory),
        reason: actualCondition.reason ?? 'rule_marked_unsupported',
        detail: actualCondition.detail,
      });
    }
    if (actualCondition.status === 'match') {
      actualCandidates.push({
        rule,
        ruleIndex,
        occurrenceKey: actualCondition.occurrenceKey,
      });
    }

    if (collectCapSuppressions) {
      const hasOccurrenceLimit =
        rule.conditions?.maxUses !== undefined &&
        rule.conditions.usePeriod !== undefined;
      const counterfactualCondition =
        hasOccurrenceLimit && actualCondition.status !== 'unsupported'
          ? ruleConditionsMatch(
              rule,
              tx,
              ruleId,
              counterfactualOccurrenceUses!,
            )
          : actualCondition;
      if (counterfactualCondition.status === 'match') {
        counterfactualCandidates.push({
          rule,
          ruleIndex,
          occurrenceKey: counterfactualCondition.occurrenceKey,
        });
      }
    }
  }

  if (
    actualCandidates.length === 0 &&
    counterfactualCandidates.length === 0
  ) {
    return {
      rules: [],
      unsupported,
      counterfactualReward: 0,
      suppressionCauses: [],
      counterfactualReservations: [],
    };
  }

  const projectedActualState: RuleSelectionState = {
    tierId: actualState.tierId,
    capGroupMonthUsed: new Map(actualState.capGroupMonthUsed),
    dayRewardTracker: new Set(actualState.dayRewardTracker),
    globalCap: actualState.globalCap,
    globalRemaining: actualState.globalRemaining,
  };
  const actualGroups = new Map<string, SelectedRule[]>();
  for (const candidate of actualCandidates) {
    const group = candidate.rule.stackingGroup ?? '__default__';
    const members = actualGroups.get(group) ?? [];
    members.push(candidate);
    actualGroups.set(group, members);
  }

  const selected: SelectedRule[] = [];
  for (const group of [...actualGroups.keys()].sort()) {
    const members = actualGroups.get(group)!;
    const additive = members
      .filter(({ rule }) => rule.combination === 'additive')
      .sort(compareRuleCandidates);
    for (const candidate of additive) {
      selected.push(candidate);
      projectRuleExecution(candidate, tx, projectedActualState);
    }

    const exclusive = members
      .filter(({ rule }) => rule.combination !== 'additive')
      .sort(compareRuleCandidates);
    for (const candidate of exclusive) {
      const projection = previewRuleExecution(
        candidate,
        tx,
        projectedActualState,
      );
      if (projection.status === 'unsupported') {
        const ruleId = candidate.rule.id ??
          `${buildCategoryKey(
            candidate.rule.category,
            candidate.rule.subcategory,
          )}#${candidate.ruleIndex}`;
        unsupported.push({
          cardId,
          transactionId: tx.id,
          ruleId,
          category: buildCategoryKey(
            candidate.rule.category,
            candidate.rule.subcategory,
          ),
          reason: projection.reason,
          detail: projection.detail,
        });
        continue;
      }
      if (projection.status === 'inapplicable') continue;

      if (projection.appliedReward > 0) {
        selected.push(candidate);
        applyRuleProjection(projection, projectedActualState);
        break;
      }
    }
  }

  if (!collectCapSuppressions) {
    return {
      rules: selected,
      unsupported,
      counterfactualReward: 0,
      suppressionCauses: [],
      counterfactualReservations: [],
    };
  }

  const counterfactualGroups = new Map<string, SelectedRule[]>();
  for (const candidate of counterfactualCandidates) {
    const group = candidate.rule.stackingGroup ?? '__default__';
    const members = counterfactualGroups.get(group) ?? [];
    members.push(candidate);
    counterfactualGroups.set(group, members);
  }

  let counterfactualReward: number | null = 0;
  const suppressionCauses: CapSuppressionCause[] = [];
  const counterfactualReservations: CounterfactualEligibilityReservation[] =
    [];
  const projectedCounterfactualState: RuleSelectionState = {
    tierId: actualState.tierId,
    capGroupMonthUsed: new Map(actualState.capGroupMonthUsed),
    dayRewardTracker: new Set(counterfactualFixedPerDayUses!),
    globalCap: actualState.globalCap,
    globalRemaining: actualState.globalRemaining,
  };
  const retainCounterfactual = (
    candidate: SelectedRule,
    projection: Extract<RuleProjection, { status: 'reward' }>,
  ): void => {
    if (counterfactualReward !== null) {
      counterfactualReward = tryAddSafeNonnegativeIntegers(
        counterfactualReward,
        projection.uncappedReward,
      );
    }
    suppressionCauses.push(...projection.causes);
    const reservation: CounterfactualEligibilityReservation = {};
    if (candidate.occurrenceKey) {
      reservation.occurrenceKey = candidate.occurrenceKey;
    }
    const tierRate = findTierRate(candidate.rule, actualState.tierId);
    if (
      tierRate &&
      rewardValueForTier(tierRate).kind === 'fixed_per_day'
    ) {
      reservation.fixedPerDayKey =
        `${buildRuleExecutionKey(candidate.rule, candidate.ruleIndex)}:${tx.date}`;
    }
    if (
      reservation.occurrenceKey !== undefined ||
      reservation.fixedPerDayKey !== undefined
    ) {
      counterfactualReservations.push(reservation);
    }
    applyRuleProjection(projection, projectedCounterfactualState);
  };

  for (const group of [...counterfactualGroups.keys()].sort()) {
    const members = counterfactualGroups.get(group)!;
    const additive = members
      .filter(({ rule }) => rule.combination === 'additive')
      .sort(compareRuleCandidates);
    for (const candidate of additive) {
      const projection = previewRuleExecution(
        candidate,
        tx,
        projectedCounterfactualState,
        collectSuppressionCauses,
      );
      if (projection.status === 'reward') {
        retainCounterfactual(candidate, projection);
      }
    }

    const exclusive = members
      .filter(({ rule }) => rule.combination !== 'additive')
      .sort(compareRuleCandidates);
    for (const candidate of exclusive) {
      const projection = previewRuleExecution(
        candidate,
        tx,
        projectedCounterfactualState,
        collectSuppressionCauses,
      );
      if (projection.status !== 'reward') continue;
      retainCounterfactual(candidate, projection);
      break;
    }
  }

  return {
    rules: selected,
    unsupported,
    counterfactualReward,
    suppressionCauses,
    counterfactualReservations,
  };
}

function assertKnownRewardType(type: string): void {
  switch (type) {
    case 'discount':
    case 'points':
    case 'cashback':
    case 'mileage':
      return;
    default:
      throw new Error(`Unknown reward type: ${type}. Expected one of: discount, points, cashback, mileage`);
  }
}

function legacyRewardValue(tier: RewardTierRate): RewardValue {
  const fixedAmount = tier.fixedAmount ?? null;
  if (tier.rate !== null && tier.rate > 0) {
    return { kind: 'percentage', amount: tier.rate };
  }
  if (fixedAmount !== null && fixedAmount > 0) {
    return {
      kind:
        tier.unit === 'won_per_day'
          ? 'fixed_per_day'
          : tier.unit === 'won_per_liter'
            ? 'fuel_per_liter'
            : tier.unit === 'mile_per_1500won' || tier.unit === 'miles'
              ? 'mileage_per_spend'
              : 'fixed_per_transaction',
      amount: fixedAmount,
    };
  }
  if (tier.rate !== null) {
    return { kind: 'percentage', amount: tier.rate };
  }
  return {
    kind: 'fixed_per_transaction',
    amount: fixedAmount ?? 0,
  };
}

function rewardValueForTier(tier: RewardTierRate): RewardValue {
  return tier.value ?? legacyRewardValue(tier);
}

function applyMonthlyCap(
  rawReward: number,
  monthlyCap: number | null,
  currentMonthUsed: number,
): { reward: number; newMonthUsed: number; capReached: boolean } {
  assertSafeNonnegativeInteger(rawReward, 'raw reward');
  assertSafeNonnegativeInteger(currentMonthUsed, 'current monthly reward');
  if (monthlyCap !== null) {
    assertSafeNonnegativeInteger(monthlyCap, 'monthly reward cap');
  }
  if (monthlyCap === null) {
    return {
      reward: rawReward,
      newMonthUsed: addSafeNonnegativeIntegers(
        currentMonthUsed,
        rawReward,
        'monthly reward total',
      ),
      capReached: false,
    };
  }

  const remaining = Math.max(0, monthlyCap - currentMonthUsed);
  const reward = Math.min(rawReward, remaining);
  const newMonthUsed = addSafeNonnegativeIntegers(
    currentMonthUsed,
    reward,
    'monthly reward total',
  );
  return {
    reward,
    newMonthUsed,
    capReached:
      rawReward > 0 &&
      currentMonthUsed < monthlyCap &&
      newMonthUsed === monthlyCap,
  };
}

function calculateFixedReward(
  tx: CategorizedTransaction,
  rewardValue: RewardValue,
  ruleKey: string,
  dayRewardTracker: Set<string>,
): {
  reward: number;
  unsupportedReason?: UnsupportedReason;
  detail?: string;
} {
  const fixedAmount = rewardValue.amount;
  if (fixedAmount <= 0) return { reward: 0 };

  if (rewardValue.kind === 'mileage_per_spend') {
    if (
      !Number.isFinite(fixedAmount) ||
      fixedAmount > Number.MAX_SAFE_INTEGER
    ) {
      return {
        reward: 0,
        unsupportedReason: 'unsupported_reward_unit',
        detail: `mileage rate is not safely representable: ${fixedAmount}`,
      };
    }
    const reward = floorSafeIntegerDecimalProduct(
      Math.floor(tx.amount / 1500),
      fixedAmount,
    );
    if (reward === null) {
      return {
        reward: 0,
        unsupportedReason: 'unsupported_reward_unit',
        detail: `mileage reward is not safely representable for rate ${fixedAmount}`,
      };
    }
    return { reward };
  }

  if (!Number.isSafeInteger(fixedAmount)) {
    return {
      reward: 0,
      unsupportedReason: 'unsupported_reward_unit',
      detail: `fixed reward is not safely representable: ${fixedAmount}`,
    };
  }

  if (rewardValue.kind === 'fixed_per_day') {
    const dayKey = `${ruleKey}:${tx.date}`;
    if (dayRewardTracker.has(dayKey)) {
      return { reward: 0 };
    }
    dayRewardTracker.add(dayKey);
    return { reward: fixedAmount };
  }

  if (rewardValue.kind === 'fuel_per_liter') {
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
    if (liters! > MAX_REWARDABLE_FUEL_VOLUME_LITERS) {
      return {
        reward: 0,
        unsupportedReason: 'invalid_fuel_volume',
        detail:
          `fuel volume exceeds the ${MAX_REWARDABLE_FUEL_VOLUME_LITERS} L consumer transaction bound`,
      };
    }
    const reward = Math.floor(fixedAmount * liters!);
    if (!Number.isSafeInteger(reward) || reward < 0) {
      return {
        reward: 0,
        unsupportedReason: 'unsupported_reward_unit',
        detail: 'fuel-per-liter reward is not safely representable',
      };
    }
    return { reward };
  }

  if (rewardValue.kind === 'fixed_per_transaction') {
    return { reward: fixedAmount };
  }

  return {
    reward: 0,
    unsupportedReason: 'unsupported_reward_unit',
    detail: `unsupported fixed reward kind: ${rewardValue.kind}`,
  };
}

export function calculateRewards(input: CalculationInput): CalculationOutput {
  assertSafeNonnegativeInteger(
    input.previousMonthSpending,
    'previousMonthSpending',
  );
  assertValidCardRuleStructure(input.cardRule);
  return calculateRewardsKernel(input);
}

/** @internal */
export function calculateRewardsWithPreparedCard(input: {
  transactions: CategorizedTransaction[];
  previousMonthSpending: number;
  preparedCardRule: PreparedCardRule;
  /** @internal Skip diagnostics for optimizer replays that only need totals. */
  collectCapSuppressions?: boolean;
  /** @internal Emit rows only at or after this original transaction index. */
  capSuppressionStartIndex?: number;
  /** @internal Observe actual maxUses/fixed-per-day consumption at one index. */
  observeStatefulRewardAtIndex?: number;
}): CalculationOutput {
  assertSafeNonnegativeInteger(
    input.previousMonthSpending,
    'previousMonthSpending',
  );
  if (input.preparedCardRule[preparedCardRuleToken] !== true) {
    throw new Error('prepared card rule proof is invalid');
  }
  const capSuppressionStartIndex = input.capSuppressionStartIndex ?? 0;
  if (
    !Number.isSafeInteger(capSuppressionStartIndex) ||
    capSuppressionStartIndex < 0
  ) {
    throw new Error(
      `capSuppressionStartIndex must be a non-negative safe integer, got ${capSuppressionStartIndex}`,
    );
  }
  if (
    input.observeStatefulRewardAtIndex !== undefined &&
    (
      !Number.isSafeInteger(input.observeStatefulRewardAtIndex) ||
      input.observeStatefulRewardAtIndex < 0
    )
  ) {
    throw new Error(
      'observeStatefulRewardAtIndex must be a non-negative safe integer, ' +
      `got ${input.observeStatefulRewardAtIndex}`,
    );
  }
  return calculateRewardsKernel({
    transactions: input.transactions,
    previousMonthSpending: input.previousMonthSpending,
    cardRule: input.preparedCardRule.cardRule,
  }, input.collectCapSuppressions ?? true, capSuppressionStartIndex,
  input.observeStatefulRewardAtIndex);
}

function calculateRewardsKernel(
  input: CalculationInput,
  collectCapSuppressions = true,
  capSuppressionStartIndex = 0,
  observeStatefulRewardAtIndex?: number,
): CalculationOutput {
  const { transactions, previousMonthSpending, cardRule } = input;

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

  // 2. Track monthly caps per shared group and global while accumulating
  // per-category outputs.
  const capGroupMonthUsed = new Map<string, number>();
  const dayRewardTracker = new Set<string>();
  const occurrenceUses = new Map<string, number>();
  const counterfactualOccurrenceUses = collectCapSuppressions
    ? new Map<string, number>()
    : undefined;
  const counterfactualFixedPerDayUses = collectCapSuppressions
    ? new Set<string>()
    : undefined;
  let globalMonthUsed = 0;
  const globalCap = globalConstraints.monthlyTotalDiscountCap;
  if (globalCap !== null) {
    assertSafeNonnegativeInteger(globalCap, 'global monthly reward cap');
  }
  const categoryRewards = new Map<string, CategoryReward>();
  const capsHit: CapInfo[] = [];
  const capSuppressions: TransactionCapSuppression[] = [];
  let capSuppressionsComplete = true;
  const skippedTransactions: SkippedTransaction[] = [];
  const unsupportedRules: UnsupportedRule[] = [];
  let observedStatefulReward = false;
  let observedCounterfactualStatefulReward = false;

  // Track cumulative reward per rewardType within each category bucket,
  // so the dominant type (highest cumulative reward) is reported rather
  // than the type of the last transaction processed.
  const rewardTypeAccum = new Map<string, Map<string, number>>();

  for (const [transactionIndex, tx] of transactions.entries()) {
    const emitCapSuppression =
      collectCapSuppressions &&
      transactionIndex >= capSuppressionStartIndex;
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
    if (!isRewardEligibleTransaction(tx)) {
      skippedTransactions.push({ id: tx.id, amount: tx.amount, currency: tx.currency, reason: 'non_krw' });
      continue;
    }

    const categoryKey = buildCategoryKey(tx.category, tx.subcategory);
    const selection: RuleSelection = tierId === 'none'
      ? {
          rules: [],
          unsupported: [] as UnsupportedRule[],
          counterfactualReward: 0,
          suppressionCauses: [],
          counterfactualReservations: [],
        }
      : findRules(
          card.id,
          rewardRules,
          tx,
          occurrenceUses,
          counterfactualOccurrenceUses,
          counterfactualFixedPerDayUses,
          {
            tierId,
            capGroupMonthUsed,
            dayRewardTracker,
            globalCap,
            globalRemaining:
              globalCap === null
                ? null
                : Math.max(0, globalCap - globalMonthUsed),
          },
          collectCapSuppressions,
          emitCapSuppression,
        );
    unsupportedRules.push(...selection.unsupported);
    if (
      transactionIndex === observeStatefulRewardAtIndex &&
      selection.counterfactualReservations.length > 0
    ) {
      observedCounterfactualStatefulReward = true;
    }
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

    bucket.spending = addSafeNonnegativeIntegers(
      bucket.spending,
      tx.amount,
      `category spending for ${categoryKey}`,
    );

    let transactionAppliedReward = 0;
    for (const selectedRule of selection.rules) {
      const { rule, ruleIndex, occurrenceKey } = selectedRule;
      const ruleExecutionKey = buildRuleExecutionKey(rule, ruleIndex);
      const ruleId = ruleExecutionKey;
      const capGroup = buildCapGroupKey(rule, ruleIndex);
      const tierRate = findTierRate(rule, tierId);
      if (!tierRate) {
        bucket.rewardType = rule.type;
        continue;
      }

      const rewardValue = rewardValueForTier(tierRate);
      const perTxCap = tierRate.perTransactionCap;
      const monthlyCap = tierRate.monthlyCap;
      const currentCapGroupMonthUsed = capGroupMonthUsed.get(capGroup) ?? 0;

      let rawReward = 0;
      let uncappedReward = 0;
      let ruleResult: { reward: number; newMonthUsed: number; capReached: boolean };
      const hasFixedReward =
        rewardValue.kind !== 'percentage' && rewardValue.amount > 0;
      if (rewardValue.kind === 'percentage' && rewardValue.amount > 0) {
        if (tierRate.unit !== null && tierRate.unit !== undefined) {
          unsupportedRules.push({
            cardId: card.id,
            transactionId: tx.id,
            ruleId,
            category: categoryKey,
            reason: 'unsupported_reward_unit',
            detail: `rate-based reward carries unit ${tierRate.unit}`,
          });
          continue;
        }
        assertKnownRewardType(rule.type);
        const exactReward = floorSafeIntegerDecimalProduct(
          tx.amount,
          rewardValue.amount,
          100,
        );
        if (exactReward === null) {
          throw new Error(
            `calculated reward is not safely representable for percentage-point rate ${rewardValue.amount}`,
          );
        }
        uncappedReward = exactReward;
        rawReward = perTxCap !== null ? Math.min(uncappedReward, perTxCap) : uncappedReward;
        ruleResult = applyMonthlyCap(
          rawReward,
          monthlyCap,
          currentCapGroupMonthUsed,
        );
      } else if (hasFixedReward) {
        const fixed = calculateFixedReward(
          tx,
          rewardValue,
          ruleExecutionKey,
          dayRewardTracker,
        );
        if (fixed.unsupportedReason) {
          unsupportedRules.push({
            cardId: card.id,
            transactionId: tx.id,
            ruleId,
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
        ruleResult = applyMonthlyCap(
          rawReward,
          monthlyCap,
          currentCapGroupMonthUsed,
        );
      } else {
        // Rule has neither rate nor fixed amount — produces 0 reward.
        // Wildcard rules (category === '*') legitimately have no rate.
        rawReward = 0;
        ruleResult = applyMonthlyCap(
          0,
          monthlyCap,
          currentCapGroupMonthUsed,
        );
      }

      assertSafeNonnegativeInteger(uncappedReward, 'uncapped reward');
      assertSafeNonnegativeInteger(rawReward, 'per-transaction reward');

      if (
        transactionIndex === observeStatefulRewardAtIndex &&
        uncappedReward > 0 &&
        (
          occurrenceKey !== undefined ||
          rewardValue.kind === 'fixed_per_day'
        )
      ) {
        observedStatefulReward = true;
      }

      // Consume an occurrence only after the tier and reward facts have produced
      // an executable reward. Cap clipping happens later and still counts.
      if (occurrenceKey && uncappedReward > 0) {
        occurrenceUses.set(
          occurrenceKey,
          addSafeNonnegativeIntegers(
            occurrenceUses.get(occurrenceKey) ?? 0,
            1,
            `occurrence count for ${occurrenceKey}`,
          ),
        );
      }

      if (perTxCap !== null && uncappedReward > perTxCap) {
        capsHit.push({
          category: categoryKey,
          capType: 'per_transaction',
          capAmount: perTxCap,
          actualReward: uncappedReward,
          appliedReward: rawReward,
          ruleId,
          capGroup,
        });
        bucket.capReached = true;
      }

      capGroupMonthUsed.set(capGroup, ruleResult.newMonthUsed);

      const rewardAfterMonthlyCap = ruleResult.reward;
      let appliedReward = rewardAfterMonthlyCap;
      if (globalCap !== null) {
        const globalRemaining = Math.max(0, globalCap - globalMonthUsed);
        appliedReward = Math.min(rewardAfterMonthlyCap, globalRemaining);
        const wasClipped = rewardAfterMonthlyCap > appliedReward;
        const nextGlobalMonthUsed = addSafeNonnegativeIntegers(
          globalMonthUsed,
          appliedReward,
          'global monthly reward total',
        );
        const reachedGlobalCap =
          rewardAfterMonthlyCap > 0 &&
          (wasClipped || nextGlobalMonthUsed === globalCap);
        if (reachedGlobalCap) {
          capsHit.push({
            category: categoryKey,
            capType: 'monthly_total',
            capAmount: globalCap,
            actualReward: rewardAfterMonthlyCap,
            appliedReward,
          });
          bucket.capReached = true;
        }
        if (wasClipped) {
          // When the global cap clips a reward, the cap-group tracker was
          // advanced by the full pre-clip amount (rewardAfterMonthlyCap).
          // We must roll it back to reflect only what was actually applied,
          // so subsequent transactions see the correct remaining group-level
          // cap relative to the global constraint.
          const overcount = rewardAfterMonthlyCap - appliedReward;
          capGroupMonthUsed.set(
            capGroup,
            ruleResult.newMonthUsed - overcount,
          );
        }
        globalMonthUsed = nextGlobalMonthUsed;
      }

      bucket.reward = addSafeNonnegativeIntegers(
        bucket.reward,
        appliedReward,
        `category reward for ${categoryKey}`,
      );
      if (collectCapSuppressions) {
        transactionAppliedReward = addSafeNonnegativeIntegers(
          transactionAppliedReward,
          appliedReward,
          `transaction reward for ${tx.id}`,
        );
      }
      // Accumulate reward per rewardType so we can determine the dominant
      // type (highest cumulative reward) at the end of the loop, rather than
      // unconditionally overwriting with the last transaction's type.
      const typeMap = rewardTypeAccum.get(categoryKey) ?? new Map<string, number>();
      typeMap.set(
        rule.type,
        addSafeNonnegativeIntegers(
          typeMap.get(rule.type) ?? 0,
          appliedReward,
          `reward type total for ${rule.type}`,
        ),
      );
      rewardTypeAccum.set(categoryKey, typeMap);
      const finalCapGroupMonthUsed = capGroupMonthUsed.get(capGroup) ?? 0;
      const reachedRuleCap =
        ruleResult.capReached &&
        monthlyCap !== null &&
        finalCapGroupMonthUsed === monthlyCap;
      if (reachedRuleCap) {
        bucket.capReached = true;
        capsHit.push({
          category: categoryKey,
          capType: 'monthly_category',
          capAmount: monthlyCap,
          actualReward: rawReward,
          appliedReward: rewardAfterMonthlyCap,
          ruleId,
          capGroup,
        });
      }
      // No need for categoryRewards.set() here — the bucket was registered
      // immediately after creation and mutations are reflected by reference (C8-02).
    }

    if (collectCapSuppressions) {
      const committedCounterfactualReservations = new Set<string>();
      const commitCounterfactualReservation = (
        reservation: CounterfactualEligibilityReservation,
      ): void => {
        const identity = JSON.stringify([
          reservation.occurrenceKey,
          reservation.fixedPerDayKey,
        ]);
        if (committedCounterfactualReservations.has(identity)) return;
        committedCounterfactualReservations.add(identity);
        if (reservation.occurrenceKey !== undefined) {
          const current =
            counterfactualOccurrenceUses!.get(reservation.occurrenceKey) ?? 0;
          const next = tryAddSafeNonnegativeIntegers(current, 1);
          if (next !== null) {
            counterfactualOccurrenceUses!.set(
              reservation.occurrenceKey,
              next,
            );
          } else {
            capSuppressionsComplete = false;
          }
        }
        if (reservation.fixedPerDayKey !== undefined) {
          counterfactualFixedPerDayUses!.add(
            reservation.fixedPerDayKey,
          );
        }
      };
      for (const reservation of selection.counterfactualReservations) {
        // Advance the deterministic cap-free path even when an executable
        // fallback made this transaction an equal replacement. Deferring the
        // scarce opportunity would allow a later row to reuse it and publish
        // a loss that no ordered replay can realize.
        commitCounterfactualReservation(reservation);
      }

      if (selection.counterfactualReward === null) {
        capSuppressionsComplete = false;
      } else if (selection.counterfactualReward < transactionAppliedReward) {
        // Positive transaction rows cannot express the negative offset created
        // when an earlier cap-free stateful choice displaces a stronger later
        // actual fallback. Preserve unknown rather than overstate the sum.
        capSuppressionsComplete = false;
      } else if (
        emitCapSuppression &&
        selection.counterfactualReward > transactionAppliedReward
      ) {
        let grossSuppressedReward: number | null = 0;
        for (const cause of selection.suppressionCauses) {
          grossSuppressedReward = tryAddSafeNonnegativeIntegers(
            grossSuppressedReward,
            cause.rewardBeforeCap - cause.rewardAfterCap,
          );
          if (grossSuppressedReward === null) break;
        }
        const netSuppressedReward =
          selection.counterfactualReward - transactionAppliedReward;
        if (
          grossSuppressedReward !== null &&
          (
            !Number.isSafeInteger(netSuppressedReward) ||
            netSuppressedReward <= 0 ||
            selection.suppressionCauses.length === 0 ||
            grossSuppressedReward < netSuppressedReward
          )
        ) {
          grossSuppressedReward = null;
        }
        if (grossSuppressedReward === null) {
          capSuppressionsComplete = false;
        }
        if (grossSuppressedReward !== null) {
          const replacementReward =
            grossSuppressedReward - netSuppressedReward;
          const suppression: TransactionCapSuppression = {
            transactionId: tx.id,
            transactionIndex,
            category: categoryKey,
            actualReward: transactionAppliedReward,
            counterfactualReward: selection.counterfactualReward,
            grossSuppressedReward,
            replacementReward,
            netSuppressedReward,
            causes: selection.suppressionCauses,
          };
          Object.defineProperty(
            suppression,
            counterfactualReservationsToken,
            {
              value: selection.counterfactualReservations,
              enumerable: false,
              configurable: false,
              writable: false,
            },
          );
          capSuppressions.push(suppression);
        }
      }
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

  const totalReward = categoryRewardList.reduce(
    (sum, categoryReward) => addSafeNonnegativeIntegers(
      sum,
      categoryReward.reward,
      'calculator total reward',
    ),
    0,
  );
  const totalSpending = categoryRewardList.reduce(
    (sum, categoryReward) => addSafeNonnegativeIntegers(
      sum,
      categoryReward.spending,
      'calculator total spending',
    ),
    0,
  );

  const output: CalculationOutput = {
    cardId: card.id,
    performanceTier: tierId,
    rewards: categoryRewardList,
    totalReward,
    totalSpending,
    capsHit,
    capSuppressions,
    capSuppressionsComplete,
    skippedTransactions,
    unsupportedRules,
  };
  if (observeStatefulRewardAtIndex !== undefined) {
    Object.defineProperty(output, observedStatefulRewardToken, {
      value: {
        actual: observedStatefulReward,
        counterfactual: observedCounterfactualStatefulReward,
      } satisfies ObservedStatefulReward,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return output;
}
