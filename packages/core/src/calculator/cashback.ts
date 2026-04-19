import { calculatePercentageReward } from './types.js';
export type { RewardCalcResult } from './types.js';

/**
 * Calculate cashback reward for a single transaction.
 * Cashback is returned as Korean Won.
 * Delegates to the shared `calculatePercentageReward`.
 *
 * @param amount        - Transaction amount in Won
 * @param rate          - Cashback rate (0–1, e.g. 0.03 for 3%)
 * @param monthlyCap    - Maximum total cashback this calendar month in Won (null = unlimited)
 * @param currentMonthUsed - Cashback already accumulated this month in Won
 */
export const calculateCashback = calculatePercentageReward;
