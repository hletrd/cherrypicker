import { buildPageUrl } from './formatters.js';

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

export function buildIssuerCatalogUrl(
  issuer: string,
  cardsUrl = buildPageUrl('cards'),
): string {
  const query = new URLSearchParams({ issuer }).toString();
  return `${cardsUrl}?${query}`;
}
