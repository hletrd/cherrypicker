import { describe, expect, test } from 'bun:test';
import {
  assertCatalogAvailable,
  assertRequestedCardsResolved,
  attachParseWarningIdentity,
  buildMonthlyBreakdown,
  emptyParseResultMessage,
  getLatestMonth,
  validDateRange,
} from '../src/lib/analyzer-helpers.js';
import {
  categorizeParsedTransactions,
  toCoreTransactions,
} from '../src/lib/analyzer.js';
import { calculateRewards } from '@cherrypicker/core';
import type { CardRuleSet } from '@cherrypicker/rules';

describe('typed transaction fact adapter', () => {
  test('preserves facts and provenance through the web optimizer boundary', () => {
    const categorized = categorizeParsedTransactions(
      [{
        date: '2026-02-10',
        merchant: 'S-OIL',
        amount: 10_000,
        paymentType: 'overseas',
        channel: 'offline',
        fuelVolumeLiters: 12.5,
        performanceExclusionTags: ['annual_fee'],
        factProvenance: {
          paymentType: 'statement',
          channel: 'statement',
          fuelVolumeLiters: 'statement',
          performanceExclusionTags: 'statement',
        },
      }],
      {
        match: () => ({
          category: 'transportation',
          subcategory: 'fuel',
          confidence: 1,
        }),
      },
    );
    const coreTransactions = toCoreTransactions(categorized);

    expect(coreTransactions[0]).toMatchObject({
      paymentType: 'overseas',
      channel: 'offline',
      fuelVolumeLiters: 12.5,
      performanceExclusionTags: ['annual_fee'],
      factProvenance: {
        paymentType: 'statement',
        channel: 'statement',
        fuelVolumeLiters: 'statement',
        performanceExclusionTags: 'statement',
      },
    });

    const cardRule: CardRuleSet = {
      card: {
        id: 'web-fuel-card',
        issuer: 'test',
        name: 'Web Fuel',
        nameKo: '웹 주유',
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
        id: 'fuel-reward',
        category: 'transportation',
        subcategory: 'fuel',
        type: 'discount',
        tiers: [{
          performanceTier: 'tier0',
          rate: null,
          fixedAmount: 100,
          unit: 'won_per_liter',
          value: { kind: 'fuel_per_liter', amount: 100 },
          monthlyCap: null,
          perTransactionCap: null,
          annualCap: null,
        }],
        priority: 1,
        combination: 'exclusive',
        stackingGroup: 'fuel-reward',
        capGroup: 'fuel-reward',
        support: { status: 'supported' },
      }],
      globalConstraints: {
        monthlyTotalDiscountCap: null,
        minimumAnnualSpending: null,
      },
    };

    expect(
      calculateRewards({
        transactions: coreTransactions,
        previousMonthSpending: 0,
        cardRule,
      }).totalReward,
    ).toBe(1_250);
  });

  test.each([200.01, 1e308])(
    'rejects invalid fuel volume %s at parser/core handoffs',
    (fuelVolumeLiters) => {
      const raw = {
        date: '2026-02-10',
        merchant: 'S-OIL',
        amount: 10_000,
        fuelVolumeLiters,
      };
      const matcher = {
        match: () => ({
          category: 'transportation',
          subcategory: 'fuel',
          confidence: 1,
        }),
      };

      expect(() => categorizeParsedTransactions([raw], matcher)).toThrow(
        '유효하지 않은 주유량',
      );
      expect(() => toCoreTransactions([{
        id: 'tx-1',
        ...raw,
        category: 'transportation',
        subcategory: 'fuel',
        confidence: 1,
      }])).toThrow('유효하지 않은 주유량');
    },
  );
});

describe('production month helpers', () => {
  const transactions = [
    { date: '2026-01-15', amount: 50_000 },
    { date: '2026-01-20', amount: 30_000 },
    { date: '2026-01-22', amount: -15_000 },
    { date: '2026-02-10', amount: 40_000 },
    { date: '소계', amount: 99_999 },
  ];

  test('finds the latest parseable month', () => {
    expect(getLatestMonth(transactions)).toBe('2026-02');
    expect(getLatestMonth([])).toBeNull();
  });

  test('counts rows but excludes refunds from gross monthly spending', () => {
    expect(buildMonthlyBreakdown(transactions)).toEqual([
      { month: '2026-01', spending: 80_000, transactionCount: 3 },
      { month: '2026-02', spending: 40_000, transactionCount: 1 },
    ]);
  });

  test('uses only complete ISO dates for statement bounds', () => {
    expect(validDateRange(transactions)).toEqual({
      start: '2026-01-15',
      end: '2026-02-10',
    });
    expect(validDateRange([{ date: '2026-', amount: 1 }])).toBeUndefined();
  });
});

describe('analysis boundary helpers', () => {
  test('fails closed when an explicit card selection resolves to no rules', () => {
    expect(() =>
      assertRequestedCardsResolved(['missing-card'], 0),
    ).toThrow(/선택한 카드 정보를 찾을 수 없어요/);
    expect(() => assertRequestedCardsResolved(undefined, 0)).not.toThrow();
    expect(() => assertRequestedCardsResolved(['card-1'], 1)).not.toThrow();
  });

  test('fails closed when the catalog transformation is empty', () => {
    expect(() => assertCatalogAvailable(0)).toThrow(
      /카드 혜택 데이터를 불러올 수 없어요/,
    );
    expect(() => assertCatalogAvailable(1)).not.toThrow();
  });

  test('attaches file and format identity to every parser warning', () => {
    expect(
      attachParseWarningIdentity(
        [{ line: 3, message: '금액을 읽을 수 없음', raw: 'bad,row' }],
        'march.csv',
        'csv',
      ),
    ).toEqual([
      {
        fileName: 'march.csv',
        format: 'csv',
        line: 3,
        message: '금액을 읽을 수 없음',
        raw: 'bad,row',
      },
    ]);
  });

  test('preserves actionable zero-row parser errors', () => {
    expect(
      emptyParseResultMessage([
        { message: '필수 컬럼을 찾을 수 없습니다: 날짜, 금액' },
      ]),
    ).toBe('필수 컬럼을 찾을 수 없습니다: 날짜, 금액');
    expect(emptyParseResultMessage([])).toBe('거래 내역을 찾을 수 없어요');
  });
});
