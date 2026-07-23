export type RewardType = 'discount' | 'points' | 'cashback' | 'mileage';
export type RewardUnit = 'won_per_day' | 'won_per_liter' | 'mile_per_1500won' | 'miles';
import type { PerformanceExclusionId } from './performance-exclusions.js';

export type CardType = 'credit' | 'check' | 'prepaid';

export interface PerformanceTier {
  id: string;
  label: string;
  minSpending: number;
  maxSpending: number | null;
}

export interface RewardTierRate {
  performanceTier: string;
  rate: number | null;
  fixedAmount?: number | null;
  unit?: RewardUnit | null;
  value: RewardValue;
  monthlyCap: number | null;
  perTransactionCap: number | null;
  annualCap?: number | null;
}

export interface RewardConditions {
  minTransaction?: number;
  maxTransaction?: number;
  specificMerchants?: string[];
  weekdays?: number[];
  maxUses?: number;
  usePeriod?: 'day' | 'month';
  channel?: 'online' | 'offline';
  paymentType?: 'domestic' | 'overseas';
  note?: string;
}

export type RewardSupport =
  | { status: 'supported' }
  | { status: 'unsupported'; reason: string };

export type RuleCombination = 'exclusive' | 'additive';

export interface RewardValue {
  kind: 'percentage' | 'fixed_per_transaction' | 'fixed_per_day' | 'mileage_per_spend' | 'fuel_per_liter';
  amount: number;
}

export interface RewardRule {
  id: string;
  category: string;
  subcategory?: string;
  label?: string;
  type: RewardType;
  tiers: RewardTierRate[];
  conditions?: RewardConditions;
  priority: number;
  combination: RuleCombination;
  stackingGroup: string;
  capGroup: string;
  support: RewardSupport;
}

export interface CardMeta {
  id: string;
  issuer: string;
  name: string;
  nameKo: string;
  type: CardType;
  annualFee: {
    domestic: number;
    international: number;
  };
  url?: string;
  lastUpdated: string;
  source: 'manual' | 'llm-scrape' | 'web';
  discontinued?: boolean;
}

export interface GlobalConstraints {
  monthlyTotalDiscountCap: number | null;
  minimumAnnualSpending: number | null;
  monthlyMileageCap?: number;
  annualBonusMileage?: number;
  note?: string;
}

export interface CardRuleSet {
  card: CardMeta;
  performanceTiers: PerformanceTier[];
  performanceExclusions: PerformanceExclusionId[];
  rewards: RewardRule[];
  globalConstraints: GlobalConstraints;
}

export interface CategoryNode {
  id: string;
  labelKo: string;
  labelEn: string;
  keywords: string[];
  subcategories?: CategoryNode[];
}

export interface IssuerMeta {
  id: string;
  nameKo: string;
  nameEn: string;
  website: string;
}
