import { describe, expect, test } from 'bun:test';
import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import { buildConstraints } from '../src/optimizer/constraints.js';
import {
  compareRewardRelevantTransactions,
  greedyOptimize,
} from '../src/optimizer/greedy.js';

type RewardRule = CardRuleSet['rewards'][number];
type RewardConditions = NonNullable<RewardRule['conditions']>;
type RewardKind = RewardRule['tiers'][number]['value']['kind'];

const CATEGORY_LABELS = new Map([
  ['dining', '외식'],
  ['dining.cafe', '카페'],
  ['dining.restaurant', '음식점'],
  ['grocery', '식료품'],
  ['transportation', '교통'],
]);

function transaction(
  id: string,
  overrides: Partial<CategorizedTransaction> = {},
): CategorizedTransaction {
  return {
    id,
    date: '2026-07-24',
    merchant: 'SAME MERCHANT',
    amount: 10_000,
    currency: 'KRW',
    paymentType: 'domestic',
    channel: 'online',
    factProvenance: {
      paymentType: 'statement',
      channel: 'statement',
    },
    category: 'dining',
    confidence: 1,
    ...overrides,
  };
}

function rewardRule(options: {
  id: string;
  category?: string;
  subcategory?: string;
  amount: number;
  kind?: RewardKind;
  conditions?: RewardConditions;
  monthlyCap?: number | null;
  capGroup?: string;
  support?: RewardRule['support'];
}): RewardRule {
  const kind = options.kind ?? 'percentage';
  return {
    id: options.id,
    category: options.category ?? '*',
    subcategory: options.subcategory,
    type: 'discount',
    tiers: [{
      performanceTier: 'tier0',
      rate: kind === 'percentage' ? options.amount : null,
      fixedAmount: kind === 'percentage' ? null : options.amount,
      unit: kind === 'fixed_per_day'
        ? 'won_per_day'
        : kind === 'fuel_per_liter'
          ? 'won_per_liter'
          : null,
      value: { kind, amount: options.amount },
      monthlyCap: options.monthlyCap ?? null,
      perTransactionCap: null,
    }],
    conditions: options.conditions,
    priority: 0,
    combination: 'exclusive',
    stackingGroup: options.id,
    capGroup: options.capGroup ?? options.id,
    support: options.support ?? { status: 'supported' },
  };
}

function card(
  id: string,
  rewards: RewardRule[],
  monthlyTotalDiscountCap: number | null = null,
): CardRuleSet {
  return {
    card: {
      id,
      issuer: 'fixture',
      name: id,
      nameKo: id,
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      lastUpdated: '2026-07-24',
      source: 'manual',
    },
    performanceTiers: [{
      id: 'tier0',
      label: '무실적',
      minSpending: 0,
      maxSpending: null,
    }],
    performanceExclusions: [],
    rewards,
    globalConstraints: {
      monthlyTotalDiscountCap,
      minimumAnnualSpending: null,
    },
  };
}

function optimize(
  transactions: CategorizedTransaction[],
  cards: CardRuleSet[],
) {
  return greedyOptimize(
    buildConstraints(
      transactions,
      new Map(cards.map((candidate) => [candidate.card.id, 0])),
      CATEGORY_LABELS,
    ),
    cards,
  );
}

function expectOrderInvariant(
  transactions: [CategorizedTransaction, CategorizedTransaction],
  cards: CardRuleSet[],
) {
  const forward = optimize(transactions, cards);
  const reverse = optimize([...transactions].reverse(), cards);
  expect(reverse).toEqual(forward);
  return forward;
}

describe('greedy optimizer reward-fact ordering', () => {
  test('the comparator covers every immutable reward fact and excludes upload identity', () => {
    const baseline = transaction('upload-identity-a', {
      date: '2026-07-24',
      merchant: 'MERCHANT SHOP',
      amount: 10_000,
      currency: 'KRW',
      installments: 2,
      rawCategory: 'authored-category',
      memo: 'authored memo',
      paymentType: 'domestic',
      channel: 'online',
      fuelVolumeLiters: 10,
      performanceExclusionTags: ['tax_payment'],
      factProvenance: {
        paymentType: 'statement',
        channel: 'statement',
        fuelVolumeLiters: 'statement',
        performanceExclusionTags: 'statement',
      },
      category: 'dining',
      subcategory: 'cafe',
      confidence: 1,
    });
    const variants: Array<
      [string, (source: CategorizedTransaction) => CategorizedTransaction]
    > = [
      ['amount', (source) => ({ ...source, amount: 9_999 })],
      ['normalized merchant', (source) => ({
        ...source,
        merchant: 'OTHER MERCHANT',
      })],
      ['date', (source) => ({ ...source, date: '2026-07-25' })],
      ['category', (source) => ({ ...source, category: 'grocery' })],
      ['subcategory', (source) => ({
        ...source,
        subcategory: 'restaurant',
      })],
      ['payment type', (source) => ({
        ...source,
        paymentType: 'overseas',
      })],
      ['channel', (source) => ({ ...source, channel: 'offline' })],
      ['fuel volume', (source) => ({
        ...source,
        fuelVolumeLiters: 11,
      })],
      ['payment provenance', (source) => ({
        ...source,
        factProvenance: {
          ...source.factProvenance,
          paymentType: 'user',
        },
      })],
      ['channel provenance', (source) => ({
        ...source,
        factProvenance: {
          ...source.factProvenance,
          channel: 'user',
        },
      })],
      ['fuel provenance', (source) => ({
        ...source,
        factProvenance: {
          ...source.factProvenance,
          fuelVolumeLiters: 'user',
        },
      })],
      ['exclusion provenance', (source) => ({
        ...source,
        factProvenance: {
          ...source.factProvenance,
          performanceExclusionTags: 'user',
        },
      })],
      ['installments', (source) => ({ ...source, installments: 3 })],
      ['exclusion tags', (source) => ({
        ...source,
        performanceExclusionTags: ['gift_card'],
      })],
      ['currency', (source) => ({ ...source, currency: 'USD' })],
      ['raw category', (source) => ({
        ...source,
        rawCategory: 'other-category',
      })],
      ['memo', (source) => ({ ...source, memo: 'other memo' })],
    ];

    for (const [label, mutate] of variants) {
      const variant = mutate(baseline);
      const forward = compareRewardRelevantTransactions(baseline, variant);
      const reverse = compareRewardRelevantTransactions(variant, baseline);
      expect(forward, `${label} must break the tie`).not.toBe(0);
      expect(
        Math.sign(reverse),
        `${label} comparison must be antisymmetric`,
      ).toBe(-Math.sign(forward));
    }

    expect(compareRewardRelevantTransactions(
      baseline,
      {
        ...baseline,
        id: 'upload-identity-b',
        merchant: 'merchant   shop',
        confidence: 0.25,
        performanceExclusionTags: ['tax_payment', 'tax_payment'],
      },
    )).toBe(0);
  });

  test('category ties are invariant while a global cap is consumed', () => {
    const cards = [
      card('card-a', [
        rewardRule({ id: 'a-dining', category: 'dining', amount: 10 }),
        rewardRule({ id: 'a-grocery', category: 'grocery', amount: 5 }),
      ], 500),
      card('card-b', [
        rewardRule({ id: 'b-grocery', category: 'grocery', amount: 4 }),
      ]),
    ];
    const result = expectOrderInvariant([
      transaction('dining', { category: 'dining' }),
      transaction('grocery', { category: 'grocery' }),
    ], cards);

    expect(result.totalReward).toBe(900);
    expect(result.unassignedSpending).toBe(0);
  });

  test('subcategory ties are invariant while a category cap is consumed', () => {
    const sharedCap = 'card-a-dining-cap';
    const cards = [
      card('card-a', [
        rewardRule({
          id: 'a-cafe',
          category: 'dining',
          subcategory: 'cafe',
          amount: 10,
          monthlyCap: 500,
          capGroup: sharedCap,
        }),
        rewardRule({
          id: 'a-restaurant',
          category: 'dining',
          subcategory: 'restaurant',
          amount: 5,
          monthlyCap: 500,
          capGroup: sharedCap,
        }),
      ]),
      card('card-b', [
        rewardRule({
          id: 'b-restaurant',
          category: 'dining',
          subcategory: 'restaurant',
          amount: 4,
        }),
      ]),
    ];

    expectOrderInvariant([
      transaction('cafe', { subcategory: 'cafe' }),
      transaction('restaurant', { subcategory: 'restaurant' }),
    ], cards);
  });

  test('channel ties are invariant while a cap is consumed', () => {
    const cards = [
      card('card-a', [
        rewardRule({
          id: 'a-online',
          category: 'dining',
          amount: 10,
          conditions: { channel: 'online' },
        }),
        rewardRule({
          id: 'a-offline',
          category: 'dining',
          amount: 5,
          conditions: { channel: 'offline' },
        }),
      ], 500),
      card('card-b', [
        rewardRule({
          id: 'b-offline',
          category: 'dining',
          amount: 4,
          conditions: { channel: 'offline' },
        }),
      ]),
    ];

    expectOrderInvariant([
      transaction('online', { channel: 'online' }),
      transaction('offline', { channel: 'offline' }),
    ], cards);
  });

  test('payment-type ties are invariant while a cap is consumed', () => {
    const cards = [
      card('card-a', [
        rewardRule({
          id: 'a-domestic',
          category: 'dining',
          amount: 10,
          conditions: { paymentType: 'domestic' },
        }),
        rewardRule({
          id: 'a-overseas',
          category: 'dining',
          amount: 5,
          conditions: { paymentType: 'overseas' },
        }),
      ], 500),
      card('card-b', [
        rewardRule({
          id: 'b-overseas',
          category: 'dining',
          amount: 4,
          conditions: { paymentType: 'overseas' },
        }),
      ]),
    ];

    expectOrderInvariant([
      transaction('domestic', { paymentType: 'domestic' }),
      transaction('overseas', { paymentType: 'overseas' }),
    ], cards);
  });

  test.each([
    ['fixed-per-day', rewardRule({
      id: 'a-fixed-day',
      amount: 500,
      kind: 'fixed_per_day',
    })],
    ['max-use', rewardRule({
      id: 'a-max-use',
      amount: 5,
      conditions: { maxUses: 1, usePeriod: 'day' },
    })],
  ])('%s state is invariant across tied transaction permutations', (
    _label,
    statefulRule,
  ) => {
    const cards = [
      card('card-a', [statefulRule]),
      card('card-b', [
        rewardRule({ id: 'b-grocery', category: 'grocery', amount: 4 }),
      ]),
    ];

    expectOrderInvariant([
      transaction('dining', { category: 'dining' }),
      transaction('grocery', { category: 'grocery' }),
    ], cards);
  });

  test('fuel-fact ties are invariant while a cap is consumed', () => {
    const cards = [
      card('card-a', [
        rewardRule({
          id: 'a-fuel',
          category: 'transportation',
          amount: 100,
          kind: 'fuel_per_liter',
        }),
      ], 500),
      card('card-b', [
        rewardRule({
          id: 'b-fuel',
          category: 'transportation',
          amount: 40,
          kind: 'fuel_per_liter',
        }),
      ]),
    ];

    expectOrderInvariant([
      transaction('ten-liters', {
        category: 'transportation',
        fuelVolumeLiters: 10,
        factProvenance: { fuelVolumeLiters: 'statement' },
      }),
      transaction('five-liters', {
        category: 'transportation',
        fuelVolumeLiters: 5,
        factProvenance: { fuelVolumeLiters: 'statement' },
      }),
    ], cards);
  });

  test('equivalent reward facts keep disclosure arrays stable without ID ordering', () => {
    const cards = [
      card('card-a', [
        rewardRule({ id: 'supported', category: 'dining', amount: 5 }),
        rewardRule({
          id: 'unsupported-disclosure',
          category: 'dining',
          amount: 50,
          support: {
            status: 'unsupported',
            reason: 'fixture disclosure',
          },
        }),
      ]),
    ];
    const first = transaction('upload-z');
    const second = transaction('upload-a');

    const result = expectOrderInvariant([first, second], cards);
    expect(result.assignments[0]?.transactionCount).toBe(2);
    expect(result.unsupportedRules?.map(({ transactionId }) => transactionId))
      .toEqual(['upload-a', 'upload-z']);
    expect(
      result.cardResults[0]?.unsupportedRules?.map(
        ({ transactionId }) => transactionId,
      ),
    ).toEqual(['upload-a', 'upload-z']);
  });
});
