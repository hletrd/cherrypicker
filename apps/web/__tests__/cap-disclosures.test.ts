import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import type { CardRewardResult } from '@cherrypicker/core';
import {
  collectCapDisclosures,
  formatCapOutcomeKo,
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
    expect(formatCapOutcomeKo(disclosures[0]!)).toBe('1,000원 혜택 손실');
    expect(formatCapOutcomeKo(disclosures[1]!)).toBe('혜택 손실 없음');
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
    expect(component).toContain('data-testid="cap-disclosures"');
    expect(component).toContain('혜택 한도 도달 내역');
    expect(component).toContain('{#each disclosures as disclosure}');
    expect(component).toContain(
      '적용 혜택 {formatWon(disclosure.appliedReward)}',
    );
    expect(dashboard).toContain('<CapDisclosures client:load />');
    expect(results).toContain('<CapDisclosures client:load />');
    expect(report).toContain('<CapDisclosures />');
  });
});
