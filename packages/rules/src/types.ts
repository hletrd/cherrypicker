export type RewardType = 'discount' | 'points' | 'cashback' | 'mileage';
export type RewardUnit = string;

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
  unit?: string | null;
  monthlyCap: number | null;
  perTransactionCap: number | null;
}

export interface RewardConditions {
  minTransaction?: number;
  excludeOnline?: boolean;
  specificMerchants?: string[];
  note?: string;
  [key: string]: unknown;
}

export interface RewardRule {
  category: string;
  subcategory?: string;
  label?: string;
  type: RewardType;
  tiers: RewardTierRate[];
  conditions?: RewardConditions;
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
}

export interface GlobalConstraints {
  monthlyTotalDiscountCap: number | null;
  minimumAnnualSpending: number | null;
  note?: string;
  [key: string]: unknown;
}

export interface CardRuleSet {
  card: CardMeta;
  performanceTiers: PerformanceTier[];
  performanceExclusions: string[];
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
