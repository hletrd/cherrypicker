import { beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'path';
import {
  loadCategories,
  type CardRuleSet,
  type CategoryNode,
} from '@cherrypicker/rules';
import { calculateRewards } from '../src/calculator/reward.js';
import { MerchantMatcher } from '../src/categorizer/matcher.js';
import { CategoryTaxonomy } from '../src/categorizer/taxonomy.js';
import type { CategorizedTransaction } from '../src/models/transaction.js';

const categoriesPath = join(
  import.meta.dir,
  '../../../packages/rules/data/categories.yaml',
);

const boundaryFixture: CategoryNode[] = [
  {
    id: 'convenience_store',
    labelKo: '편의점',
    labelEn: 'Convenience Store',
    keywords: ['CU'],
  },
  {
    id: 'telecom',
    labelKo: '통신',
    labelEn: 'Telecom',
    keywords: ['KT', 'SKT'],
  },
];

const staticBoundaryFixture: CategoryNode[] = boundaryFixture.map((node) => ({
  ...node,
  keywords: [],
}));

const intendedMerchants = [
  ['CU 서울점', 'convenience_store'],
  ['(cu)편의점', 'convenience_store'],
  ['KT 로밍', 'telecom'],
  ['skt텔레콤', 'telecom'],
] as const;

const nearCollisions = [
  'SECURITY SERVICE',
  'CULTURE CENTER',
  'CUBAN RESTAURANT',
  'SKTECH',
  'BOOKTOWN',
] as const;

function transaction(
  id: string,
  merchant: string,
  category: string,
): CategorizedTransaction {
  return {
    id,
    date: '2026-07-24',
    merchant,
    amount: 10_000,
    currency: 'KRW',
    category,
    confidence: 1,
  };
}

function matchingCard(
  id: string,
  rewards: CardRuleSet['rewards'],
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
      monthlyTotalDiscountCap: null,
      minimumAnnualSpending: null,
    },
  };
}

function percentageReward(
  id: string,
  category: string,
  specificMerchants?: string[],
): CardRuleSet['rewards'][number] {
  return {
    id,
    category,
    type: 'discount',
    tiers: [{
      performanceTier: 'tier0',
      rate: 10,
      monthlyCap: null,
      perTransactionCap: null,
    }],
    conditions: specificMerchants ? { specificMerchants } : undefined,
    combination: 'exclusive',
    stackingGroup: id,
    support: { status: 'supported' },
  };
}

describe('Cycle 10 normalized merchant-term boundaries', () => {
  test('static keywords preserve intended aliases without matching Latin words', () => {
    const matcher = new MerchantMatcher(staticBoundaryFixture);

    for (const [merchant, category] of intendedMerchants) {
      expect(matcher.match(merchant).category, merchant).toBe(category);
    }
    for (const merchant of nearCollisions) {
      expect(matcher.match(merchant).category, merchant).toBe('uncategorized');
    }
  });

  test('taxonomy keywords use the same alias boundaries', () => {
    const taxonomy = new CategoryTaxonomy(boundaryFixture);

    for (const [merchant, category] of intendedMerchants) {
      expect(taxonomy.findCategory(merchant).category, merchant).toBe(category);
    }
    for (const merchant of nearCollisions) {
      expect(taxonomy.findCategory(merchant).category, merchant).toBe(
        'uncategorized',
      );
    }
  });

  test('specific-merchant rules preserve statement variants and reject near-collisions', () => {
    const card = matchingCard('allowlist-boundaries', [
      percentageReward('aliases', '*', ['CU', 'KT', 'SKT']),
    ]);
    const rewardFor = (merchant: string) =>
      calculateRewards({
        transactions: [
          transaction('allowlist', merchant, 'uncategorized'),
        ],
        previousMonthSpending: 0,
        cardRule: card,
      }).totalReward;

    expect(intendedMerchants.map(([merchant]) => rewardFor(merchant))).toEqual([
      1_000,
      1_000,
      1_000,
      1_000,
    ]);
    expect(nearCollisions.map(rewardFor)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('Cycle 10 categorization-to-reward boundary', () => {
  let matcher: MerchantMatcher;

  beforeAll(async () => {
    matcher = new MerchantMatcher(await loadCategories(categoriesPath));
  });

  test('category-only rewards cannot benefit false short-alias merchants', () => {
    const card = matchingCard('category-only-boundaries', [
      percentageReward('convenience', 'convenience_store'),
      percentageReward('telecom', 'telecom'),
    ]);
    const rewardFor = (merchant: string) => {
      const match = matcher.match(merchant);
      return calculateRewards({
        transactions: [
          transaction('category-only', merchant, match.category),
        ],
        previousMonthSpending: 0,
        cardRule: card,
      }).totalReward;
    };

    expect(intendedMerchants.map(([merchant]) => rewardFor(merchant))).toEqual([
      1_000,
      1_000,
      1_000,
      1_000,
    ]);
    expect(nearCollisions.map(rewardFor)).toEqual([0, 0, 0, 0, 0]);
  });
});
