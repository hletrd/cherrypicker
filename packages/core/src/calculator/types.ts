import type { CategorizedTransaction } from '../models/transaction.js';
import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategoryReward, CapInfo } from '../models/result.js';

export type { CategorizedTransaction };

export interface CalculationInput {
  transactions: CategorizedTransaction[];
  previousMonthSpending: number;  // 전월실적
  cardRule: CardRuleSet;
}

export interface CalculationOutput {
  cardId: string;
  performanceTier: string;
  rewards: CategoryReward[];
  totalReward: number;
  totalSpending: number;
  capsHit: CapInfo[];
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
  const raw = Math.floor(amount * rate);

  if (monthlyCap === null) {
    return { reward: raw, newMonthUsed: currentMonthUsed + raw, capReached: false };
  }

  const remaining = Math.max(0, monthlyCap - currentMonthUsed);
  const reward = Math.min(raw, remaining);
  const capReached = raw > remaining;

  return {
    reward,
    newMonthUsed: currentMonthUsed + reward,
    capReached,
  };
}
