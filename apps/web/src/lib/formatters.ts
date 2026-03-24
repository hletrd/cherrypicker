/**
 * Format a number as Korean Won currency.
 * Example: 1234567 → "1,234,567원"
 */
export function formatWon(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

/**
 * Format a decimal rate as percentage.
 * Example: 0.015 → "1.5%"
 */
export function formatRate(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

/**
 * Format a date string to Korean format.
 * Example: "2026-03-15" → "2026년 3월 15일"
 */
export function formatDateKo(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * Format a date string to short Korean format.
 * Example: "2026-03-15" → "3/15"
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
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
