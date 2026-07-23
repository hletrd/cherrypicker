import {
  buildCategoryKey,
  type CanonicalCategory,
  CategoryRegistry,
} from './category-contract.js';
import {
  getPerformanceExclusionDescriptor,
  isPerformanceExclusionId,
} from './performance-exclusions.js';
import {
  collectUnmodeledRuleRestrictions,
  rewardConditionSignature,
  sharedPerformanceTiers,
} from './rule-semantics.js';
import type { CardRuleSet, RewardRule } from './types.js';

export type CatalogIssueCode =
  | 'duplicate_card_id'
  | 'duplicate_rule_id'
  | 'duplicate_tier_id'
  | 'duplicate_tier_reference'
  | 'invalid_tier_range'
  | 'unknown_tier_reference'
  | 'future_last_updated'
  | 'invalid_validation_clock'
  | 'invalid_category'
  | 'invalid_performance_exclusion'
  | 'general_spend_as_uncategorized'
  | 'unverified_merchant_scope'
  | 'unmodeled_reward_value'
  | 'unexecutable_reward_tier'
  | 'unmodeled_annual_cap'
  | 'unmodeled_global_constraints'
  | 'unreachable_merchant'
  | 'missing_rule_contract'
  | 'unmodeled_restriction'
  | 'ambiguous_rule_group';

export interface CatalogValidationIssue {
  code: CatalogIssueCode;
  cardId: string;
  path: string;
  message: string;
}

export interface CatalogValidationOptions {
  resolveMerchant?: (merchant: string) => CanonicalCategory;
  clock?: CatalogClock;
}

export type CatalogClock = () => Date;

interface FreshnessContext {
  todayUtc: string | null;
  clockError: string | null;
}

const systemCatalogClock: CatalogClock = () => new Date();

function resolveFreshnessContext(
  clock: CatalogClock = systemCatalogClock,
): FreshnessContext {
  try {
    const now = clock();
    if (!Number.isFinite(now.getTime())) {
      return {
        todayUtc: null,
        clockError: 'catalog validation clock must return a valid Date',
      };
    }
    return {
      todayUtc: now.toISOString().slice(0, 10),
      clockError: null,
    };
  } catch {
    return {
      todayUtc: null,
      clockError: 'catalog validation clock must return a valid Date',
    };
  }
}

function collectFreshnessIssues(
  cardRule: CardRuleSet,
  context: FreshnessContext,
): CatalogValidationIssue[] {
  if (context.clockError) {
    return [{
      code: 'invalid_validation_clock',
      cardId: cardRule.card.id,
      path: 'card.lastUpdated',
      message: context.clockError,
    }];
  }
  if (
    context.todayUtc !== null &&
    cardRule.card.lastUpdated > context.todayUtc
  ) {
    return [{
      code: 'future_last_updated',
      cardId: cardRule.card.id,
      path: 'card.lastUpdated',
      message:
        `lastUpdated "${cardRule.card.lastUpdated}" is after validation date ` +
        `"${context.todayUtc}"`,
    }];
  }
  return [];
}

export function collectCardFreshnessIssues(
  cardRule: CardRuleSet,
  clock: CatalogClock = systemCatalogClock,
): CatalogValidationIssue[] {
  return collectFreshnessIssues(cardRule, resolveFreshnessContext(clock));
}

const GENERAL_SPEND_PATTERN =
  /(전\s*가맹점|모든\s*가맹점|전체\s*가맹점|일반\s*(?:온라인|오프라인)?\s*가맹점|국내외?\s*(?:온라인|오프라인)?\s*(?:가맹점|이용|결제)|해외\s*(?:온라인|오프라인)?\s*(?:가맹점|이용|결제)|기본\s*(?:적립|할인|캐시백)|모든\s*결제|전국\s*가맹점|어디서나)/;

export class CatalogValidationError extends Error {
  readonly issues: CatalogValidationIssue[];

  constructor(issues: CatalogValidationIssue[]) {
    super(
      `Card catalog validation failed with ${issues.length} issue(s):\n` +
        issues
          .map((issue) => `${issue.cardId}:${issue.path}: ${issue.message}`)
          .join('\n'),
    );
    this.name = 'CatalogValidationError';
    this.issues = issues;
  }
}

function ruleContainsMerchant(
  rule: RewardRule,
  resolved: CanonicalCategory,
): boolean {
  if (rule.category === '*') return true;
  if (rule.category !== resolved.category) return false;
  return rule.subcategory === undefined || rule.subcategory === resolved.subcategory;
}

function collectCardRuleIssuesWithContext(
  cardRule: CardRuleSet,
  registry: CategoryRegistry,
  options: CatalogValidationOptions,
  freshness: FreshnessContext,
): CatalogValidationIssue[] {
  const issues = collectFreshnessIssues(cardRule, freshness);
  const cardId = cardRule.card.id;
  const tierIds = new Set<string>();

  cardRule.performanceTiers.forEach((tier, index) => {
    if (tierIds.has(tier.id)) {
      issues.push({
        code: 'duplicate_tier_id',
        cardId,
        path: `performanceTiers.${index}.id`,
        message: `duplicate performance tier id "${tier.id}"`,
      });
    }
    tierIds.add(tier.id);
    if (tier.maxSpending !== null && tier.maxSpending < tier.minSpending) {
      issues.push({
        code: 'invalid_tier_range',
        cardId,
        path: `performanceTiers.${index}`,
        message: 'maxSpending must be greater than or equal to minSpending',
      });
    }
  });

  for (const [index, exclusion] of cardRule.performanceExclusions.entries()) {
    if (!isPerformanceExclusionId(exclusion)) {
      issues.push({
        code: 'invalid_performance_exclusion',
        cardId,
        path: `performanceExclusions.${index}`,
        message: `unknown performance exclusion "${exclusion}"`,
      });
      continue;
    }
    const descriptor = getPerformanceExclusionDescriptor(exclusion);
    if (
      descriptor?.kind === 'category' &&
      !registry.resolvePair(descriptor.category, descriptor.subcategory).value
    ) {
      issues.push({
        code: 'invalid_performance_exclusion',
        cardId,
        path: `performanceExclusions.${index}`,
        message:
          `performance exclusion "${exclusion}" maps to invalid category ` +
          `"${buildCategoryKey(descriptor.category, descriptor.subcategory)}"`,
      });
    }
  }

  const ruleIds = new Set<string>();
  cardRule.rewards.forEach((rule, ruleIndex) => {
    const path = `rewards.${ruleIndex}`;
    const missingContractFields = [
      ['id', rule.id],
      ['priority', rule.priority],
      ['combination', rule.combination],
      ['stackingGroup', rule.stackingGroup],
      ['capGroup', rule.capGroup],
      ['support', rule.support],
    ]
      .filter(([, value]) => value === undefined)
      .map(([field]) => field);
    if (missingContractFields.length > 0) {
      issues.push({
        code: 'missing_rule_contract',
        cardId,
        path,
        message: `missing explicit rule fields: ${missingContractFields.join(', ')}`,
      });
    }
    if (rule.id) {
      if (ruleIds.has(rule.id)) {
        issues.push({
          code: 'duplicate_rule_id',
          cardId,
          path: `${path}.id`,
          message: `duplicate reward rule id "${rule.id}"`,
        });
      }
      ruleIds.add(rule.id);
    }

    const resolution = registry.resolvePair(rule.category, rule.subcategory);
    if (!resolution.value) {
      issues.push({
        code: 'invalid_category',
        cardId,
        path,
        message:
          `invalid category "${buildCategoryKey(rule.category, rule.subcategory)}"` +
          ` (${resolution.error ?? 'unknown'})`,
      });
    } else if (
      buildCategoryKey(
        resolution.value.category,
        resolution.value.subcategory,
      ) !== buildCategoryKey(rule.category, rule.subcategory)
    ) {
      issues.push({
        code: 'invalid_category',
        cardId,
        path,
        message:
          `non-canonical category "${buildCategoryKey(rule.category, rule.subcategory)}"; ` +
          `use "${buildCategoryKey(resolution.value.category, resolution.value.subcategory)}"`,
      });
    }

    const description = `${rule.label ?? ''} ${rule.conditions?.note ?? ''}`;
    if (rule.category === 'uncategorized' && GENERAL_SPEND_PATTERN.test(description)) {
      issues.push({
        code: 'general_spend_as_uncategorized',
        cardId,
        path,
        message: 'general-spend language must use wildcard category "*"',
      });
    }
    const hasPositiveReward = rule.tiers.some(
      (tier) => (tier.rate ?? 0) > 0 || (tier.fixedAmount ?? 0) > 0,
    );
    if (
      rule.support?.status === 'supported' &&
      !hasPositiveReward
    ) {
      issues.push({
        code: 'unmodeled_reward_value',
        cardId,
        path,
        message:
          'supported reward has no positive modeled value; recover the value ' +
          'or mark the rule unsupported',
      });
    }
    if (
      rule.support?.status === 'supported' &&
      rule.type === 'mileage'
    ) {
      issues.push({
        code: 'unexecutable_reward_tier',
        cardId,
        path,
        message:
          'supported mileage reward has no explicit program-aware Won ' +
          'valuation contract; mark it unsupported until valuation is modeled',
      });
    }
    if (
      rule.support?.status === 'supported' &&
      rule.category === 'uncategorized' &&
      !rule.subcategory &&
      (rule.conditions?.specificMerchants?.length ?? 0) === 0 &&
      hasPositiveReward
    ) {
      issues.push({
        code: 'unverified_merchant_scope',
        cardId,
        path,
        message:
          'positive uncategorized reward without a merchant constraint has ' +
          'unverified scope; use an audited category or mark it unsupported',
      });
    }

    const firstTierReference = new Map<string, number>();
    rule.tiers.forEach((tier, tierIndex) => {
      const firstIndex = firstTierReference.get(tier.performanceTier);
      if (firstIndex !== undefined) {
        issues.push({
          code: 'duplicate_tier_reference',
          cardId,
          path: `${path}.tiers.${tierIndex}.performanceTier`,
          message:
            `duplicate performance tier reference "${tier.performanceTier}" ` +
            `in reward rule "${rule.id}" (first referenced at tiers.${firstIndex})`,
        });
      } else {
        firstTierReference.set(tier.performanceTier, tierIndex);
      }
      if (!tierIds.has(tier.performanceTier)) {
        issues.push({
          code: 'unknown_tier_reference',
          cardId,
          path: `${path}.tiers.${tierIndex}.performanceTier`,
          message: `unknown performance tier "${tier.performanceTier}"`,
        });
      }
      const hasRateReward = (tier.rate ?? 0) > 0;
      const hasFixedReward = (tier.fixedAmount ?? 0) > 0;
      const hasExecutableUnit = hasRateReward
        ? tier.unit === null
        : !hasFixedReward || tier.unit !== 'miles';
      if (
        rule.support?.status === 'supported' &&
        !hasExecutableUnit
      ) {
        issues.push({
          code: 'unexecutable_reward_tier',
          cardId,
          path: `${path}.tiers.${tierIndex}`,
          message:
            `supported reward tier uses unit "${String(tier.unit)}" in a ` +
            'shape the calculator cannot execute',
        });
      }
      if (
        rule.support?.status === 'supported' &&
        (tier.annualCap ?? 0) > 0
      ) {
        issues.push({
          code: 'unmodeled_annual_cap',
          cardId,
          path: `${path}.tiers.${tierIndex}.annualCap`,
          message:
            'supported reward tier has a positive annualCap, but the ' +
            'calculator has no trusted year-to-date usage facts',
        });
      }
    });

    const unmodeledRestrictions = collectUnmodeledRuleRestrictions(rule);
    if (
      rule.support?.status !== 'unsupported' &&
      unmodeledRestrictions.length > 0
    ) {
      issues.push({
        code: 'unmodeled_restriction',
        cardId,
        path,
        message:
          'material eligibility prose lacks executable predicates: ' +
          unmodeledRestrictions.join(', '),
      });
    }

    if (options.resolveMerchant && rule.support?.status !== 'unsupported') {
      for (const [merchantIndex, merchant] of (
        rule.conditions?.specificMerchants ?? []
      ).entries()) {
        const resolved = options.resolveMerchant(merchant);
        if (!ruleContainsMerchant(rule, resolved)) {
          issues.push({
            code: 'unreachable_merchant',
            cardId,
            path: `${path}.conditions.specificMerchants.${merchantIndex}`,
            message:
              `merchant "${merchant}" resolves to ` +
              `"${buildCategoryKey(resolved.category, resolved.subcategory)}", ` +
              `outside rule "${buildCategoryKey(rule.category, rule.subcategory)}"`,
          });
        }
      }
    }
  });

  const hasUnmodeledGlobalConstraints =
    (cardRule.globalConstraints.minimumAnnualSpending ?? 0) > 0 ||
    (cardRule.globalConstraints.monthlyMileageCap ?? 0) > 0 ||
    (cardRule.globalConstraints.annualBonusMileage ?? 0) > 0 ||
    (cardRule.globalConstraints.note?.trim().length ?? 0) > 0;
  if (
    hasUnmodeledGlobalConstraints &&
    cardRule.rewards.some((rule) => rule.support.status === 'supported')
  ) {
    issues.push({
      code: 'unmodeled_global_constraints',
      cardId,
      path: 'globalConstraints',
      message:
        'card has annual/mileage/prose global constraints that the monthly ' +
        'calculator cannot execute while supported rewards remain',
    });
  }

  const supportedRules = cardRule.rewards
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.support?.status !== 'unsupported');
  for (let leftIndex = 0; leftIndex < supportedRules.length; leftIndex += 1) {
    const left = supportedRules[leftIndex]!;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < supportedRules.length;
      rightIndex += 1
    ) {
      const right = supportedRules[rightIndex]!;
      if (
        left.rule.category !== right.rule.category ||
        left.rule.subcategory !== right.rule.subcategory ||
        left.rule.stackingGroup !== right.rule.stackingGroup ||
        rewardConditionSignature(left.rule) !==
          rewardConditionSignature(right.rule) ||
        !sharedPerformanceTiers(left.rule, right.rule)
      ) {
        continue;
      }
      issues.push({
        code: 'ambiguous_rule_group',
        cardId,
        path: `rewards.${right.index}`,
        message:
          `overlaps rewards.${left.index} with the same scope, conditions, ` +
          'performance tier, and stacking group',
      });
    }
  }

  return issues;
}

export function collectCardRuleIssues(
  cardRule: CardRuleSet,
  registry: CategoryRegistry,
  options: CatalogValidationOptions = {},
): CatalogValidationIssue[] {
  return collectCardRuleIssuesWithContext(
    cardRule,
    registry,
    options,
    resolveFreshnessContext(options.clock),
  );
}

export function validateCardRuleSet(
  cardRule: CardRuleSet,
  registry: CategoryRegistry,
  options: CatalogValidationOptions = {},
): void {
  const issues = collectCardRuleIssues(cardRule, registry, options);
  if (issues.length > 0) throw new CatalogValidationError(issues);
}

export function validateCardCatalog(
  cardRules: CardRuleSet[],
  registry: CategoryRegistry,
  options: CatalogValidationOptions = {},
): void {
  const issues: CatalogValidationIssue[] = [];
  const cardIds = new Set<string>();
  const freshness = resolveFreshnessContext(options.clock);

  for (const cardRule of cardRules) {
    if (cardIds.has(cardRule.card.id)) {
      issues.push({
        code: 'duplicate_card_id',
        cardId: cardRule.card.id,
        path: 'card.id',
        message: `duplicate card id "${cardRule.card.id}"`,
      });
    }
    cardIds.add(cardRule.card.id);
    issues.push(
      ...collectCardRuleIssuesWithContext(
        cardRule,
        registry,
        options,
        freshness,
      ),
    );
  }

  if (issues.length > 0) throw new CatalogValidationError(issues);
}
