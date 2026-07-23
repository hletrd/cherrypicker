export const PERFORMANCE_EXCLUSION_IDS = [
  'annual_fee',
  'apartment_fee',
  'apartment_mgmt',
  'gift_card',
  'gift_card_purchase',
  'insurance',
  'long_term_loan',
  'overseas',
  'public_transit',
  'short_term_loan',
  'tax_payment',
  'telecom',
  'tuition',
  'utility_bills',
] as const;

export type PerformanceExclusionId =
  (typeof PERFORMANCE_EXCLUSION_IDS)[number];

export type PerformanceExclusionDescriptor =
  | {
      kind: 'category';
      category: string;
      subcategory?: string;
    }
  | {
      kind: 'payment_type';
      paymentType: 'overseas';
    }
  | {
      kind: 'statement_tag';
      tag:
        | 'annual_fee'
        | 'gift_card'
        | 'gift_card_purchase'
        | 'long_term_loan'
        | 'short_term_loan'
        | 'tax_payment';
    };

export interface PerformanceExclusionFacts {
  category: string;
  subcategory?: string;
  paymentType?: 'domestic' | 'overseas';
  performanceExclusionTags?: readonly PerformanceExclusionId[];
}

export type PerformanceExclusionOutcome =
  | 'excluded'
  | 'included'
  | 'unknown';

/**
 * Performance exclusions are not all merchant categories. This table makes
 * that distinction executable: category exclusions can use categorization,
 * overseas requires payment provenance, and statement-only concepts require
 * an explicit parser/user tag. Missing facts must be treated as unknown.
 */
export const PERFORMANCE_EXCLUSION_CONTRACT: Readonly<
  Record<PerformanceExclusionId, PerformanceExclusionDescriptor>
> = {
  annual_fee: { kind: 'statement_tag', tag: 'annual_fee' },
  apartment_fee: {
    kind: 'category',
    category: 'utilities',
    subcategory: 'apartment_mgmt',
  },
  apartment_mgmt: {
    kind: 'category',
    category: 'utilities',
    subcategory: 'apartment_mgmt',
  },
  gift_card: { kind: 'statement_tag', tag: 'gift_card' },
  gift_card_purchase: {
    kind: 'statement_tag',
    tag: 'gift_card_purchase',
  },
  insurance: { kind: 'category', category: 'insurance' },
  long_term_loan: { kind: 'statement_tag', tag: 'long_term_loan' },
  overseas: { kind: 'payment_type', paymentType: 'overseas' },
  public_transit: { kind: 'category', category: 'public_transit' },
  short_term_loan: { kind: 'statement_tag', tag: 'short_term_loan' },
  tax_payment: { kind: 'statement_tag', tag: 'tax_payment' },
  telecom: { kind: 'category', category: 'telecom' },
  tuition: { kind: 'category', category: 'education' },
  utility_bills: { kind: 'category', category: 'utilities' },
};

const PERFORMANCE_EXCLUSION_ID_SET = new Set<string>(
  PERFORMANCE_EXCLUSION_IDS,
);

export function isPerformanceExclusionId(
  value: string,
): value is PerformanceExclusionId {
  return PERFORMANCE_EXCLUSION_ID_SET.has(value);
}

export function getPerformanceExclusionDescriptor(
  value: string,
): PerformanceExclusionDescriptor | undefined {
  return isPerformanceExclusionId(value)
    ? PERFORMANCE_EXCLUSION_CONTRACT[value]
    : undefined;
}

export function evaluatePerformanceExclusion(
  facts: PerformanceExclusionFacts,
  exclusion: PerformanceExclusionId,
): PerformanceExclusionOutcome {
  const descriptor = PERFORMANCE_EXCLUSION_CONTRACT[exclusion];
  if (descriptor.kind === 'category') {
    if (facts.category !== descriptor.category) return 'included';
    if (
      descriptor.subcategory !== undefined &&
      facts.subcategory !== descriptor.subcategory
    ) {
      return 'included';
    }
    return 'excluded';
  }
  if (descriptor.kind === 'payment_type') {
    if (!facts.paymentType) return 'unknown';
    return facts.paymentType === descriptor.paymentType
      ? 'excluded'
      : 'included';
  }
  if (!facts.performanceExclusionTags) return 'unknown';
  return facts.performanceExclusionTags.includes(exclusion)
    ? 'excluded'
    : 'included';
}
