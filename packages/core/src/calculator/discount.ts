export interface RewardCalcResult {
  reward: number;
  newMonthUsed: number;
  capReached: boolean;
}

/**
 * Calculate a discount reward for a single transaction.
 * Amounts are all in Korean Won (integer).
 *
 * @param amount        - Transaction amount in Won
 * @param rate          - Discount rate (0–1, e.g. 0.05 for 5%)
 * @param monthlyCap    - Maximum total discount this calendar month (null = unlimited)
 * @param currentMonthUsed - Discount already accumulated this month
 */
export function calculateDiscount(
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
