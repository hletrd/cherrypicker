import type { CategorizedTransaction } from '../models/transaction.js';
import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategoryReward, CapInfo } from '../models/result.js';

export type { CategorizedTransaction };

export interface CalculationInput {
  transactions: CategorizedTransaction[];
  previousMonthSpending: number;  // 전월실적
  cardRule: CardRuleSet;
}

export interface CalculationOutput {
  cardId: string;
  performanceTier: string;
  rewards: CategoryReward[];
  totalReward: number;
  totalSpending: number;
  capsHit: CapInfo[];
}
