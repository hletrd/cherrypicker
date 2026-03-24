import { z } from 'zod';

export const rewardTypeSchema = z.enum(['discount', 'points', 'cashback', 'mileage']);

export const cardTypeSchema = z.enum(['credit', 'check']);

export const performanceTierSchema = z.object({
  id: z.string(),
  label: z.string(),
  minSpending: z.number().int().nonnegative(),
  maxSpending: z.number().int().nonnegative().nullable(),
});

export const rewardTierRateSchema = z.object({
  performanceTier: z.string(),
  rate: z.number().nonnegative().nullable().transform((v) => v ?? 0),
  monthlyCap: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? null),
  perTransactionCap: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? null),
});

export const rewardConditionsSchema = z.object({
  minTransaction: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? undefined).pipe(z.number().int().nonnegative().optional()),
  excludeOnline: z.boolean().optional(),
  specificMerchants: z.array(z.string()).optional(),
});

export const rewardRuleSchema = z.object({
  category: z.string(),
  type: rewardTypeSchema,
  tiers: z.array(rewardTierRateSchema).min(1),
  conditions: rewardConditionsSchema.optional(),
});

export const cardMetaSchema = z.object({
  id: z.string(),
  issuer: z.string(),
  name: z.string(),
  nameKo: z.string(),
  type: cardTypeSchema,
  annualFee: z.object({
    domestic: z.number().int().nonnegative(),
    international: z.number().int().nonnegative(),
  }),
  url: z.string().url().optional(),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO 8601 date (YYYY-MM-DD)'),
  source: z.enum(['manual', 'llm-scrape']),
});

export const globalConstraintsSchema = z.object({
  monthlyTotalDiscountCap: z.number().int().nonnegative().nullable(),
  minimumAnnualSpending: z.number().int().nonnegative().nullable(),
});

export const cardRuleSetSchema = z.object({
  card: cardMetaSchema,
  performanceTiers: z.array(performanceTierSchema).min(1),
  performanceExclusions: z.array(z.string()),
  rewards: z.array(rewardRuleSchema).min(1),
  globalConstraints: globalConstraintsSchema,
});

export const categoryNodeSchema: z.ZodType<{
  id: string;
  labelKo: string;
  labelEn: string;
  keywords: string[];
  subcategories?: Array<{
    id: string;
    labelKo: string;
    labelEn: string;
    keywords: string[];
    subcategories?: unknown[];
  }>;
}> = z.object({
  id: z.string(),
  labelKo: z.string(),
  labelEn: z.string(),
  keywords: z.array(z.string()),
  subcategories: z.array(z.lazy(() => categoryNodeSchema)).optional(),
});

export const issuerMetaSchema = z.object({
  id: z.string(),
  nameKo: z.string(),
  nameEn: z.string(),
  website: z.string().url(),
});

export const categoriesFileSchema = z.object({
  categories: z.array(categoryNodeSchema),
});

export const issuersFileSchema = z.object({
  issuers: z.array(issuerMetaSchema),
});

// Inferred types from schemas
export type RewardType = z.infer<typeof rewardTypeSchema>;
export type CardType = z.infer<typeof cardTypeSchema>;
export type PerformanceTier = z.infer<typeof performanceTierSchema>;
export type RewardTierRate = z.infer<typeof rewardTierRateSchema>;
export type RewardConditions = z.infer<typeof rewardConditionsSchema>;
export type RewardRule = z.infer<typeof rewardRuleSchema>;
export type CardMeta = z.infer<typeof cardMetaSchema>;
export type GlobalConstraints = z.infer<typeof globalConstraintsSchema>;
export type CardRuleSet = z.infer<typeof cardRuleSetSchema>;
export type CategoryNode = z.infer<typeof categoryNodeSchema>;
export type IssuerMeta = z.infer<typeof issuerMetaSchema>;
