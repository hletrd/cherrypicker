import type {
  CapInfo,
  CardRewardResult,
  PortfolioCapLoss,
} from '@cherrypicker/core';
import { formatWon } from './formatters.js';

export interface BrowserCapDisclosure extends CapInfo {
  cardId: string;
  cardName: string;
  categoryLabel: string;
  periodLabel: string;
  lostReward: number;
}

export interface BrowserPortfolioCapLossDisclosure
  extends PortfolioCapLoss {
  categoryLabel: string;
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
    ? `도달 거래에서 ${formatWon(disclosure.lostReward)} 미적용`
    : '도달 거래에서 추가 차감 없음';
}

export function collectPortfolioCapLossDisclosures(
  losses: readonly PortfolioCapLoss[] | undefined,
  categoryLabels: ReadonlyMap<string, string>,
): BrowserPortfolioCapLossDisclosure[] {
  return (losses ?? []).map((loss) => ({
    ...loss,
    categoryLabel: categoryLabels.get(loss.category) ?? loss.category,
  }));
}

export function formatPortfolioCapLossOutcomeKo(
  disclosure: Pick<
    BrowserPortfolioCapLossDisclosure,
    'grossSuppressedReward' | 'replacementReward' | 'netLostReward'
  >,
): string {
  const replacement = disclosure.replacementReward > 0
    ? `다른 혜택으로 대체 ${formatWon(disclosure.replacementReward)}`
    : '대체 혜택 없음';
  return (
    `한도로 제한된 혜택 ${formatWon(disclosure.grossSuppressedReward)}` +
    ` · ${replacement}` +
    ` · 최종 ${formatWon(disclosure.netLostReward)} 감소`
  );
}
