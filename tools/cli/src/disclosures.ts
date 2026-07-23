import type {
  OptimizationResult,
  PreviousSpendingBasis,
} from '@cherrypicker/core';
import { sanitizeTerminalText } from '@cherrypicker/viz';

type CliPreviousSpending =
  | number
  | PreviousSpendingBasis
  | undefined;

function previousSpendingMessage(
  previousSpending: CliPreviousSpending,
): string {
  if (typeof previousSpending === 'number') {
    return `전월실적 기준: 사용자 입력 ${previousSpending}원을 모든 카드에 동일하게 적용했습니다.`;
  }
  if (previousSpending?.kind === 'user-total') {
    return `전월실적 기준: 사용자 입력 ${previousSpending.amount}원을 모든 카드에 동일하게 적용했습니다.`;
  }
  if (previousSpending?.kind === 'statement-month') {
    return (
      `전월실적 기준: ${previousSpending.month} 명세서에서 ` +
      '카드별 실적 제외 항목을 반영했습니다.'
    );
  }
  const missingMonth =
    previousSpending?.kind === 'missing-calendar-month'
      ? ` (${previousSpending.month})`
      : '';
  return (
    `전월실적 기준: 이전 달 명세서${missingMonth}가 없어 모든 카드에 0원을 가정했습니다. ` +
    '실제 전월실적은 --prev-spending으로 지정하세요.'
  );
}

export function buildOptimizationDisclosures(
  result: OptimizationResult,
  previousSpending: CliPreviousSpending,
): string[] {
  const messages = [sanitizeTerminalText(previousSpendingMessage(previousSpending))];

  const unsupported = result.unsupportedRules ?? [];
  if (unsupported.length > 0) {
    messages.push(sanitizeTerminalText(
      `계산 제한: 거래 정보나 지원되지 않는 규칙 때문에 ` +
        `${unsupported.length}건의 혜택을 정확히 계산하지 못했습니다.`,
    ));
    for (const issue of unsupported.slice(0, 3)) {
      messages.push(sanitizeTerminalText(
        `  - ${issue.cardId}/${issue.ruleId} (${issue.reason})` +
          `${issue.detail ? `: ${issue.detail}` : ''}`,
      ));
    }
    if (unsupported.length > 3) {
      messages.push(sanitizeTerminalText(`  - 그 외 ${unsupported.length - 3}건`));
    }
  }

  return messages;
}

export function printOptimizationDisclosures(
  result: OptimizationResult,
  previousSpending: CliPreviousSpending,
  writeWarning: (message: string) => void = console.warn,
): void {
  for (const message of buildOptimizationDisclosures(
    result,
    previousSpending,
  )) {
    writeWarning(message);
  }
}
