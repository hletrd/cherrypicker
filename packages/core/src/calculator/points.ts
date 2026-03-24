export interface RewardCalcResult {
  reward: number;
  newMonthUsed: number;
  capReached: boolean;
}

/**
 * Calculate points reward for a single transaction.
 * Points are expressed as Won-equivalent value (1 point = 1 Won unless card specifies otherwise).
 *
 * @param amount        - Transaction amount in Won
 * @param rate          - Points rate (0–1, e.g. 0.01 for 1%)
 * @param monthlyCap    - Maximum total points this calendar month in Won-equivalent (null = unlimited)
 * @param currentMonthUsed - Points already accumulated this month in Won-equivalent
 */
export function calculatePoints(
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
