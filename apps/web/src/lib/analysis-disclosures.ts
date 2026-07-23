import type { PreviousSpendingBasis } from './analysis-context.js';
import { formatWon } from './formatters.js';

export interface PreviousSpendingDisclosure {
  kind: PreviousSpendingBasis['kind'];
  tone: 'neutral' | 'warning';
  text: string;
}

export interface UnsupportedReasonSummary {
  reason: string;
  label: string;
  count: number;
}

export interface UnsupportedRulesSummary {
  issueCount: number;
  transactionCount: number;
  ruleCount: number;
  reasons: UnsupportedReasonSummary[];
}

interface CalculationIssueLike {
  cardId: string;
  transactionId: string;
  ruleId: string;
  category: string;
  reason: string;
}

const UNSUPPORTED_REASON_LABELS: Readonly<Record<string, string>> = {
  rule_marked_unsupported: '현재 계산식이 지원하지 않는 카드 혜택 조건',
  restriction_in_note: '설명에만 있어 자동 확인할 수 없는 제한 조건',
  missing_payment_type: '국내·해외 결제 정보 부족',
  missing_channel: '온라인·오프라인 결제 정보 부족',
  missing_fuel_volume: '주유량 정보 부족',
  missing_occurrence_context: '이용 날짜·횟수 정보 부족',
  missing_performance_exclusion_fact: '전월실적 제외 여부를 확인할 거래 정보 부족',
  unsupported_reward_unit: '현재 계산할 수 없는 혜택 단위',
};

function formatYearMonth(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${year}년 ${Number(monthNumber)}월`;
}

export function describePreviousSpendingBasis(
  basis: PreviousSpendingBasis | undefined,
): PreviousSpendingDisclosure | null {
  if (!basis) return null;
  if (basis.kind === 'user-total') {
    return {
      kind: basis.kind,
      tone: 'neutral',
      text: `직접 입력한 전월실적 ${formatWon(basis.amount)}을 기준으로 계산했어요.`,
    };
  }
  if (basis.kind === 'statement-month') {
    return {
      kind: basis.kind,
      tone: 'neutral',
      text: `${formatYearMonth(basis.month)} 명세서에서 카드별 실적 제외 항목을 반영해 계산했어요.`,
    };
  }
  return {
    kind: basis.kind,
    tone: 'warning',
    text: `정확한 전월인 ${formatYearMonth(basis.month)} 명세서가 없어 전월실적을 ${formatWon(basis.assumedAmount)}으로 가정했어요.`,
  };
}

function isCalculationIssue(value: unknown): value is CalculationIssueLike {
  if (!value || typeof value !== 'object') return false;
  const issue = value as Record<string, unknown>;
  return (
    typeof issue.cardId === 'string' &&
    typeof issue.transactionId === 'string' &&
    typeof issue.ruleId === 'string' &&
    typeof issue.category === 'string' &&
    typeof issue.reason === 'string'
  );
}

export function summarizeUnsupportedRules(
  values: readonly unknown[] | undefined,
): UnsupportedRulesSummary | null {
  if (!values?.length) return null;

  const issues = new Map<string, CalculationIssueLike>();
  for (const value of values) {
    if (!isCalculationIssue(value)) continue;
    const key = [
      value.cardId,
      value.transactionId,
      value.ruleId,
      value.category,
      value.reason,
    ].join('\u0000');
    issues.set(key, value);
  }
  if (issues.size === 0) return null;

  const transactions = new Set<string>();
  const rules = new Set<string>();
  const reasonCounts = new Map<string, number>();
  for (const issue of issues.values()) {
    transactions.add(issue.transactionId);
    rules.add(`${issue.cardId}\u0000${issue.ruleId}`);
    reasonCounts.set(issue.reason, (reasonCounts.get(issue.reason) ?? 0) + 1);
  }

  const reasons = [...reasonCounts]
    .map(([reason, count]) => ({
      reason,
      label:
        UNSUPPORTED_REASON_LABELS[reason] ??
        '계산에 필요한 거래 정보 또는 혜택 조건 부족',
      count,
    }))
    .sort((left, right) => (
      right.count - left.count || left.reason.localeCompare(right.reason)
    ));

  return {
    issueCount: issues.size,
    transactionCount: transactions.size,
    ruleCount: rules.size,
    reasons,
  };
}
