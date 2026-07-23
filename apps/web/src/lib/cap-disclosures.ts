import type { CapInfo, CardRewardResult } from '@cherrypicker/core';
import { formatWon } from './formatters.js';

export interface BrowserCapDisclosure extends CapInfo {
  cardId: string;
  cardName: string;
  categoryLabel: string;
  periodLabel: string;
  lostReward: number;
}

function formatCapPeriodKo(capType: CapInfo['capType']): string {
  switch (capType) {
    case 'per_transaction':
      return '건당 한도';
    case 'monthly_category':
      return '카테고리별 월 한도';
    case 'monthly_total':
      return '카드 월 통합 한도';
  }
}

export function collectCapDisclosures(
  cardResults: readonly Pick<
    CardRewardResult,
    'cardId' | 'cardName' | 'byCategory' | 'capsHit'
  >[],
): BrowserCapDisclosure[] {
  return cardResults.flatMap((card) =>
    card.capsHit.map((cap) => ({
      ...cap,
      cardId: card.cardId,
      cardName: card.cardName,
      categoryLabel: cap.capType === 'monthly_total'
        ? '카드 전체'
        : card.byCategory.find(
            (category) => category.category === cap.category,
          )?.categoryNameKo ?? cap.category,
      periodLabel: formatCapPeriodKo(cap.capType),
      lostReward: Math.max(0, cap.actualReward - cap.appliedReward),
    }))
  );
}

export function formatCapOutcomeKo(
  disclosure: Pick<BrowserCapDisclosure, 'lostReward'>,
): string {
  return disclosure.lostReward > 0
    ? `${formatWon(disclosure.lostReward)} 혜택 손실`
    : '혜택 손실 없음';
}
