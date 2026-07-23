import type { CardRuleSet } from './types.js';

/**
 * Discontinued cards remain part of the catalog for historical/detail views,
 * but they are not eligible for a new recommendation.
 */
export function isRecommendationEligibleCard(
  cardRule: CardRuleSet,
): boolean {
  return cardRule.card.discontinued !== true;
}

/**
 * Optimization requires at least one reward rule the calculator can execute.
 *
 * This is intentionally narrower than catalog/recommendation visibility:
 * active cards whose benefits are entirely unsupported remain browseable,
 * but cannot win an optimizer score they did not actually earn.
 */
export function isOptimizationExecutableCard(
  cardRule: CardRuleSet,
): boolean {
  return (
    isRecommendationEligibleCard(cardRule) &&
    cardRule.rewards.some((reward) => reward.support?.status === 'supported')
  );
}
