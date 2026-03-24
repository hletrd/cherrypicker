/**
 * ILP (Integer Linear Programming) optimizer — stub implementation.
 *
 * TODO: Integrate glpk.js for optimal ILP solving.
 *
 * ILP Formulation:
 * ─────────────────────────────────────────────────────────────────
 * Decision variables:
 *   x[i][j] ∈ {0, 1}  — 1 if card i is assigned to category j
 *
 * Objective (maximise total reward):
 *   maximize Σ_i Σ_j reward[i][j] * x[i][j]
 *
 * Constraints:
 *   1. Each category assigned to exactly one card:
 *      Σ_i x[i][j] = 1  ∀ j
 *
 *   2. Per-category monthly cap for card i, category j:
 *      reward[i][j] * x[i][j] ≤ cap_category[i][j]  ∀ i, j
 *
 *   3. Global monthly discount cap for card i:
 *      Σ_j reward[i][j] * x[i][j] ≤ globalCap[i]  ∀ i
 *
 *   4. Binary integrality:
 *      x[i][j] ∈ {0, 1}  ∀ i, j
 *
 * When glpk.js is integrated, build the LP matrix from cardRules and
 * constraints, solve with GLPK's branch-and-bound, then decode x[i][j]
 * back into CardAssignment[].
 * ─────────────────────────────────────────────────────────────────
 */

import type { CardRuleSet } from '@cherrypicker/rules';
import type { OptimizationResult } from '../models/result.js';
import type { OptimizationConstraints } from './constraints.js';
import { greedyOptimize } from './greedy.js';

/**
 * Optimal ILP optimizer.
 * Currently delegates to the greedy optimizer as a fallback until
 * glpk.js is integrated.
 */
export function ilpOptimize(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
): OptimizationResult {
  // TODO: Replace with actual ILP solver once glpk.js is integrated.
  return greedyOptimize(constraints, cardRules);
}
