export const MAX_PREVIOUS_SPENDING_KRW = 10_000_000_000;

export type PreviousSpendingValidation =
  | { valid: true; value: number | undefined }
  | { valid: false; message: string };

export function validatePreviousSpending(raw: unknown): PreviousSpendingValidation {
  if (raw === undefined || raw === null || raw === '') {
    return { valid: true, value: undefined };
  }

  const value = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && raw.trim() !== ''
      ? Number(raw.trim())
      : Number.NaN;

  if (!Number.isFinite(value)) {
    return { valid: false, message: '전월 카드 이용액을 숫자로 입력해 주세요.' };
  }
  if (value < 0) {
    return { valid: false, message: '전월 카드 이용액은 0원 이상이어야 해요.' };
  }
  if (!Number.isInteger(value)) {
    return { valid: false, message: '전월 카드 이용액은 원 단위 정수로 입력해 주세요.' };
  }
  if (value > MAX_PREVIOUS_SPENDING_KRW) {
    return { valid: false, message: '전월 카드 이용액은 100억원 이하로 입력해 주세요.' };
  }
  return { valid: true, value: value === 0 ? 0 : value };
}
