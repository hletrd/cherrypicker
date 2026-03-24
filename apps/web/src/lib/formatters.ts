/**
 * Format a number as Korean Won currency.
 * Example: 1234567 → "1,234,567원"
 */
export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  return amount.toLocaleString('ko-KR') + '원';
}

/**
 * Format a decimal rate as percentage.
 * Example: 0.015 → "1.5%"
 */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '0.0%';
  return (rate * 100).toFixed(1) + '%';
}

/**
 * Format a decimal rate as percentage with 1 decimal place.
 * Example: 0.015 → "1.5%"
 */
export function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return '0.0%';
  return (rate * 100).toFixed(1) + '%';
}

/**
 * Format a number with comma separator.
 * Example: 1234 → "1,234"
 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ko-KR');
}

/**
 * Return Korean issuer name for an issuer ID.
 */
export function formatIssuerNameKo(issuer: string): string {
  const names: Record<string, string> = {
    hyundai: '현대카드',
    kb: 'KB국민카드',
    samsung: '삼성카드',
    shinhan: '신한카드',
    lotte: '롯데카드',
    hana: '하나카드',
    woori: '우리카드',
    ibk: 'IBK기업은행',
    nh: 'NH농협카드',
    bc: 'BC카드',
    kakao: '카카오뱅크',
    toss: '토스뱅크',
    kbank: '케이뱅크',
    bnk: 'BNK경남은행',
    dgb: 'DGB대구은행',
    suhyup: '수협은행',
    jb: '전북은행',
    kwangju: '광주은행',
  };
  return names[issuer] ?? issuer;
}

/**
 * Return an emoji for a reward category ID.
 */
export function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    dining: '🍽️',
    grocery: '🛒',
    convenience_store: '🏪',
    public_transit: '🚇',
    transportation: '🚗',
    online_shopping: '🛍️',
    telecom: '📱',
    streaming: '🎬',
    subscription: '📺',
    entertainment: '🎭',
    medical: '🏥',
    education: '📚',
    cafe: '☕',
    travel: '✈️',
    utilities: '💡',
    insurance: '🛡️',
    fuel: '⛽',
    delivery: '🛵',
    parking: '🅿️',
    fashion: '👗',
    uncategorized: '📦',
  };
  return emojis[category] ?? '💳';
}

/**
 * Return hex color for an issuer ID.
 */
export function getIssuerColor(issuer: string): string {
  const colors: Record<string, string> = {
    hyundai: '#1a1a1a',
    kb: '#ffb800',
    samsung: '#1428a0',
    shinhan: '#0046ff',
    lotte: '#ed1c24',
    hana: '#009490',
    woori: '#0066b3',
    ibk: '#004ea2',
    nh: '#03674b',
    bc: '#f04e3e',
    kakao: '#fee500',
    toss: '#0064ff',
    kbank: '#0064ff',
    bnk: '#0072bc',
    dgb: '#00a651',
    suhyup: '#0054a6',
    jb: '#005baa',
    kwangju: '#00a651',
  };
  return colors[issuer] ?? '#6b7280';
}

/**
 * Format a date string to Korean format.
 * Example: "2026-03-15" → "2026년 3월 15일"
 */
export function formatDateKo(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * Format a date string to short Korean format.
 * Example: "2026-03-15" → "3/15"
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
