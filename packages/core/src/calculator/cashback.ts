export interface RewardCalcResult {
  reward: number;
  newMonthUsed: number;
  capReached: boolean;
}

/**
 * Calculate cashback reward for a single transaction.
 * Cashback is returned as Korean Won.
 *
 * @param amount        - Transaction amount in Won
 * @param rate          - Cashback rate (0–1, e.g. 0.03 for 3%)
 * @param monthlyCap    - Maximum total cashback this calendar month in Won (null = unlimited)
 * @param currentMonthUsed - Cashback already accumulated this month in Won
 */
export function calculateCashback(
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
