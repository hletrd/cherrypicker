import type { CapInfo } from '@cherrypicker/core';

/**
 * Describe whether reaching a cap actually discarded reward.
 *
 * An exact hit has equal actual/applied reward and must not be presented as a
 * zero-Won loss. A clipped hit keeps the concrete lost-benefit amount.
 */
export function formatCapOutcomeKo(
  cap: Pick<CapInfo, 'actualReward' | 'appliedReward'>,
  formatAmount: (amount: number) => string,
): string {
  if (cap.actualReward > cap.appliedReward) {
    return `${formatAmount(cap.actualReward - cap.appliedReward)} 혜택 손실`;
  }
  return '혜택 손실 없음';
}
