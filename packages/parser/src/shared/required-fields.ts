export const REQUIRED_TRANSACTION_COLUMNS = [
  ['date', '날짜'],
  ['merchant', '가맹점'],
  ['amount', '금액'],
] as const;

export const REQUIRED_MERCHANT_ERROR_CODE = 'missing_required_merchant';
export const REQUIRED_MERCHANT_ERROR_MESSAGE = '필수 값이 비어 있습니다: 가맹점';
export const REQUIRED_DATE_ERROR_CODE = 'missing_required_date';
export const REQUIRED_DATE_ERROR_MESSAGE = '필수 값이 비어 있습니다: 날짜';
export const MAX_REQUIRED_FIELD_ROW_ERRORS = 100;

export function missingRequiredColumnLabels(columns: {
  date: number;
  merchant: number;
  amount: number;
}): string[] {
  const missing: string[] = [];
  for (const [key, label] of REQUIRED_TRANSACTION_COLUMNS) {
    if (columns[key] === -1) missing.push(label);
  }
  return missing;
}

export function normalizeRequiredMerchant(value: unknown): string {
  return String(value ?? '').replace(/^"(.*)"$/s, '$1').trim();
}
