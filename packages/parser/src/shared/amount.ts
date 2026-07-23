/**
 * Browser-safe canonical amount parsing.
 *
 * Keep all raw numeric validation here so JSON, XLSX, HTML, PDF, CLI, and
 * browser callers reject values that cannot be represented exactly.
 */
export function parseAmountString(raw: string): number | null {
  if (!raw.trim()) return null;

  let cleaned = raw.trim()
    .replace(/^\+/, '')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/－/g, '-')
    .replace(/＋/g, '+')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/^KRW\s*/i, '')
    .replace(/\s*원$/, '')
    .replace(/[₩￦]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '');

  const hasKoreanMinus = /^마이너스/.test(cleaned);
  if (hasKoreanMinus) cleaned = cleaned.replace(/^마이너스/, '');

  const hasTrailingMinus = /\d-$/.test(cleaned);
  if (hasTrailingMinus) cleaned = cleaned.replace(/-$/, '');

  const hasAccountingParentheses =
    cleaned.startsWith('(') && cleaned.endsWith(')');
  if (hasAccountingParentheses) {
    cleaned = cleaned.slice(1, -1);
  }

  const isNegative =
    hasAccountingParentheses
    || hasKoreanMinus
    || hasTrailingMinus
    || cleaned.startsWith('-');

  const dotCount = (cleaned.match(/\./g) ?? []).length;
  if (!cleaned || dotCount > 1 || cleaned.endsWith('.')) return null;

  const match = cleaned.match(/^[+-]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const remainder = cleaned.slice(match[0].length);
  if (/[\d.]/.test(remainder)) return null;
  if (remainder.trim() && remainder.trim() !== '원') return null;

  const magnitude = Math.abs(Math.round(Number(match[0])));
  if (!Number.isSafeInteger(magnitude)) return null;
  return isNegative ? -magnitude : magnitude;
}

export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    const rounded = Math.round(raw);
    return Number.isSafeInteger(rounded) ? rounded : null;
  }
  return typeof raw === 'string' ? parseAmountString(raw) : null;
}
