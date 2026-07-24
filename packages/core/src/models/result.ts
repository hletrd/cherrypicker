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
  /** @deprecated Legacy persisted input only. Read capsHit for cap details. */
  capAmount?: number;
}

export interface CapInfo {
  category: string;
  capType: 'monthly_category' | 'monthly_total' | 'per_transaction';
  capAmount: number;
  actualReward: number;        // What you would get without cap
  appliedReward: number;       // What you actually get
  /** Stable source rule identity for rule-scoped caps. */
  ruleId?: string;
  /** Shared accounting identity for rule-scoped caps. */
  capGroup?: string;
}

/**
 * A single cap stage that reduced an otherwise executable reward.
 *
 * Unlike CapInfo, this identifies the source rule even for a card-global cap:
 * it is diagnostic input for same-card and cross-card reconciliation, not a
 * reach event attached to an assigned card result.
 */
export interface CapSuppressionCause {
  ruleId: string;
  capGroup: string;
  capType: CapInfo['capType'];
  capAmount: number;
  rewardBeforeCap: number;
  rewardAfterCap: number;
}

/**
 * One exactly reconciled cap loss after same-card fallbacks and executable
 * card replacements. If stateful maxUses/fixed-per-day opportunities cannot
 * be reconciled jointly, the enclosing collection is undefined instead.
 */
export interface PortfolioCapLoss {
  transactionId: string;
  /**
   * Zero-based occurrence among reward-eligible transactions with the same
   * transaction ID and category in canonical optimizer order.
   */
  transactionOccurrence: number;
  category: string;
  counterfactualCardId: string;
  counterfactualCardName: string;
  selectedCardId: string | null;
  selectedCardName: string | null;
  counterfactualReward: number;
  selectedReward: number;
  grossSuppressedReward: number;
  replacementReward: number;
  netLostReward: number;
  causes: CapSuppressionCause[];
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
  /**
   * Present on fresh optimizer output only when every loss is jointly
   * reconcilable and exactly representable. Undefined means "unknown", not
   * "no loss": it covers pre-telemetry v4 results, unsafe counterfactual
   * arithmetic, and cross-card/unassigned stateful opportunities whose
   * maxUses or fixed-per-day histories cannot be expressed by independent
   * positive transaction rows.
   */
  portfolioCapLosses?: PortfolioCapLoss[];
}

export interface CardAssignment {
  category: string;
  categoryNameKo: string;
  assignedCardId: string;
  assignedCardName: string;
  spending: number;
  /** Exact number of positive transactions represented by this assignment. */
  transactionCount: number;
  reward: number;
  rate: number;
  alternatives: { cardId: string; cardName: string; reward: number; rate: number }[];
}
