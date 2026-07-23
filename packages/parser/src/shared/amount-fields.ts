export type AmountFieldRole =
  | 'outgoing'
  | 'neutral'
  | 'incoming'
  | 'ambiguous';

export interface AmountFieldCandidate {
  index: number;
  name: string;
  role: AmountFieldRole;
  preferred: boolean;
}

export interface AmountFieldPlan {
  candidates: readonly AmountFieldCandidate[];
}

export type AmountFieldResolution =
  | { kind: 'missing' }
  | {
      kind: 'spending';
      index: number;
      raw: unknown;
      role: 'outgoing' | 'neutral';
    }
  | {
      kind: 'non-spending';
      index: number;
      raw: unknown;
      role: 'incoming';
    }
  | {
      kind: 'ambiguous';
      indexes: readonly number[];
    };

export const NON_SPENDING_AMOUNT_ERROR_CODE = 'non_spending_amount';
export const AMBIGUOUS_AMOUNT_ERROR_CODE = 'ambiguous_amount_direction';

const INCOMING_NAMES = new Set([
  'credit',
  'credits',
  'creditamount',
  'refund',
  'refunds',
  'refundamount',
  'reversal',
  'reversalamount',
  'incoming',
  'incomingamount',
  'deposit',
  'depositamount',
  '취소금액',
  '취소액',
  '환불금액',
  '환불액',
  '입금액',
  '승인취소금액',
  '환급금액',
  '환급액',
  '입금금액',
  '실입금액',
]);

const OUTGOING_NAMES = new Set([
  'debit',
  'debits',
  'debitamount',
  'withdrawal',
  'withdrawalamount',
  'outgoing',
  'outgoingamount',
  '출금',
  '출금액',
  '출금금액',
  '지출',
  '지출액',
  '지출금액',
]);

const NEUTRAL_NAMES = new Set([
  'amount',
  'amt',
  'total',
  'price',
  'won',
  'charge',
  'chargeamount',
  'payment',
  'paid',
  'spent',
  'cost',
  'value',
  'net',
  'netamount',
  'gross',
  'transactionamount',
  'paymentamount',
  'billedamount',
  'totalamount',
  '이용금액',
  '거래금액',
  '금액',
  '결제금액',
  '승인금액',
  '승인액',
  '매출금액',
  '이용액',
  '결제액',
  '청구금액',
  '청구액',
  '결제대금',
  '매입금액',
  '실청구금액',
  '실결제금액',
  '실결제액',
  '결제예정금액',
  '사용금액',
  '사용액',
  '이용대금',
  '할인금액',
  '포인트할인',
  '할인전금액',
  '할인후금액',
  '원금',
]);

function normalizeFieldName(value: string): string {
  return value
    .replace(/[​‌‍­ 　\t\n\r‎‏‪‫‬‭‮﻿︀︁︂︃︄︅︆︇︈︉︊︋︌︍︎️⁠]/g, '')
    .replace(/[！-～]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
    .trim()
    .replace(/[\s_\-]+/g, '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase();
}

function classifySingleName(name: string): Exclude<AmountFieldRole, 'ambiguous'> | null {
  if (
    INCOMING_NAMES.has(name)
    || /(?:취소|환불|환급|입금)(?:금액|액)$/.test(name)
  ) {
    return 'incoming';
  }
  if (
    OUTGOING_NAMES.has(name)
    || /(?:출금|지출)(?:금액|액)$/.test(name)
  ) {
    return 'outgoing';
  }
  if (
    NEUTRAL_NAMES.has(name)
    || /(?:금액|이용액|결제액|청구액|사용액)$/.test(name)
    || /amount$/.test(name)
  ) {
    return 'neutral';
  }
  return null;
}

export function classifyAmountFieldName(name: string): AmountFieldRole | null {
  const normalized = normalizeFieldName(name);
  const compact = normalized.replace(/[/|,+＋·ㆍ]/g, '');
  if (/^(?:입출금|출입금|입금출금|출금입금)(?:금액|액)$/.test(compact)) {
    return 'ambiguous';
  }
  const parts = normalized.split(/[/|,+＋·ㆍ]/).filter(Boolean);
  const roles = new Set(
    parts
      .map(classifySingleName)
      .filter((role): role is Exclude<AmountFieldRole, 'ambiguous'> =>
        role !== null),
  );
  if (roles.size === 0) return null;
  if (roles.size > 1) return 'ambiguous';
  return roles.values().next().value ?? null;
}

export function compileAmountFieldPlan(
  names: readonly string[],
  preferredName?: string,
): AmountFieldPlan {
  const normalizedPreferred = preferredName
    ? normalizeFieldName(preferredName)
    : null;
  const candidates: AmountFieldCandidate[] = [];

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index] ?? '';
    const role = classifyAmountFieldName(name);
    if (!role) continue;
    const normalized = normalizeFieldName(name);
    const preferred = normalizedPreferred !== null && (
      normalized === normalizedPreferred
      || normalized.split(/[/|,+＋]/).includes(normalizedPreferred)
    );
    candidates.push({ index, name, role, preferred });
  }

  return { candidates };
}

export function withInferredNeutralAmountField(
  plan: AmountFieldPlan,
  index: number,
): AmountFieldPlan {
  if (plan.candidates.length > 0 || index < 0) return plan;
  return {
    candidates: [{
      index,
      name: '',
      role: 'neutral',
      preferred: false,
    }],
  };
}

function isPresent(value: unknown): boolean {
  return value !== undefined
    && value !== null
    && (typeof value !== 'string' || value.trim().length > 0);
}

function preferredOrFirst(
  candidates: readonly AmountFieldCandidate[],
): AmountFieldCandidate {
  return candidates.find(({ preferred }) => preferred) ?? candidates[0]!;
}

function normalizedComparableAmount(
  candidate: AmountFieldCandidate,
  raw: unknown,
): number | null {
  const parsed = parseAmount(raw);
  if (parsed === null) return null;
  return candidate.role === 'outgoing' || candidate.role === 'incoming'
    ? Math.abs(parsed)
    : parsed;
}

function hasConflictingSameRoleValues(
  candidates: readonly AmountFieldCandidate[],
  valueAt: (index: number) => unknown,
): boolean {
  if (candidates.length < 2) return false;
  const values = candidates.map((candidate) =>
    normalizedComparableAmount(candidate, valueAt(candidate.index)));
  return values.some((value) => value === null)
    || values.some((value) => !Object.is(value, values[0]));
}

export function resolveAmountField(
  plan: AmountFieldPlan,
  valueAt: (index: number) => unknown,
): AmountFieldResolution {
  const populated = plan.candidates.filter(({ index }) =>
    isPresent(valueAt(index)));
  if (populated.length === 0) return { kind: 'missing' };

  const ambiguous = populated.filter(({ role }) => role === 'ambiguous');
  if (ambiguous.length > 0) {
    return {
      kind: 'ambiguous',
      indexes: ambiguous.map(({ index }) => index),
    };
  }

  const outgoing = populated.filter(({ role }) => role === 'outgoing');
  const incoming = populated.filter(({ role }) => role === 'incoming');
  const neutral = populated.filter(({ role }) => role === 'neutral');

  if (
    (outgoing.length > 0 && incoming.length > 0)
    || (incoming.length > 0 && neutral.length > 0)
  ) {
    return {
      kind: 'ambiguous',
      indexes: populated.map(({ index }) => index),
    };
  }

  const conflicting = [outgoing, incoming, neutral]
    .find((candidates) => hasConflictingSameRoleValues(candidates, valueAt));
  if (conflicting) {
    return {
      kind: 'ambiguous',
      indexes: conflicting.map(({ index }) => index),
    };
  }

  if (outgoing.length > 0) {
    const selected = preferredOrFirst(outgoing);
    return {
      kind: 'spending',
      index: selected.index,
      raw: valueAt(selected.index),
      role: 'outgoing',
    };
  }
  if (incoming.length > 0) {
    const selected = preferredOrFirst(incoming);
    return {
      kind: 'non-spending',
      index: selected.index,
      raw: valueAt(selected.index),
      role: 'incoming',
    };
  }

  const selected = preferredOrFirst(neutral);
  return {
    kind: 'spending',
    index: selected.index,
    raw: valueAt(selected.index),
    role: 'neutral',
  };
}

export function nonSpendingAmountMessage(
  merchant: string,
  rawAmount: unknown,
): string {
  return `입금/환불 내역은 지출로 처리되지 않습니다: ${merchant} ${String(rawAmount)}원`;
}

export function normalizeResolvedSpendingAmount(
  amount: number,
  role: 'outgoing' | 'neutral',
): number {
  return role === 'outgoing' ? Math.abs(amount) : amount;
}

export const AMBIGUOUS_AMOUNT_MESSAGE =
  '금액 컬럼의 입출금 방향을 하나로 판단할 수 없습니다.';
import { parseAmount } from './amount.js';
