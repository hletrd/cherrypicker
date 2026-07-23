// Browser-safe rules surface. Keep Node-only filesystem loaders out of this
// module so browser bundlers never traverse `node:fs/promises`.
export type {
  RewardType,
  RewardUnit,
  CardType,
  PerformanceTier,
  RewardTierRate,
  RewardConditions,
  RewardSupport,
  RewardValue,
  RuleCombination,
  RewardRule,
  CardMeta,
  GlobalConstraints,
  CardRuleSet,
  CategoryNode,
  IssuerMeta,
} from './types.js';

export {
  rewardTypeSchema,
  cardTypeSchema,
  performanceTierSchema,
  rewardValueSchema,
  rewardTierRateSchema,
  rewardConditionsSchema,
  rewardSupportSchema,
  rewardRuleSchema,
  isoCalendarDateSchema,
  cardMetaSchema,
  globalConstraintsSchema,
  cardRuleSetSchema,
  categoryNodeSchema,
  issuerMetaSchema,
  categoriesFileSchema,
  issuersFileSchema,
} from './schema.js';

export {
  optimizerCatalogArtifactSchema,
  parseOptimizerCatalogArtifact,
} from './optimizer-artifact.js';
export type { OptimizerCatalogArtifact } from './optimizer-artifact.js';

export {
  SCRAPER_ISSUERS,
  CARD_ID_PATTERN,
  CARD_ID_MAX_LENGTH,
  cardIdSchema,
  safeExternalUrl,
  safeExternalUrlSchema,
} from './security.js';
export type { ScraperIssuer } from './security.js';

export {
  buildCategoryNamesKo,
  buildCategoryLabelMap,
} from './category-names.js';

export {
  CategoryRegistry,
  buildCategoryKey,
  canonicalizeCategory,
} from './category-contract.js';
export type {
  CanonicalCategory,
  CategoryResolution,
  ResolveCategoryOptions,
} from './category-contract.js';

export {
  CatalogValidationError,
  collectCardFreshnessIssues,
  collectCardRuleIssues,
  validateCardRuleSet,
  validateCardCatalog,
} from './catalog-validation.js';
export type {
  CatalogIssueCode,
  CatalogClock,
  CatalogValidationIssue,
  CatalogValidationOptions,
} from './catalog-validation.js';

export {
  PERFORMANCE_EXCLUSION_IDS,
  PERFORMANCE_EXCLUSION_CONTRACT,
  isPerformanceExclusionId,
  getPerformanceExclusionDescriptor,
  evaluatePerformanceExclusion,
} from './performance-exclusions.js';
export type {
  PerformanceExclusionId,
  PerformanceExclusionDescriptor,
  PerformanceExclusionFacts,
  PerformanceExclusionOutcome,
} from './performance-exclusions.js';

export {
  collectUnmodeledRuleRestrictions,
  rewardConditionSignature,
  sharedPerformanceTiers,
} from './rule-semantics.js';
export type { UnmodeledRestrictionReason } from './rule-semantics.js';

export {
  isOptimizationExecutableCard,
  isRecommendationEligibleCard,
} from './card-availability.js';
