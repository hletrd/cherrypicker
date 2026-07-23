export const PERFORMANCE_EXCLUSION_TAGS = [
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

export type ParsedPerformanceExclusionTag =
  (typeof PERFORMANCE_EXCLUSION_TAGS)[number];
export type ParsedFactSource = 'statement' | 'user';
export type ParsedFactKey =
  | 'paymentType'
  | 'channel'
  | 'fuelVolumeLiters'
  | 'performanceExclusionTags';

export interface ParsedTransactionFacts {
  paymentType?: 'domestic' | 'overseas';
  channel?: 'online' | 'offline';
  fuelVolumeLiters?: number;
  performanceExclusionTags?: ParsedPerformanceExclusionTag[];
  factProvenance?: Partial<Record<ParsedFactKey, ParsedFactSource>>;
}

export interface ExtractedTransactionFacts {
  facts: ParsedTransactionFacts;
  errors: string[];
}

/**
 * Upper bound for a single consumer fuel purchase.
 *
 * 200 L covers passenger vehicles and light commercial vehicles while keeping
 * statement facts outside bulk/commercial delivery volumes. The same bound is
 * used by parser and persistence handoffs before facts reach reward math.
 */
export const MAX_CONSUMER_FUEL_VOLUME_LITERS = 200;

export function isValidFuelVolumeLiters(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_CONSUMER_FUEL_VOLUME_LITERS
  );
}

const PAYMENT_TYPE_ALIASES = [
  'paymentType',
  'payment_type',
  'domesticOverseas',
  'domestic_overseas',
  '국내외',
  '결제지역',
];
const CHANNEL_ALIASES = [
  'channel',
  'paymentChannel',
  'payment_channel',
  'onlineOffline',
  'online_offline',
  '이용채널',
  '결제채널',
  '온오프라인',
];
const FUEL_VOLUME_ALIASES = [
  'fuelVolumeLiters',
  'fuel_volume_liters',
  'liters',
  'litres',
  '주유량',
  '주유리터',
];
const PERFORMANCE_TAG_ALIASES = [
  'performanceExclusionTags',
  'performance_exclusion_tags',
  'statementTags',
  'statement_tags',
  '실적제외태그',
];

const PERFORMANCE_TAG_SET = new Set<string>(PERFORMANCE_EXCLUSION_TAGS);

function findField(
  object: Readonly<Record<string, unknown>>,
  aliases: readonly string[],
): unknown {
  for (const alias of aliases) {
    if (Object.hasOwn(object, alias)) return object[alias];
  }
  const lowerKeys = new Map(
    Object.entries(object).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const alias of aliases) {
    if (lowerKeys.has(alias.toLowerCase())) {
      return lowerKeys.get(alias.toLowerCase());
    }
  }
  return undefined;
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en-US');
}

function parsePaymentType(
  value: unknown,
): 'domestic' | 'overseas' | undefined {
  const token = normalizeToken(value);
  if (['domestic', 'local', 'kr', 'korea', '국내'].includes(token)) {
    return 'domestic';
  }
  if (
    ['overseas', 'foreign', 'international', 'abroad', '해외', '국외'].includes(
      token,
    )
  ) {
    return 'overseas';
  }
  return undefined;
}

function parseChannel(value: unknown): 'online' | 'offline' | undefined {
  const token = normalizeToken(value);
  if (['online', 'web', 'app', '온라인'].includes(token)) return 'online';
  if (['offline', 'store', 'in-store', '오프라인', '매장'].includes(token)) {
    return 'offline';
  }
  return undefined;
}

function parseFuelVolume(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value.replaceAll(',', '').trim());
  return isValidFuelVolumeLiters(parsed) ? parsed : undefined;
}

function parsePerformanceTags(
  value: unknown,
): {
  tags?: ParsedPerformanceExclusionTag[];
  invalid: string[];
} {
  const supportedInput = Array.isArray(value) || typeof value === 'string';
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,|]+/)
      : [];
  const tags: ParsedPerformanceExclusionTag[] = [];
  const invalid: string[] = [];
  for (const item of values) {
    const token = normalizeToken(item);
    if (!token) continue;
    if (PERFORMANCE_TAG_SET.has(token)) {
      if (!tags.includes(token as ParsedPerformanceExclusionTag)) {
        tags.push(token as ParsedPerformanceExclusionTag);
      }
    } else {
      invalid.push(token);
    }
  }
  return {
    tags:
      supportedInput && (tags.length > 0 || invalid.length === 0)
        ? tags
        : undefined,
    invalid,
  };
}

export function extractTransactionFacts(
  object: Readonly<Record<string, unknown>>,
): ExtractedTransactionFacts {
  const facts: ParsedTransactionFacts = {};
  const provenance: NonNullable<ParsedTransactionFacts['factProvenance']> = {};
  const errors: string[] = [];

  const paymentTypeValue = findField(object, PAYMENT_TYPE_ALIASES);
  if (paymentTypeValue !== undefined) {
    const paymentType = parsePaymentType(paymentTypeValue);
    if (paymentType) {
      facts.paymentType = paymentType;
      provenance.paymentType = 'statement';
    } else {
      errors.push(`결제 지역 값을 해석할 수 없습니다: ${String(paymentTypeValue)}`);
    }
  }

  const channelValue = findField(object, CHANNEL_ALIASES);
  if (channelValue !== undefined) {
    const channel = parseChannel(channelValue);
    if (channel) {
      facts.channel = channel;
      provenance.channel = 'statement';
    } else {
      errors.push(`결제 채널 값을 해석할 수 없습니다: ${String(channelValue)}`);
    }
  }

  const fuelValue = findField(object, FUEL_VOLUME_ALIASES);
  if (fuelValue !== undefined) {
    const fuelVolumeLiters = parseFuelVolume(fuelValue);
    if (fuelVolumeLiters !== undefined) {
      facts.fuelVolumeLiters = fuelVolumeLiters;
      provenance.fuelVolumeLiters = 'statement';
    } else {
      errors.push(`주유량 값을 해석할 수 없습니다: ${String(fuelValue)}`);
    }
  }

  const tagsValue = findField(object, PERFORMANCE_TAG_ALIASES);
  if (tagsValue !== undefined) {
    const { tags, invalid } = parsePerformanceTags(tagsValue);
    if (tags !== undefined) {
      facts.performanceExclusionTags = tags;
      provenance.performanceExclusionTags = 'statement';
    }
    if (invalid.length > 0) {
      errors.push(`알 수 없는 실적 제외 태그: ${invalid.join(', ')}`);
    }
  }

  if (Object.keys(provenance).length > 0) facts.factProvenance = provenance;
  return { facts, errors };
}
