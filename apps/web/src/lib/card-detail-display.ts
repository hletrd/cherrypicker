import type {
  RewardConditions,
  RewardRule,
} from '@cherrypicker/rules/browser';
import { catalogRewardCategoryKey } from './catalog-reward-display.js';
import { buildPageUrl } from './formatters.js';

export const ADDITIONAL_CONDITIONS_DISCLOSURE =
  '추가 적용 조건은 카드사 상품 설명서를 확인해 주세요.';

const MILEAGE_VALUATION_REASON =
  'mileage reward valuation contract is not modeled';

export function formatUnsupportedRewardReasonKo(reason: string): string {
  if (reason.trim() === MILEAGE_VALUATION_REASON) {
    return '마일리지를 원화로 환산할 기준이 없어 확정 혜택표와 추천 계산에서 제외했어요.';
  }
  return '적용 조건을 자동으로 확인할 수 없어요.';
}

export const PERFORMANCE_EXCLUSION_LABELS: Readonly<Record<string, string>> = {
  annual_fee: '연회비',
  apartment_fee: '아파트 관리비',
  apartment_mgmt: '아파트 관리비',
  gift_card: '상품권 구매',
  gift_card_purchase: '상품권 구매',
  insurance: '보험료',
  long_term_loan: '장기카드대출(카드론)',
  overseas: '해외 이용액',
  public_transit: '대중교통 이용액',
  short_term_loan: '단기카드대출(현금서비스)',
  tax_payment: '세금 납부',
  telecom: '통신요금',
  tuition: '등록금',
  utility_bills: '공과금',
};

export function formatPerformanceExclusion(exclusion: string): string {
  const normalized = exclusion.trim();
  if (!normalized) return '기타 실적 제외 항목';
  return PERFORMANCE_EXCLUSION_LABELS[normalized]
    ?? normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

const CONDITION_KEYS = new Set<keyof RewardConditions>([
  'minTransaction',
  'maxTransaction',
  'specificMerchants',
  'weekdays',
  'maxUses',
  'usePeriod',
  'channel',
  'paymentType',
  'note',
]);

const WEEKDAY_LABELS = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
] as const;

function isConditionRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isWonAmount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/**
 * Formats the complete published reward-condition vocabulary. Unknown or
 * malformed fields are never silently omitted: callers receive one explicit
 * disclosure directing the reader to the issuer's product description.
 */
export function formatRewardConditionsKo(
  conditions:
    | RewardConditions
    | Readonly<Record<string, unknown>>
    | undefined,
): string[] {
  if (conditions === undefined) return [];
  if (!isConditionRecord(conditions)) {
    return [ADDITIONAL_CONDITIONS_DISCLOSURE];
  }

  const labels: string[] = [];
  let needsAdditionalDisclosure = Object.keys(conditions).some(
    key => !CONDITION_KEYS.has(key as keyof RewardConditions),
  );

  const merchants = conditions.specificMerchants;
  if (merchants !== undefined) {
    if (
      Array.isArray(merchants) &&
      merchants.length > 0 &&
      merchants.every(
        merchant => typeof merchant === 'string' && merchant.trim().length > 0,
      )
    ) {
      labels.push(
        `대상 가맹점: ${merchants.map(merchant => merchant.trim()).join(', ')}`,
      );
    } else {
      needsAdditionalDisclosure = true;
    }
  }

  if (conditions.minTransaction !== undefined) {
    if (isWonAmount(conditions.minTransaction)) {
      labels.push(
        `건당 최소 이용금액: ${conditions.minTransaction.toLocaleString('ko-KR')}원`,
      );
    } else {
      needsAdditionalDisclosure = true;
    }
  }

  if (conditions.maxTransaction !== undefined) {
    if (isWonAmount(conditions.maxTransaction)) {
      labels.push(
        `건당 최대 이용금액: ${conditions.maxTransaction.toLocaleString('ko-KR')}원`,
      );
    } else {
      needsAdditionalDisclosure = true;
    }
  }

  if (conditions.weekdays !== undefined) {
    if (
      Array.isArray(conditions.weekdays) &&
      conditions.weekdays.length > 0 &&
      conditions.weekdays.every(
        weekday =>
          Number.isSafeInteger(weekday) &&
          (weekday as number) >= 0 &&
          (weekday as number) < WEEKDAY_LABELS.length,
      )
    ) {
      labels.push(
        `적용 요일: ${conditions.weekdays
          .map(weekday => WEEKDAY_LABELS[weekday as number])
          .join(', ')}`,
      );
    } else {
      needsAdditionalDisclosure = true;
    }
  }

  if (conditions.channel !== undefined) {
    if (conditions.channel === 'online' || conditions.channel === 'offline') {
      labels.push(
        `결제 채널: ${conditions.channel === 'online' ? '온라인' : '오프라인'}`,
      );
    } else {
      needsAdditionalDisclosure = true;
    }
  }

  if (conditions.paymentType !== undefined) {
    if (
      conditions.paymentType === 'domestic' ||
      conditions.paymentType === 'overseas'
    ) {
      labels.push(
        `결제 지역: ${conditions.paymentType === 'domestic' ? '국내' : '해외'}`,
      );
    } else {
      needsAdditionalDisclosure = true;
    }
  }

  const hasMaxUses = conditions.maxUses !== undefined;
  const hasUsePeriod = conditions.usePeriod !== undefined;
  if (hasMaxUses || hasUsePeriod) {
    if (
      isWonAmount(conditions.maxUses) &&
      conditions.maxUses > 0 &&
      (conditions.usePeriod === 'day' || conditions.usePeriod === 'month')
    ) {
      labels.push(
        `이용 횟수: ${conditions.usePeriod === 'day' ? '일' : '월'} ${conditions.maxUses}회까지`,
      );
    } else {
      needsAdditionalDisclosure = true;
    }
  }

  if (conditions.note !== undefined) {
    if (typeof conditions.note === 'string' && conditions.note.trim()) {
      labels.push(`추가 안내: ${conditions.note.trim()}`);
    } else {
      needsAdditionalDisclosure = true;
    }
  }

  if (needsAdditionalDisclosure) {
    labels.push(ADDITIONAL_CONDITIONS_DISCLOSURE);
  }
  return labels;
}

export interface SupportedRewardPresentation {
  rewardId: string;
  rewardLabel: string | undefined;
  category: string;
  conditionLabels: string[];
}

export function buildSupportedRewardPresentation(
  reward: Pick<
    RewardRule,
    'id' | 'category' | 'subcategory' | 'label' | 'conditions'
  >,
): SupportedRewardPresentation {
  return {
    rewardId: reward.id,
    rewardLabel: reward.label,
    category: catalogRewardCategoryKey(reward),
    conditionLabels: formatRewardConditionsKo(reward.conditions),
  };
}

export function buildIssuerCatalogUrl(
  issuer: string,
  cardsUrl = buildPageUrl('cards'),
): string {
  const query = new URLSearchParams({ issuer }).toString();
  return `${cardsUrl}?${query}`;
}
