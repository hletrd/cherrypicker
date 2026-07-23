import { calculatePercentageReward } from './types.js';
export type { RewardCalcResult } from './types.js';

/**
 * Calculate points reward for a single transaction.
 * Points are expressed as Won-equivalent value (1 point = 1 Won unless card specifies otherwise).
 * Delegates to the shared `calculatePercentageReward`.
 *
 * @param amount        - Transaction amount in Won
 * @param percentagePoints - Points rate in percentage points (e.g. 1 for 1%)
 * @param monthlyCap    - Maximum total points this calendar month in Won-equivalent (null = unlimited)
 * @param currentMonthUsed - Points already accumulated this month in Won-equivalent
 */
export const calculatePoints = calculatePercentageReward;
