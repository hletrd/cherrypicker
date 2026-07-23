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
