// Models
export type { Transaction, CategorizedTransaction } from './models/transaction.js';
export type { CardMeta, CardRuleSet } from './models/card.js';
export type {
  CardRewardResult,
  CategoryReward,
  CapInfo,
  OptimizationResult,
  CardAssignment,
} from './models/result.js';

// Categorizer
export { CategoryTaxonomy } from './categorizer/taxonomy.js';
export { MerchantMatcher } from './categorizer/matcher.js';
export { MERCHANT_KEYWORDS } from './categorizer/keywords.js';

// Calculator
export { calculateRewards } from './calculator/reward.js';
export { calculateDiscount } from './calculator/discount.js';
export { calculatePoints } from './calculator/points.js';
export { calculateCashback } from './calculator/cashback.js';
export type { CalculationInput, CalculationOutput } from './calculator/types.js';

// Optimizer
export { optimize, greedyOptimize, ilpOptimize, buildConstraints } from './optimizer/index.js';
export type { OptimizationConstraints, OptimizeOptions, OptimizeMethod } from './optimizer/index.js';
