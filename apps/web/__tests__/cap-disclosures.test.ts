import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import type {
  CardRewardResult,
  PortfolioCapLoss,
} from '@cherrypicker/core';
import {
  collectCapDisclosures,
  collectPortfolioCapLossDisclosures,
  formatCapOutcomeKo,
  formatPortfolioCapLossOutcomeKo,
} from '../src/lib/cap-disclosures.js';

const cardResults: CardRewardResult[] = [
  {
    cardId: 'bc-baro-on-off',
    cardName: 'BC 바로 On&Off',
    totalReward: 1_000,
    totalSpending: 20_000,
    effectiveRate: 0.05,
    performanceTier: 'tier-300',
    byCategory: [
      {
        category: 'dining',
        categoryNameKo: '외식',
        spending: 20_000,
        reward: 1_000,
        rate: 0.05,
        rewardType: 'discount',
        capReached: true,
      },
    ],
    capsHit: [
      {
        category: 'dining',
        capType: 'per_transaction',
        capAmount: 1_000,
        actualReward: 2_000,
        appliedReward: 1_000,
        ruleId: 'reward-001',
        capGroup: 'reward-001',
      },
      {
        category: 'dining',
        capType: 'monthly_category',
        capAmount: 5_000,
        actualReward: 5_000,
        appliedReward: 5_000,
        ruleId: 'reward-002',
        capGroup: 'reward-002',
      },
      {
        category: 'dining',
        capType: 'monthly_category',
        capAmount: 10_000,
        actualReward: 10_000,
        appliedReward: 10_000,
        ruleId: 'reward-003',
        capGroup: 'reward-003',
      },
      {
        category: '*',
        capType: 'monthly_total',
        capAmount: 20_000,
        actualReward: 20_000,
        appliedReward: 20_000,
      },
    ],
  },
];

describe('browser cap disclosures', () => {
  test('preserves plural events and distinguishes every cap period', () => {
    const disclosures = collectCapDisclosures(cardResults);

    expect(disclosures).toHaveLength(4);
    expect(disclosures.map(({ periodLabel }) => periodLabel)).toEqual([
      '건당 한도',
      '카테고리별 월 한도',
      '카테고리별 월 한도',
      '카드 월 통합 한도',
    ]);
    expect(disclosures.map(({ categoryLabel }) => categoryLabel)).toEqual([
      '외식',
      '외식',
      '외식',
      '카드 전체',
    ]);
    expect(disclosures.map(({ capAmount }) => capAmount)).toEqual([
      1_000,
      5_000,
      10_000,
      20_000,
    ]);
    expect(formatCapOutcomeKo(disclosures[0]!)).toBe(
      '도달 거래에서 1,000원 미적용',
    );
    expect(formatCapOutcomeKo(disclosures[1]!)).toBe(
      '도달 거래에서 추가 차감 없음',
    );
  });

  test('formats authoritative portfolio loss after fallback reconciliation', () => {
    const losses: PortfolioCapLoss[] = [{
      transactionId: 'tx-blocked',
      transactionOccurrence: 0,
      category: 'dining',
      counterfactualCardId: 'card-a',
      counterfactualCardName: '카드 A',
      selectedCardId: 'card-b',
      selectedCardName: '카드 B',
      counterfactualReward: 5_000,
      selectedReward: 2_000,
      grossSuppressedReward: 5_000,
      replacementReward: 2_000,
      netLostReward: 3_000,
      causes: [{
        ruleId: 'reward-a',
        capGroup: 'reward-a',
        capType: 'monthly_category',
        capAmount: 5_000,
        rewardBeforeCap: 5_000,
        rewardAfterCap: 0,
      }],
    }];

    const disclosures = collectPortfolioCapLossDisclosures(
      losses,
      new Map([['dining', '외식']]),
    );
    expect(disclosures[0]?.categoryLabel).toBe('외식');
    expect(formatPortfolioCapLossOutcomeKo(disclosures[0]!)).toBe(
      '한도로 제한된 혜택 5,000원 · 다른 혜택으로 대체 2,000원 · 최종 3,000원 감소',
    );
    expect(
      collectPortfolioCapLossDisclosures(undefined, new Map()),
    ).toEqual([]);
  });

  test('wires dashboard, results, and report content to the shared component', async () => {
    const [component, dashboard, results, report] = await Promise.all([
      readFile(
        new URL('../src/components/ui/CapDisclosures.svelte', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/pages/dashboard.astro', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/results.astro', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/components/report/ReportContent.svelte', import.meta.url),
        'utf8',
      ),
    ]);

    expect(component).toContain('analysisStore.cardResults');
    expect(component).toContain(
      'analysisStore.optimization?.portfolioCapLosses',
    );
    expect(component).toContain('data-testid="portfolio-cap-losses"');
    expect(component).toContain('data-testid="cap-reach-events"');
    expect(component).toContain('한도로 줄어든 최종 혜택');
    expect(component).toContain('혜택 한도 도달 내역');
    expect(component).toContain('{#each reachEvents as disclosure}');
    expect(component).toContain(
      '도달 거래 적용 혜택 {formatWon(disclosure.appliedReward)}',
    );
    expect(component).not.toContain('혜택 손실 없음');
    expect(dashboard).toContain('<CapDisclosures client:load />');
    expect(results).toContain('<CapDisclosures client:load />');
    expect(report).toContain('<CapDisclosures />');
  });
});
