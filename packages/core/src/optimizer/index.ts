import type { CardRuleSet } from '@cherrypicker/rules';
import type { OptimizationResult } from '../models/result.js';
import type { OptimizationConstraints } from './constraints.js';
import { greedyOptimize } from './greedy.js';
import { ilpOptimize } from './ilp.js';

export { buildConstraints } from './constraints.js';
export type { OptimizationConstraints } from './constraints.js';
export { greedyOptimize } from './greedy.js';
export { ilpOptimize } from './ilp.js';

export type OptimizeMethod = 'greedy' | 'ilp';

export interface OptimizeOptions {
  method?: OptimizeMethod;
}

/**
 * Main optimization entry point.
 * Dispatches to the greedy or ILP solver based on options.
 * Defaults to greedy for performance; use ILP when accuracy is critical.
 */
export function optimize(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
  options: OptimizeOptions = {},
): OptimizationResult {
  const method = options.method ?? 'greedy';
  switch (method) {
    case 'ilp':
      return ilpOptimize(constraints, cardRules);
    case 'greedy':
    default:
      return greedyOptimize(constraints, cardRules);
  }
}
