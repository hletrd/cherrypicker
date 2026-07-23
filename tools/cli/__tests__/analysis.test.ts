import { describe, expect, test } from 'bun:test';
import { buildConstraints, optimize } from '@cherrypicker/core';
import type { CategorizedTransaction } from '@cherrypicker/core';
import type { RawTransaction } from '@cherrypicker/parser/types';
import type { CardRuleSet } from '@cherrypicker/rules';
import {
  calendarScopeWarnings,
  categorizeRawTransactions,
  prepareCliAnalysis,
} from '../src/analysis.js';

const labels = new Map([
  ['online_shopping', '온라인 쇼핑'],
  ['dining', '외식'],
]);

function cappedCard(
  monthlyCap: number | null,
  globalCap: number | null,
): CardRuleSet {
  return {
    card: {
      id: `cap-${monthlyCap ?? 'none'}-${globalCap ?? 'none'}`,
      issuer: 'test',
      name: 'Cap Test',
      nameKo: '한도 테스트',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      lastUpdated: '2026-07-23',
      source: 'manual',
    },
    performanceTiers: [{
      id: 'tier0',
      label: '무실적',
      minSpending: 0,
      maxSpending: null,
    }],
    performanceExclusions: [],
    rewards: [{
      id: 'reward-001',
      category: '*',
      type: 'discount',
      tiers: [{
        performanceTier: 'tier0',
        rate: 10,
        fixedAmount: null,
        unit: null,
        value: { kind: 'percentage', amount: 10 },
        monthlyCap,
        perTransactionCap: null,
        annualCap: null,
      }],
      priority: 1,
      combination: 'exclusive',
      stackingGroup: 'reward-001',
      capGroup: 'reward-001',
      support: { status: 'supported' },
    }],
    globalConstraints: {
      monthlyTotalDiscountCap: globalCap,
      minimumAnnualSpending: null,
    },
  };
}

function transaction(
  id: string,
  date: string,
  amount: number,
  category = 'dining',
): CategorizedTransaction {
  return {
    id,
    date,
    merchant: id,
    amount,
    currency: 'KRW',
    category,
    confidence: 1,
  };
}

function optimizePrepared(
  transactions: CategorizedTransaction[],
  card: CardRuleSet,
) {
  const prepared = prepareCliAnalysis(transactions, [card]);
  return {
    prepared,
    result: optimize(
      buildConstraints(
        prepared.context.latestTransactions,
        prepared.cardPreviousSpending,
        labels,
      ),
      [card],
    ),
  };
}

describe('CLI typed fact propagation', () => {
  test('preserves parser facts and uses exact previous-month tags for tiers', () => {
    const card: CardRuleSet = {
      ...cappedCard(null, null),
      card: {
        ...cappedCard(null, null).card,
        id: 'typed-fact-card',
      },
      performanceTiers: [
        {
          id: 'tier0',
          label: '30만원 미만',
          minSpending: 0,
          maxSpending: 299_999,
        },
        {
          id: 'tier1',
          label: '30만원 이상',
          minSpending: 300_000,
          maxSpending: null,
        },
      ],
      performanceExclusions: ['tax_payment'],
      rewards: [{
        id: 'overseas-reward',
        category: 'online_shopping',
        type: 'discount',
        conditions: { paymentType: 'overseas' },
        tiers: [
          {
            performanceTier: 'tier0',
            rate: 0,
            fixedAmount: null,
            unit: null,
            value: { kind: 'percentage', amount: 0 },
            monthlyCap: null,
            perTransactionCap: null,
            annualCap: null,
          },
          {
            performanceTier: 'tier1',
            rate: 5,
            fixedAmount: null,
            unit: null,
            value: { kind: 'percentage', amount: 5 },
            monthlyCap: null,
            perTransactionCap: null,
            annualCap: null,
          },
        ],
        priority: 1,
        combination: 'exclusive',
        stackingGroup: 'overseas-reward',
        capGroup: 'overseas-reward',
        support: { status: 'supported' },
      }],
    };
    const raw: RawTransaction[] = [
      {
        date: '2026-02-10',
        merchant: 'AliExpress',
        amount: 10_000,
        paymentType: 'overseas',
        channel: 'online',
        fuelVolumeLiters: 8.5,
        performanceExclusionTags: ['annual_fee'],
        factProvenance: {
          paymentType: 'statement',
          channel: 'statement',
          fuelVolumeLiters: 'statement',
          performanceExclusionTags: 'statement',
        },
      },
      {
        date: '2026-01-20',
        merchant: '전월 일반 결제',
        amount: 300_000,
        paymentType: 'domestic',
        performanceExclusionTags: [],
        factProvenance: {
          paymentType: 'statement',
          performanceExclusionTags: 'statement',
        },
      },
    ];
    const categorized = categorizeRawTransactions(raw, {
      match: () => ({ category: 'online_shopping', confidence: 1 }),
    });
    const prepared = prepareCliAnalysis(categorized, [card]);
    const result = optimize(
      buildConstraints(
        prepared.context.latestTransactions,
        prepared.cardPreviousSpending,
        labels,
      ),
      [card],
    );

    expect(categorized[0]).toMatchObject({
      paymentType: 'overseas',
      channel: 'online',
      fuelVolumeLiters: 8.5,
      performanceExclusionTags: ['annual_fee'],
      factProvenance: {
        paymentType: 'statement',
        channel: 'statement',
        fuelVolumeLiters: 'statement',
        performanceExclusionTags: 'statement',
      },
    });
    expect(prepared.cardPreviousSpending.get(card.card.id)).toBe(300_000);
    expect(prepared.performanceIssues).toEqual([]);
    expect(result.totalSpending).toBe(10_000);
    expect(result.totalReward).toBe(500);
  });
});

describe('CLI calendar-scoped optimization', () => {
  test('does not let an earlier month consume the latest monthly category cap', () => {
    const card = cappedCard(1_000, null);
    const transactions = [
      transaction('february', '2026-02-10', 5_000),
      transaction('january', '2026-01-10', 10_000),
    ];
    const { prepared, result } = optimizePrepared(transactions, card);
    const pooled = optimize(
      buildConstraints(transactions, new Map([[card.card.id, 0]]), labels),
      [card],
    );

    expect(prepared.context.latestMonth).toBe('2026-02');
    expect(result.totalSpending).toBe(5_000);
    expect(result.totalReward).toBe(500);
    expect(pooled.totalReward).toBe(1_000);
  });

  test('does not let an earlier month consume the latest global cap', () => {
    const card = cappedCard(null, 1_000);
    const transactions = [
      transaction('february', '2026-02-10', 5_000),
      transaction('january', '2026-01-10', 10_000),
    ];
    const { result } = optimizePrepared(transactions, card);
    const pooled = optimize(
      buildConstraints(transactions, new Map([[card.card.id, 0]]), labels),
      [card],
    );

    expect(result.totalSpending).toBe(5_000);
    expect(result.totalReward).toBe(500);
    expect(pooled.totalReward).toBe(1_000);
  });

  test('uses only the exact predecessor and warns for quarantined dates', () => {
    const card = cappedCard(null, null);
    const invalid = transaction('invalid', '2026-99-99', 99_000);
    const { prepared } = optimizePrepared([
      transaction('march', '2026-03-10', 5_000),
      transaction('january', '2026-01-10', 10_000),
      invalid,
    ], card);
    const warnings = calendarScopeWarnings(prepared.context);

    expect(prepared.context.previousSpendingBasis).toEqual({
      kind: 'missing-calendar-month',
      month: '2026-02',
      assumedAmount: 0,
    });
    expect(prepared.context.invalidDateTransactions).toEqual([invalid]);
    expect(warnings).toContainEqual(expect.stringContaining('2026-99-99'));
    expect(warnings).toContainEqual(expect.stringContaining('2026-03'));
  });
});
