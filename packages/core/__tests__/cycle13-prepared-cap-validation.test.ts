import { describe, expect, test } from 'bun:test';
import type { CardRuleSet, RewardRule } from '@cherrypicker/rules';
import * as publicCore from '../src/index.js';
import { calculateRewards } from '../src/calculator/reward.js';
import type { CategorizedTransaction } from '../src/models/transaction.js';
import { greedyOptimize } from '../src/optimizer/greedy.js';

function transaction(id = 'cycle13-transaction'): CategorizedTransaction {
  return {
    id,
    date: '2026-07-24',
    merchant: 'Cycle 13 merchant',
    amount: 10_000,
    currency: 'KRW',
    category: 'dining',
    confidence: 1,
  };
}

function reward(options: {
  id: string;
  rate: number;
  capGroup?: string;
  monthlyCap?: number | null;
}): RewardRule {
  return {
    id: options.id,
    category: 'dining',
    type: 'discount',
    tiers: [{
      performanceTier: 'tier0',
      rate: options.rate,
      fixedAmount: null,
      unit: null,
      value: { kind: 'percentage', amount: options.rate },
      monthlyCap: options.monthlyCap ?? null,
      perTransactionCap: null,
    }],
    priority: 0,
    combination: 'exclusive',
    stackingGroup: options.id,
    capGroup: options.capGroup ?? options.id,
    support: { status: 'supported' },
  };
}

function card(
  id: string,
  rewards: RewardRule[],
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

function observeStructuralRewardScans(cardRule: CardRuleSet): {
  count: () => number;
  reset: () => void;
} {
  let scans = 0;
  const rewards = cardRule.rewards;
  cardRule.rewards = new Proxy(rewards, {
    get(target, property, receiver) {
      if (property !== 'forEach') {
        return Reflect.get(target, property, receiver);
      }
      return (
        callback: (
          value: RewardRule,
          index: number,
          array: RewardRule[],
        ) => void,
        thisArg?: unknown,
      ) => {
        scans += 1;
        return target.forEach(callback, thisArg);
      };
    },
  });
  return {
    count: () => scans,
    reset: () => {
      scans = 0;
    },
  };
}

function constraints(
  cardRules: CardRuleSet[],
  transactions: CategorizedTransaction[],
) {
  return {
    cards: cardRules.map((cardRule) => ({
      cardId: cardRule.card.id,
      previousMonthSpending: 0,
    })),
    transactions,
    categoryLabels: new Map([['dining', '외식']]),
  };
}

describe('Cycle 13 prepared cap validation', () => {
  test('validates every optimizer card once per invocation without caching direct calls', () => {
    const first = card('cycle13-first', [
      reward({ id: 'first-reward', rate: 5 }),
    ]);
    const second = card('cycle13-second', [
      reward({ id: 'second-reward', rate: 2 }),
    ]);
    const firstScans = observeStructuralRewardScans(first);
    const secondScans = observeStructuralRewardScans(second);
    const transactions = [
      transaction('cycle13-first-transaction'),
      transaction('cycle13-second-transaction'),
    ];
    const input = constraints([first, second], transactions);

    const initial = greedyOptimize(input, [first, second]);

    // One preparation performs the uniqueness scan and cap-coherence scan.
    expect(firstScans.count()).toBe(2);
    expect(secondScans.count()).toBe(2);
    expect(initial.totalReward).toBe(1_000);

    firstScans.reset();
    secondScans.reset();
    expect(greedyOptimize(input, [first, second])).toEqual(initial);
    expect(firstScans.count()).toBe(2);
    expect(secondScans.count()).toBe(2);

    firstScans.reset();
    const direct = calculateRewards({
      cardRule: first,
      transactions,
      previousMonthSpending: 0,
    });
    const optimizedCard = initial.cardResults[0]!;
    expect(optimizedCard.cardId).toBe(direct.cardId);
    expect(optimizedCard.totalReward).toBe(direct.totalReward);
    expect(optimizedCard.totalSpending).toBe(direct.totalSpending);
    expect(optimizedCard.performanceTier).toBe(direct.performanceTier);
    expect(optimizedCard.capsHit).toEqual(direct.capsHit);
    expect(
      optimizedCard.byCategory.map((category) => ({
        category: category.category,
        spending: category.spending,
        reward: category.reward,
        rate: category.rate,
        rewardType: category.rewardType,
        capReached: category.capReached,
      })),
    ).toEqual(
      direct.rewards.map((category) => ({
        category: category.category,
        spending: category.spending,
        reward: category.reward,
        rate: category.rate,
        rewardType: category.rewardType,
        capReached: category.capReached,
      })),
    );
    calculateRewards({
      cardRule: first,
      transactions,
      previousMonthSpending: 0,
    });
    expect(firstScans.count()).toBe(4);
  });

  test('keeps preparation and unchecked calculation outside the public barrel', () => {
    expect(publicCore).not.toHaveProperty('prepareCardRuleForCalculation');
    expect(publicCore).not.toHaveProperty('calculateRewardsWithPreparedCard');
  });

  test('rejects a malformed executable card before an empty optimization can return', () => {
    const malformed = card('cycle13-malformed', [
      reward({
        id: 'first-shared',
        rate: 5,
        capGroup: 'shared',
        monthlyCap: 100,
      }),
      reward({
        id: 'second-shared',
        rate: 2,
        capGroup: 'shared',
        monthlyCap: 200,
      }),
    ]);

    expect(() =>
      greedyOptimize(constraints([malformed], []), [malformed])
    ).toThrow(
      'cap group "shared" defines monthlyCap 200 for performance tier ' +
        '"tier0", but rewards.0.tiers.0.monthlyCap defines 100',
    );
  });

  test('public calculation revalidates a mutable rule object on every call', () => {
    const mutable = card('cycle13-mutable', [
      reward({
        id: 'first-shared',
        rate: 5,
        capGroup: 'shared',
        monthlyCap: 100,
      }),
      reward({
        id: 'second-shared',
        rate: 2,
        capGroup: 'shared',
        monthlyCap: 100,
      }),
    ]);

    expect(calculateRewards({
      cardRule: mutable,
      transactions: [],
      previousMonthSpending: 0,
    }).totalReward).toBe(0);

    mutable.rewards[1]!.tiers[0]!.monthlyCap = 200;
    expect(() =>
      calculateRewards({
        cardRule: mutable,
        transactions: [],
        previousMonthSpending: 0,
      })
    ).toThrow('cap group "shared" defines monthlyCap 200');
  });
});
