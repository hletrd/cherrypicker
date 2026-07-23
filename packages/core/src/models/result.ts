export interface CardRewardResult {
  cardId: string;
  cardName: string;
  totalReward: number;          // Total Won value of rewards
  totalSpending: number;
  effectiveRate: number;        // totalReward / totalSpending
  byCategory: CategoryReward[];
  performanceTier: string;      // Which tier the user qualifies for
  capsHit: CapInfo[];           // Which caps were reached
  unsupportedRules?: CalculationIssue[];
}

export interface CategoryReward {
  category: string;
  categoryNameKo: string;
  spending: number;
  reward: number;
  rate: number;                 // Effective rate for this category
  rewardType: string;           // discount/points/cashback/mileage/none
  capReached: boolean;
  capAmount?: number;
}

export interface CapInfo {
  category: string;
  capType: 'monthly_category' | 'monthly_total' | 'per_transaction';
  capAmount: number;
  actualReward: number;        // What you would get without cap
  appliedReward: number;       // What you actually get
}

export interface CalculationIssue {
  cardId: string;
  transactionId: string;
  ruleId: string;
  category: string;
  reason: string;
  detail?: string;
}

export interface OptimizationResult {
  assignments: CardAssignment[];
  totalReward: number;
  /** All positive KRW spending analyzed, assigned or not. */
  totalSpending: number;
  /** Positive KRW spending for which no executable card earned a positive reward. */
  unassignedSpending: number;
  /** Number of positive KRW transactions represented by unassignedSpending. */
  unassignedTransactionCount: number;
  effectiveRate: number;
  savingsVsSingleCard: number;    // vs best single card
  /** Null when no executable card earns a positive reward for the input. */
  bestSingleCard: {
    cardId: string;
    cardName: string;
    totalReward: number;
  } | null;
  cardResults: CardRewardResult[];
  unsupportedRules?: CalculationIssue[];
}

export interface CardAssignment {
  category: string;
  categoryNameKo: string;
  assignedCardId: string;
  assignedCardName: string;
  spending: number;
  reward: number;
  rate: number;
  alternatives: { cardId: string; cardName: string; reward: number; rate: number }[];
}
