// Models
export type { Transaction, CategorizedTransaction } from './models/transaction.js';
export type { CardMeta, CardRuleSet } from './models/card.js';
export type {
  CardRewardResult,
  CategoryReward,
  CapInfo,
  OptimizationResult,
  CardAssignment,
  CalculationIssue,
} from './models/result.js';

// Categorizer
export {
  CategoryTaxonomy,
  TAXONOMY_KEYWORD_OVERRIDES,
} from './categorizer/taxonomy.js';
export type { TaxonomyKeywordConflict } from './categorizer/taxonomy.js';
export { MerchantMatcher } from './categorizer/matcher.js';
export { getResolvedKeywordConflicts } from './categorizer/matcher.js';
export type { KeywordConflict } from './categorizer/matcher.js';
export { normalizeMerchantText } from './categorizer/normalize.js';
export { MERCHANT_KEYWORDS } from './categorizer/keywords.js';

// Analysis context
export {
  buildAnalysisContext,
  isValidIsoDate,
  isYearMonth,
  previousCalendarMonth,
  sumMonthlySpending,
  yearMonthOfDate,
} from './analysis/context.js';
export type {
  AnalysisContext,
  DatedAmount,
  MonthlyBreakdown,
  PreviousSpendingBasis,
  YearMonth,
} from './analysis/context.js';
export {
  calculatePerformanceSpending,
  resolveCardPreviousSpending,
} from './analysis/performance.js';
export type {
  CardPreviousSpendingResult,
  PerformanceSpendingResult,
  PerformanceSpendingTransaction,
} from './analysis/performance.js';

// Calculator
export {
  calculateRewards,
  buildCategoryKey,
  isRewardEligibleTransaction,
} from './calculator/reward.js';
export { calculateDiscount } from './calculator/discount.js';
export { calculatePoints } from './calculator/points.js';
export { calculateCashback } from './calculator/cashback.js';
export type {
  CalculationInput,
  CalculationOutput,
  UnsupportedReason,
  UnsupportedRule,
} from './calculator/types.js';

// Optimizer
export { optimize, greedyOptimize, buildConstraints } from './optimizer/index.js';
export type { OptimizationConstraints, OptimizeOptions, OptimizeMethod } from './optimizer/index.js';
