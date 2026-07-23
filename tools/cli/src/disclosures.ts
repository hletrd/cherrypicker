import type { OptimizationResult } from '@cherrypicker/core';

export function buildOptimizationDisclosures(
  result: OptimizationResult,
  previousSpending: number | undefined,
): string[] {
  const messages = previousSpending === undefined
    ? [
        '전월실적 기준: 입력이 없어 모든 카드에 0원을 가정했습니다. ' +
          '실제 전월실적은 --prev-spending으로 지정하세요.',
      ]
    : [
        `전월실적 기준: 사용자 입력 ${previousSpending}원을 모든 카드에 동일하게 적용했습니다.`,
      ];

  const unsupported = result.unsupportedRules ?? [];
  if (unsupported.length > 0) {
    messages.push(
      `계산 제한: 거래 정보나 지원되지 않는 규칙 때문에 ` +
        `${unsupported.length}건의 혜택을 정확히 계산하지 못했습니다.`,
    );
    for (const issue of unsupported.slice(0, 3)) {
      messages.push(
        `  - ${issue.ruleId} (${issue.reason})` +
          `${issue.detail ? `: ${issue.detail}` : ''}`,
      );
    }
    if (unsupported.length > 3) {
      messages.push(`  - 그 외 ${unsupported.length - 3}건`);
    }
  }

  return messages;
}

export function printOptimizationDisclosures(
  result: OptimizationResult,
  previousSpending: number | undefined,
  writeWarning: (message: string) => void = console.warn,
): void {
  for (const message of buildOptimizationDisclosures(
    result,
    previousSpending,
  )) {
    writeWarning(message);
  }
}
