import type { CapInfo, PortfolioCapLoss } from '@cherrypicker/core';

export function formatCapPeriodKo(
  cap: Pick<CapInfo, 'capType'>,
): string {
  switch (cap.capType) {
    case 'per_transaction':
      return '건당 한도';
    case 'monthly_category':
      return '카테고리별 월 한도';
    case 'monthly_total':
      return '카드 월 통합 한도';
  }
}

/**
 * Describe the transaction-local effect of the cap reach event.
 *
 * An exact hit has equal actual/applied reward and must not be presented as a
 * zero-Won loss. A clipped hit keeps the concrete lost-benefit amount.
 */
export function formatCapOutcomeKo(
  cap: Pick<CapInfo, 'actualReward' | 'appliedReward'>,
  formatAmount: (amount: number) => string,
): string {
  if (cap.actualReward > cap.appliedReward) {
    return (
      `도달 거래에서 ` +
      `${formatAmount(cap.actualReward - cap.appliedReward)} 미적용`
    );
  }
  return '도달 거래에서 추가 차감 없음';
}

export function formatPortfolioCapLossOutcomeKo(
  loss: Pick<
    PortfolioCapLoss,
    'grossSuppressedReward' | 'replacementReward' | 'netLostReward'
  >,
  formatAmount: (amount: number) => string,
): string {
  const replacement = loss.replacementReward > 0
    ? `다른 혜택으로 대체 ${formatAmount(loss.replacementReward)}`
    : '대체 혜택 없음';
  return (
    `한도로 제한된 혜택 ${formatAmount(loss.grossSuppressedReward)}` +
    ` · ${replacement}` +
    ` · 최종 ${formatAmount(loss.netLostReward)} 감소`
  );
}
