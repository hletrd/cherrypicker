export function getIssuerFromCardId(cardId: string): string {
  return cardId.split('-')[0] ?? 'unknown';
}

export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  // Normalize negative zero to positive zero so we never render "-0원"
  if (amount === 0) amount = 0;
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
 * Alias for formatRate.
 */
export function formatPercent(rate: number): string {
  return formatRate(rate);
}

/**
 * Format a decimal rate as percentage with 2 decimal places.
 * Use for effective rate displays that need more precision than formatRate().
 * Example: 0.01525 → "1.53%"
 */
export function formatRatePrecise(rate: number): string {
  if (!Number.isFinite(rate)) return '0.00%';
  return (rate * 100).toFixed(2) + '%';
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
    jeju: '제주은행',
    sc: 'SC제일은행',
    mg: 'MG새마을금고',
    cu: '신협',
    kdb: 'KDB산업은행',
    epost: '우체국',
  };
  return names[issuer] ?? issuer;
}

/**
 * Return an icon name for a reward category ID.
 * Use with the Icon component.
 */
export function getCategoryIconName(category: string): string {
  const icons: Record<string, string> = {
    dining: 'receipt',
    grocery: 'inbox-tray',
    convenience_store: 'inbox-tray',
    public_transit: 'arrow-path',
    transportation: 'arrow-path',
    online_shopping: 'tag',
    telecom: 'chart-bar',
    streaming: 'sparkles',
    subscription: 'sparkles',
    entertainment: 'sparkles',
    medical: 'check-circle',
    education: 'document-text',
    cafe: 'receipt',
    travel: 'arrow-up-tray',
    utilities: 'light-bulb',
    insurance: 'check-circle',
    fuel: 'arrow-path',
    delivery: 'inbox-tray',
    parking: 'folder-open',
    fashion: 'tag',
    uncategorized: 'document-text',
  };
  return icons[category] ?? 'credit-card';
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
    jeju: '#ff6b00',
    sc: '#0072ce',
    mg: '#00843d',
    cu: '#003478',
    kdb: '#00274c',
    epost: '#e60012',
  };
  return colors[issuer] ?? '#6b7280';
}

/**
 * Format a date string to Korean format.
 * Example: "2026-03-15" → "2026년 3월 15일"
 */
export function formatDateKo(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '-';
  const [y, m, d] = parts;
  const mNum = parseInt(m!, 10);
  const dNum = parseInt(d!, 10);
  if (Number.isNaN(mNum) || Number.isNaN(dNum)) return '-';
  return `${y}년 ${mNum}월 ${dNum}일`;
}

/**
 * Format a date string to short Korean format.
 * Example: "2026-03-15" → "3/15"
 */
export function formatDateShort(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '-';
  const [, m, d] = parts;
  const mNum = parseInt(m!, 10);
  const dNum = parseInt(d!, 10);
  if (Number.isNaN(mNum) || Number.isNaN(dNum)) return '-';
  return `${mNum}/${dNum}`;
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Build a page URL from a path segment, handling BASE_URL with or without
 * a trailing slash.  Astro guarantees BASE_URL ends with `/`, but defensive
 * coding ensures it works regardless.
 * Example: buildPageUrl('dashboard') → '/cherrypicker/dashboard'
 */
export function buildPageUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}${base.endsWith('/') ? '' : '/'}${path}`;
}
