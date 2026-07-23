import {
  evaluatePerformanceExclusion,
  type CardRuleSet,
  type PerformanceExclusionId,
} from '@cherrypicker/rules/browser';
import type { CalculationIssue } from '../models/result.js';
import {
  addSafeNonnegativeIntegers,
  assertSafeNonnegativeInteger,
} from '../numeric.js';
import type { PreviousSpendingBasis } from './context.js';

export interface PerformanceSpendingTransaction {
  amount: number;
  category: string;
  subcategory?: string;
  confidence?: number;
  paymentType?: 'domestic' | 'overseas';
  performanceExclusionTags?: PerformanceExclusionId[];
}

export interface PerformanceSpendingResult {
  amount: number;
  unknownExclusions: PerformanceExclusionId[];
}

export interface CardPreviousSpendingResult {
  cardPreviousSpending: Map<string, number>;
  issues: CalculationIssue[];
}

/**
 * Calculate eligible statement spending. Missing or untrusted exclusion facts
 * fail closed so an unknown exclusion can never qualify a higher tier.
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
    if (!excluded) {
      amount = addSafeNonnegativeIntegers(
        amount,
        transaction.amount,
        'eligible performance spending',
      );
    }
  }

  return unknownExclusions.size > 0
    ? { amount: 0, unknownExclusions: [...unknownExclusions].sort() }
    : { amount, unknownExclusions: [] };
}

export function resolveCardPreviousSpending(
  cardRules: readonly CardRuleSet[],
  previousTransactions: readonly PerformanceSpendingTransaction[],
  basis?: PreviousSpendingBasis,
): CardPreviousSpendingResult {
  if (basis?.kind === 'user-total') {
    assertSafeNonnegativeInteger(
      basis.amount,
      'previous spending user total',
    );
  } else if (basis?.kind === 'missing-calendar-month') {
    assertSafeNonnegativeInteger(
      basis.assumedAmount,
      'previous spending assumed amount',
    );
  }

  const cardPreviousSpending = new Map<string, number>();
  const issues: CalculationIssue[] = [];
  const totalPositiveSpending = previousTransactions.reduce((sum, transaction) => {
    if (transaction.amount <= 0) return sum;
    return addSafeNonnegativeIntegers(
      sum,
      transaction.amount,
      'previous spending total',
    );
  }, 0);

  for (const rule of cardRules) {
    if (basis?.kind === 'user-total') {
      cardPreviousSpending.set(rule.card.id, basis.amount);
      continue;
    }
    if (basis?.kind === 'missing-calendar-month') {
      cardPreviousSpending.set(rule.card.id, basis.assumedAmount);
      continue;
    }
    if (rule.performanceExclusions.length === 0) {
      cardPreviousSpending.set(rule.card.id, totalPositiveSpending);
      continue;
    }

    const performance = calculatePerformanceSpending(
      previousTransactions,
      rule.performanceExclusions,
    );
    cardPreviousSpending.set(rule.card.id, performance.amount);
    if (performance.unknownExclusions.length > 0) {
      issues.push({
        cardId: rule.card.id,
        transactionId: 'performance-basis',
        ruleId: `${rule.card.id}:performance-exclusions`,
        category: 'performance',
        reason: 'missing_performance_exclusion_fact',
        detail:
          '전월실적 제외 여부를 확인할 거래 정보가 없어 실적을 0원으로 처리했어요: ' +
          performance.unknownExclusions.join(', '),
      });
    }
  }

  return { cardPreviousSpending, issues };
}
