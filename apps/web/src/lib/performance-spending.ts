import {
  evaluatePerformanceExclusion,
  type PerformanceExclusionId,
} from '@cherrypicker/rules/browser';

export interface PerformanceSpendingTransaction {
  amount: number;
  category: string;
  subcategory?: string;
  paymentType?: 'domestic' | 'overseas';
  performanceExclusionTags?: PerformanceExclusionId[];
}

export interface PerformanceSpendingResult {
  amount: number;
  unknownExclusions: PerformanceExclusionId[];
}

/**
 * Calculate a card's eligible previous-month spending. If even one required
 * non-category fact is missing, return zero rather than risking a falsely
 * qualified performance tier.
 */
export function calculatePerformanceSpending(
  transactions: readonly PerformanceSpendingTransaction[],
  exclusions: readonly PerformanceExclusionId[],
): PerformanceSpendingResult {
  let amount = 0;
  const unknownExclusions = new Set<PerformanceExclusionId>();

  for (const transaction of transactions) {
    if (transaction.amount <= 0) continue;
    let excluded = false;
    for (const exclusion of exclusions) {
      const outcome = evaluatePerformanceExclusion(transaction, exclusion);
      if (outcome === 'unknown') {
        unknownExclusions.add(exclusion);
      } else if (outcome === 'excluded') {
        excluded = true;
      }
    }
    if (!excluded) amount += transaction.amount;
  }

  return unknownExclusions.size > 0
    ? { amount: 0, unknownExclusions: [...unknownExclusions].sort() }
    : { amount, unknownExclusions: [] };
}
