import { calculatePercentageReward } from './types.js';
export type { RewardCalcResult } from './types.js';

/**
 * Calculate a discount reward for a single transaction.
 * Delegates to the shared `calculatePercentageReward`.
 *
 * @param amount        - Transaction amount in Won
 * @param rate          - Discount rate (0–1, e.g. 0.05 for 5%)
 * @param monthlyCap    - Maximum total discount this calendar month (null = unlimited)
 * @param currentMonthUsed - Discount already accumulated this month
 */
export const calculateDiscount = calculatePercentageReward;
