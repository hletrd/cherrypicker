export type RewardType = 'discount' | 'points' | 'cashback' | 'mileage';

export type CardType = 'credit' | 'check';

export interface PerformanceTier {
  id: string;
  label: string;
  minSpending: number;
  maxSpending: number | null;
}

export interface RewardTierRate {
  performanceTier: string;
  rate: number;
  monthlyCap: number | null;
  perTransactionCap: number | null;
}

export interface RewardConditions {
  minTransaction?: number;
  excludeOnline?: boolean;
  specificMerchants?: string[];
}

export interface RewardRule {
  category: string;
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
  source: 'manual' | 'llm-scrape';
}

export interface GlobalConstraints {
  monthlyTotalDiscountCap: number | null;
  minimumAnnualSpending: number | null;
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
