import { z } from 'zod';
import { cardIdSchema, safeExternalUrlSchema } from './security.js';
import { PERFORMANCE_EXCLUSION_IDS } from './performance-exclusions.js';

export const rewardTypeSchema = z.enum(['discount', 'points', 'cashback', 'mileage']);

export const cardTypeSchema = z.enum(['credit', 'check', 'prepaid']);

const safeNonnegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const safeNonnegativeNumber = z.number().nonnegative().max(Number.MAX_SAFE_INTEGER);

function isIsoCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export const isoCalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO 8601 date (YYYY-MM-DD)')
  .refine(isIsoCalendarDate, 'Must be a real ISO 8601 calendar date');

export const performanceTierSchema = z.object({
  id: z.string(),
  label: z.string(),
  minSpending: safeNonnegativeInteger,
  maxSpending: safeNonnegativeInteger.nullable(),
}).strict();

const rewardUnitSchema = z.enum([
  'won_per_day',
  'won_per_liter',
  'mile_per_1500won',
  'miles',
]);

export const rewardValueSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('percentage'),
    amount: z.number().min(0).max(100),
  }).strict(),
  z.object({
    kind: z.literal('fixed_per_transaction'),
    amount: safeNonnegativeNumber,
  }).strict(),
  z.object({
    kind: z.literal('fixed_per_day'),
    amount: safeNonnegativeNumber,
  }).strict(),
  z.object({
    kind: z.literal('mileage_per_spend'),
    amount: safeNonnegativeNumber,
  }).strict(),
  z.object({
    kind: z.literal('fuel_per_liter'),
    amount: safeNonnegativeNumber,
  }).strict(),
]);

interface RewardValueSource {
  rate: number | null;
  fixedAmount: number | null;
  unit: z.infer<typeof rewardUnitSchema> | null;
}

function deriveRewardValue(
  tier: RewardValueSource,
): z.infer<typeof rewardValueSchema> {
  if (tier.rate !== null) {
    return {
      kind: tier.unit === 'miles' ? 'mileage_per_spend' : 'percentage',
      amount: tier.rate,
    };
  }
  if (tier.fixedAmount !== null) {
    return {
      kind:
        tier.unit === 'won_per_day'
          ? 'fixed_per_day'
          : tier.unit === 'won_per_liter'
            ? 'fuel_per_liter'
            : tier.unit === 'mile_per_1500won' || tier.unit === 'miles'
              ? 'mileage_per_spend'
              : 'fixed_per_transaction',
      amount: tier.fixedAmount,
    };
  }
  return { kind: 'percentage', amount: 0 };
}

function canonicalRewardRate(
  rate: number | null,
  fixedAmount: number | null,
): number | null {
  return rate === 0 && fixedAmount !== null && fixedAmount > 0
    ? null
    : rate;
}

export const rewardTierRateSchema = z.object({
  performanceTier: z.string(),
  // Authored percentage points: 5 means 5%, never the fraction 0.05.
  rate: z.number().min(0).max(100).nullable(),
  fixedAmount: safeNonnegativeNumber.nullable().optional().transform((v) => v ?? null),
  // Legacy Samsung files used fixedAmountPerLiter. It is accepted only as a
  // migration input and normalized to fixedAmount + won_per_liter below.
  fixedAmountPerLiter: safeNonnegativeInteger.optional(),
  unit: rewardUnitSchema.nullable().optional().transform((v) => v ?? null),
  monthlyCap: safeNonnegativeInteger.nullable().optional().transform((v) => v ?? null),
  perTransactionCap: safeNonnegativeInteger.nullable().optional().transform((v) => v ?? null),
  annualCap: safeNonnegativeInteger.nullable().optional().transform((v) => v ?? null),
  // Generated catalogs carry the normalized value. Accept it only when it
  // exactly agrees with the authored rate/fixed/unit fields, making the
  // canonical schema safe and idempotent for publication readers.
  value: rewardValueSchema.optional(),
}).strict().superRefine((tier, ctx) => {
  const fixedAmount = tier.fixedAmountPerLiter ?? tier.fixedAmount;
  const rate = canonicalRewardRate(tier.rate, fixedAmount);
  const unit = tier.fixedAmountPerLiter !== undefined
    ? 'won_per_liter' as const
    : tier.unit;
  if (tier.fixedAmountPerLiter !== undefined && tier.fixedAmount !== null) {
    ctx.addIssue({
      code: 'custom',
      message: 'fixedAmountPerLiter and fixedAmount are mutually exclusive',
    });
  }
  if (rate !== null && rate > 0 && fixedAmount !== null && fixedAmount > 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'rate and fixedAmount are mutually exclusive — use one or the other, not both',
    });
  }
  if (
    tier.unit !== null &&
    tier.unit !== 'miles' &&
    (fixedAmount === null || fixedAmount <= 0)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: `${tier.unit} requires a positive fixedAmount`,
    });
  }
  if (
    fixedAmount !== null &&
    tier.unit !== 'mile_per_1500won' &&
    !Number.isInteger(fixedAmount)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'fixed monetary rewards must use a safe integer amount',
    });
  }
  const derivedValue = deriveRewardValue({
    rate,
    fixedAmount,
    unit,
  });
  if (
    tier.value !== undefined &&
    (tier.value.kind !== derivedValue.kind ||
      tier.value.amount !== derivedValue.amount)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['value'],
      message:
        'value must exactly match the normalized rate, fixedAmount, and unit',
    });
  }
}).transform((tier) => {
  const fixedAmount = tier.fixedAmountPerLiter ?? tier.fixedAmount;
  const rate = canonicalRewardRate(tier.rate, fixedAmount);
  const unit = tier.fixedAmountPerLiter !== undefined ? 'won_per_liter' as const : tier.unit;
  const {
    fixedAmountPerLiter: _legacyFixedAmountPerLiter,
    value: _serializedValue,
    ...rest
  } = tier;
  const value = deriveRewardValue({
    rate,
    fixedAmount,
    unit,
  });
  return { ...rest, rate, fixedAmount, unit, value };
});

export const rewardConditionsSchema = z.object({
  minTransaction: safeNonnegativeInteger.nullable().optional().transform((v) => v ?? undefined),
  maxTransaction: safeNonnegativeInteger.nullable().optional().transform((v) => v ?? undefined),
  specificMerchants: z.array(z.string()).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  maxUses: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  usePeriod: z.enum(['day', 'month']).optional(),
  channel: z.enum(['online', 'offline']).optional(),
  paymentType: z.enum(['domestic', 'overseas']).optional(),
  note: z.string().optional(),
}).strict().superRefine((conditions, ctx) => {
  if (conditions.maxTransaction !== undefined &&
      conditions.minTransaction !== undefined &&
      conditions.maxTransaction < conditions.minTransaction) {
    ctx.addIssue({
      code: 'custom',
      message: 'maxTransaction must be greater than or equal to minTransaction',
    });
  }
  if ((conditions.maxUses === undefined) !== (conditions.usePeriod === undefined)) {
    ctx.addIssue({
      code: 'custom',
      message: 'maxUses and usePeriod must be provided together',
    });
  }
});

export const rewardSupportSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('supported') }).strict(),
  z.object({
    status: z.literal('unsupported'),
    reason: z.string().min(1),
  }).strict(),
]);

const ruleContractIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

export const rewardRuleSchema = z.object({
  id: ruleContractIdSchema,
  category: z.string(),
  subcategory: z.string().optional(),
  label: z.string().optional(),
  type: rewardTypeSchema,
  tiers: z.array(rewardTierRateSchema).min(1),
  conditions: rewardConditionsSchema.optional(),
  priority: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  combination: z.enum(['exclusive', 'additive']),
  stackingGroup: ruleContractIdSchema,
  capGroup: ruleContractIdSchema,
  support: rewardSupportSchema,
}).strict().superRefine((rule, ctx) => {
  const firstTierIndex = new Map<string, number>();
  rule.tiers.forEach((tier, index) => {
    const firstIndex = firstTierIndex.get(tier.performanceTier);
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiers', index, 'performanceTier'],
        message:
          `duplicate performance tier reference "${tier.performanceTier}" ` +
          `in reward rule "${rule.id}" (first referenced at tiers.${firstIndex})`,
      });
      return;
    }
    firstTierIndex.set(tier.performanceTier, index);
  });
});

export const cardMetaSchema = z.object({
  id: cardIdSchema,
  issuer: z.string(),
  name: z.string(),
  nameKo: z.string(),
  type: cardTypeSchema,
  annualFee: z.object({
    domestic: z.number().int().nonnegative(),
    international: z.number().int().nonnegative(),
  }),
  url: safeExternalUrlSchema.optional(),
  lastUpdated: isoCalendarDateSchema,
  source: z.enum(['manual', 'llm-scrape', 'web']),
  discontinued: z.boolean().optional(),
}).strict().superRefine((card, ctx) => {
  if (card.source === 'llm-scrape' && card.url) {
    ctx.addIssue({
      code: 'custom',
      path: ['url'],
      message:
        'llm-scrape cards cannot publish an official card URL before trusted review',
    });
  }
});

export const globalConstraintsSchema = z.object({
  monthlyTotalDiscountCap: safeNonnegativeInteger.nullable(),
  minimumAnnualSpending: safeNonnegativeInteger.nullable(),
  monthlyMileageCap: safeNonnegativeInteger.optional(),
  annualBonusMileage: safeNonnegativeInteger.optional(),
  note: z.string().optional(),
}).strict();

export const cardRuleSetSchema = z.object({
  card: cardMetaSchema,
  performanceTiers: z.array(performanceTierSchema).min(1),
  performanceExclusions: z.array(z.enum(PERFORMANCE_EXCLUSION_IDS)),
  rewards: z.array(rewardRuleSchema).min(1),
  globalConstraints: globalConstraintsSchema,
}).strict();

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
  website: safeExternalUrlSchema.refine(
    (value) => value !== '',
    'Issuer website must be an absolute HTTP(S) URL',
  ),
}).strict();

export const categoriesFileSchema = z.object({
  categories: z.array(categoryNodeSchema),
});

export const issuersFileSchema = z.object({
  issuers: z.array(issuerMetaSchema),
}).strict().superRefine((file, ctx) => {
  const seen = new Set<string>();
  file.issuers.forEach((issuer, index) => {
    if (seen.has(issuer.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['issuers', index, 'id'],
        message: `duplicate issuer id "${issuer.id}"`,
      });
    }
    seen.add(issuer.id);
  });
});

// Inferred types from schemas
export type RewardType = z.infer<typeof rewardTypeSchema>;
export type CardType = z.infer<typeof cardTypeSchema>;
export type PerformanceTier = z.infer<typeof performanceTierSchema>;
export type RewardTierRate = z.infer<typeof rewardTierRateSchema>;
export type RewardConditions = z.infer<typeof rewardConditionsSchema>;
export type RewardSupport = z.infer<typeof rewardSupportSchema>;
export type RewardRule = z.infer<typeof rewardRuleSchema>;
export type CardMeta = z.infer<typeof cardMetaSchema>;
export type GlobalConstraints = z.infer<typeof globalConstraintsSchema>;
export type CardRuleSet = z.infer<typeof cardRuleSetSchema>;
export type CategoryNode = z.infer<typeof categoryNodeSchema>;
export type IssuerMeta = z.infer<typeof issuerMetaSchema>;
