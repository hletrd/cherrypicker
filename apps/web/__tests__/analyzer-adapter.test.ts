import { describe, expect, test } from 'bun:test';
import {
  assertCatalogAvailable,
  assertRequestedCardsResolved,
  attachParseWarningIdentity,
  buildMonthlyBreakdown,
  getLatestMonth,
  toRulesCategoryNodes,
  validDateRange,
} from '../src/lib/analyzer-helpers.js';

describe('production category adapter', () => {
  test('projects nested web categories into the rules shape', () => {
    expect(
      toRulesCategoryNodes([
        {
          id: 'dining',
          label: '외식',
          labelKo: '외식',
          keywords: ['식당'],
          subcategories: [
            {
              id: 'cafe',
              label: '카페',
              labelKo: '카페',
              keywords: ['커피'],
            },
          ],
        },
      ]),
    ).toEqual([
      {
        id: 'dining',
        labelKo: '외식',
        labelEn: '',
        keywords: ['식당'],
        subcategories: [
          {
            id: 'cafe',
            labelKo: '카페',
            labelEn: '',
            keywords: ['커피'],
          },
        ],
      },
    ]);
  });

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
});
