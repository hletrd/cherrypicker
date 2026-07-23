import { calculatePercentageReward } from './types.js';
export type { RewardCalcResult } from './types.js';

/**
 * Calculate a discount reward for a single transaction.
 * Delegates to the shared `calculatePercentageReward`.
 *
 * @param amount        - Transaction amount in Won
 * @param percentagePoints - Discount rate in percentage points (e.g. 5 for 5%)
 * @param monthlyCap    - Maximum total discount this calendar month (null = unlimited)
 * @param currentMonthUsed - Discount already accumulated this month
 */
export const calculateDiscount = calculatePercentageReward;
