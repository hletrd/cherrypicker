import type { CategorizedTransaction } from '../models/transaction.js';
import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategoryReward, CapInfo } from '../models/result.js';

export type { CategorizedTransaction };

export interface CalculationInput {
  transactions: CategorizedTransaction[];
  previousMonthSpending: number;  // 전월실적
  cardRule: CardRuleSet;
}

export interface SkippedTransaction {
  id: string;
  amount: number;
  currency: string;
  reason: 'non_krw' | 'negative_amount';
}

export type UnsupportedReason =
  | 'rule_marked_unsupported'
  | 'restriction_in_note'
  | 'missing_payment_type'
  | 'missing_channel'
  | 'missing_fuel_volume'
  | 'invalid_fuel_volume'
  | 'missing_occurrence_context'
  | 'unsupported_reward_unit';

export interface UnsupportedRule {
  cardId: string;
  transactionId: string;
  ruleId: string;
  category: string;
  reason: UnsupportedReason;
  detail?: string;
}

export interface CalculationOutput {
  cardId: string;
  performanceTier: string;
  rewards: CategoryReward[];
  totalReward: number;
  totalSpending: number;
  capsHit: CapInfo[];
  skippedTransactions: SkippedTransaction[];
  unsupportedRules: UnsupportedRule[];
}

// ---------------------------------------------------------------------------
// Shared reward calculation primitives
// ---------------------------------------------------------------------------

/** Result of a single reward calculation (discount, points, cashback, mileage). */
export interface RewardCalcResult {
  reward: number;
  newMonthUsed: number;
  capReached: boolean;
}

/**
 * Calculate a percentage-based reward for a single transaction.
 *
 * All reward types (discount, points, cashback, mileage) use the same
 * math: `floor(amount * rate)` clamped by a monthly cap. This shared
 * function eliminates the previous duplication across discount.ts,
 * points.ts, and cashback.ts.
 *
 * @param amount           - Transaction amount in Won
 * @param rate             - Reward rate (0–1, e.g. 0.05 for 5%)
 * @param monthlyCap       - Maximum total reward this calendar month in Won (null = unlimited)
 * @param currentMonthUsed - Reward already accumulated this month in Won
 */
export function calculatePercentageReward(
  amount: number,
  rate: number,
  monthlyCap: number | null,
  currentMonthUsed: number,
): RewardCalcResult {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`amount must be a non-negative safe integer, got ${amount}`);
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`rate must be a non-negative finite number, got ${rate}`);
  }
  if (!Number.isSafeInteger(currentMonthUsed) || currentMonthUsed < 0) {
    throw new Error(
      `currentMonthUsed must be a non-negative safe integer, got ${currentMonthUsed}`,
    );
  }
  if (
    monthlyCap !== null &&
    (!Number.isSafeInteger(monthlyCap) || monthlyCap < 0)
  ) {
    throw new Error(
      `monthlyCap must be null or a non-negative safe integer, got ${monthlyCap}`,
    );
  }

  const raw = Math.floor(amount * rate);
  if (!Number.isSafeInteger(raw) || raw < 0) {
    throw new Error(`calculated reward is not safely representable: ${raw}`);
  }

  if (monthlyCap === null) {
    const newMonthUsed = currentMonthUsed + raw;
    if (!Number.isSafeInteger(newMonthUsed)) {
      throw new Error(
        `monthly reward total is not safely representable: ${newMonthUsed}`,
      );
    }
    return { reward: raw, newMonthUsed, capReached: false };
  }

  const remaining = Math.max(0, monthlyCap - currentMonthUsed);
  const reward = Math.min(raw, remaining);
  const capReached = raw > remaining;

  const newMonthUsed = currentMonthUsed + reward;
  if (!Number.isSafeInteger(newMonthUsed)) {
    throw new Error(
      `monthly reward total is not safely representable: ${newMonthUsed}`,
    );
  }
  return {
    reward,
    newMonthUsed,
    capReached,
  };
}
