import type { CardRuleSet } from '@cherrypicker/rules';
import type { OptimizationResult } from '../models/result.js';
import type { OptimizationConstraints } from './constraints.js';
import { greedyOptimize } from './greedy.js';

export { buildConstraints } from './constraints.js';
export type { OptimizationConstraints } from './constraints.js';
export { greedyOptimize } from './greedy.js';

export type OptimizeMethod = 'greedy';

export interface OptimizeOptions {
  method?: OptimizeMethod;
}

/**
 * Main optimization entry point.
 * Uses the greedy solver for fast, high-quality card recommendations.
 */
export function optimize(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
  options: OptimizeOptions = {},
): OptimizationResult {
  const method = options.method ?? 'greedy';
  switch (method) {
    case 'greedy':
    default:
      return greedyOptimize(constraints, cardRules);
  }
}
