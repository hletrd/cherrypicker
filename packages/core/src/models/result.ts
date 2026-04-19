export interface CardRewardResult {
  cardId: string;
  cardName: string;
  totalReward: number;          // Total Won value of rewards
  totalSpending: number;
  effectiveRate: number;        // totalReward / totalSpending
  byCategory: CategoryReward[];
  performanceTier: string;      // Which tier the user qualifies for
  capsHit: CapInfo[];           // Which caps were reached
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

export interface OptimizationResult {
  assignments: CardAssignment[];
  totalReward: number;
  totalSpending: number;
  effectiveRate: number;
  savingsVsSingleCard: number;    // vs best single card
  bestSingleCard: { cardId: string; cardName: string; totalReward: number };
  cardResults: CardRewardResult[];
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
