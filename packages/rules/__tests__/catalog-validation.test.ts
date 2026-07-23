import { beforeAll, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MerchantMatcher } from '../../core/src/categorizer/matcher.js';
import {
  CatalogValidationError,
  CategoryRegistry,
  buildCategoryKey,
  collectCardRuleIssues,
  collectUnmodeledRuleRestrictions,
  loadAllCardRules,
  loadCategories,
  validateCardCatalog,
  validateCardRuleSet,
} from '../src/index.js';
import type { CardRuleSet } from '../src/types.js';

const dataDir = join(import.meta.dir, '../data');
let registry: CategoryRegistry;
let cards: CardRuleSet[];
let matcher: MerchantMatcher;
let unverifiedScopeInventory: string[];

beforeAll(async () => {
  const categories = await loadCategories(join(dataDir, 'categories.yaml'));
  registry = new CategoryRegistry(categories);
  matcher = new MerchantMatcher(categories, { strict: true });
  cards = await loadAllCardRules(join(dataDir, 'cards'));
  const inventory = JSON.parse(
    await readFile(
      join(
        dataDir,
        '../../../.context/plans/68-unverified-merchant-scope-inventory.json',
      ),
      'utf8',
    ),
  ) as { count: number; rules: string[] };
  expect(inventory.count).toBe(129);
  unverifiedScopeInventory = inventory.rules;
});

describe('catalog semantic validation', () => {
  test('the complete authored catalog uses reachable category and tier references', () => {
    expect(cards).toHaveLength(683);
    expect(() =>
      validateCardCatalog(cards, registry, {
        resolveMerchant: (merchant) => {
          const resolved = matcher.match(merchant);
          return {
            category: resolved.category,
            subcategory: resolved.subcategory,
          };
        },
      }),
    ).not.toThrow();
  });

  test('invalid category pairs fail publication', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [{
        ...cards[0]!.rewards[0]!,
        category: 'utilities',
        subcategory: 'cafe',
      }],
    };
    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      CatalogValidationError,
    );
  });

  test('legacy bare leaves fail until authored as a canonical parent pair', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [{
        ...cards[0]!.rewards[0]!,
        category: 'cafe',
        subcategory: undefined,
      }],
    };
    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /non-canonical category/,
    );
  });

  test('unknown tier references fail publication', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [{
        ...cards[0]!.rewards[0]!,
        tiers: [{
          ...cards[0]!.rewards[0]!.tiers[0]!,
          performanceTier: 'missing-tier',
        }],
      }],
    };
    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /unknown performance tier/,
    );
  });

  test('general-spend language cannot hide behind uncategorized', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [{
        ...cards[0]!.rewards[0]!,
        category: 'uncategorized',
        subcategory: undefined,
        label: '전 가맹점 기본 적립',
      }],
    };
    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /must use wildcard/,
    );
  });

  test('positive uncategorized rules cannot remain supported with unverified scope', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [{
        ...cards[0]!.rewards[0]!,
        category: 'uncategorized',
        subcategory: undefined,
        label: undefined,
        conditions: undefined,
        support: { status: 'supported' },
      }],
    };

    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /unverified scope/,
    );
  });

  test('full catalog fail-closed scope inventory is exact and deterministic', () => {
    const unverified = cards.flatMap((card) =>
      card.rewards
        .filter(
          (rule) =>
            rule.support.status === 'unsupported' &&
            rule.support.reason === 'unverified_merchant_scope',
        )
        .map((rule) => `${card.card.id}:${rule.id}`),
    );
    const supportedAmbiguous = cards.flatMap((card) =>
      card.rewards.filter(
        (rule) =>
          rule.support.status === 'supported' &&
          rule.category === 'uncategorized' &&
          !rule.subcategory &&
          (rule.conditions?.specificMerchants?.length ?? 0) === 0 &&
          rule.tiers.some(
            (tier) => (tier.rate ?? 0) > 0 || (tier.fixedAmount ?? 0) > 0,
          ),
      ),
    );

    expect(unverified).toHaveLength(129);
    expect(new Set(unverified).size).toBe(129);
    expect([...unverified].sort()).toEqual(unverifiedScopeInventory);
    expect(supportedAmbiguous).toHaveLength(0);
  });

  test('duplicate card IDs fail a complete catalog', () => {
    expect(() => validateCardCatalog([cards[0]!, cards[0]!], registry)).toThrow(
      /duplicate card id/,
    );
  });

  test('supported rules cannot rely on material eligibility prose', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [
        {
          ...cards[0]!.rewards[0]!,
          label: '점심시간 11시~14시만 적립',
          support: { status: 'supported' },
        },
      ],
    };
    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /material eligibility prose/,
    );

    invalid.rewards[0]!.support = {
      status: 'unsupported',
      reason: 'statement rows do not carry time-of-day provenance',
    };
    expect(() => validateCardRuleSet(invalid, registry)).not.toThrow();
  });

  test('compact N~N시 time windows are material restrictions', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [{
        ...cards[0]!.rewards[0]!,
        label: '음식점 오전할인 (07~15시)',
        support: { status: 'supported' },
      }],
    };

    expect(collectUnmodeledRuleRestrictions(invalid.rewards[0]!)).toContain(
      'time_of_day',
    );
    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /time_of_day/,
    );
  });

  test('supported rewards require a positive modeled value', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [{
        ...cards[0]!.rewards[0]!,
        support: { status: 'supported' },
        tiers: cards[0]!.rewards[0]!.tiers.map((tier) => ({
          ...tier,
          rate: 0,
          fixedAmount: null,
          value: { kind: 'percentage', amount: 0 },
        })),
      }],
    };

    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /no positive modeled value/,
    );
  });

  test('supported tiers must use reward shapes the calculator can execute', () => {
    const baseRule = cards[0]!.rewards[0]!;
    const invalidShapes: CardRuleSet[] = [
      {
        ...cards[0]!,
        rewards: [{
          ...baseRule,
          support: { status: 'supported' },
          tiers: [{
            ...baseRule.tiers[0]!,
            rate: 1,
            fixedAmount: null,
            unit: 'miles',
            value: { kind: 'mileage_per_spend', amount: 1 },
          }],
        }],
      },
      {
        ...cards[0]!,
        rewards: [{
          ...baseRule,
          support: { status: 'supported' },
          tiers: [{
            ...baseRule.tiers[0]!,
            rate: null,
            fixedAmount: 1,
            unit: 'miles',
            value: { kind: 'mileage_per_spend', amount: 1 },
          }],
        }],
      },
    ];

    for (const invalid of invalidShapes) {
      expect(
        collectCardRuleIssues(invalid, registry).map((issue) => issue.code),
      ).toContain('unexecutable_reward_tier');
    }

    invalidShapes[0]!.rewards[0]!.support = {
      status: 'unsupported',
      reason: 'valuation contract is not modeled',
    };
    expect(
      collectCardRuleIssues(invalidShapes[0]!, registry)
        .some((issue) => issue.code === 'unexecutable_reward_tier'),
    ).toBe(false);
  });

  test('positive annual caps require an explicitly unsupported rule', () => {
    const simplePlan = cards.find(
      (card) => card.card.id === 'shinhan-simple-plan',
    )!;
    const annualCapCard = structuredClone(simplePlan);
    annualCapCard.rewards[0]!.tiers[0]!.annualCap = 1_000;

    expect(
      collectCardRuleIssues(annualCapCard, registry),
    ).toContainEqual(
      expect.objectContaining({
        code: 'unmodeled_annual_cap',
        path: 'rewards.0.tiers.0.annualCap',
      }),
    );
    expect(() => validateCardRuleSet(annualCapCard, registry)).toThrow(
      /positive annualCap/,
    );

    annualCapCard.rewards[0]!.support = {
      status: 'unsupported',
      reason: 'year-to-date reward usage is not available',
    };
    expect(
      collectCardRuleIssues(annualCapCard, registry)
        .some((issue) => issue.code === 'unmodeled_annual_cap'),
    ).toBe(false);
  });

  test('preserves the tracked explicitly unsupported annual-cap rule', () => {
    const tracked = cards.find(
      (card) => card.card.id === 'hyundai-three-body-a',
    )!;
    const annualCapRule = tracked.rewards.find((rule) =>
      rule.tiers.some((tier) => (tier.annualCap ?? 0) > 0)
    );

    expect(annualCapRule?.support.status).toBe('unsupported');
    expect(
      collectCardRuleIssues(tracked, registry)
        .some((issue) => issue.code === 'unmodeled_annual_cap'),
    ).toBe(false);
  });

  test('Samsung mileage rules fail closed until a valuation contract exists', () => {
    const samsungMileage = cards.find(
      (card) => card.card.id === 'samsung-and-mileage-platinum',
    )!;
    const affectedRuleIds = new Set([
      'reward-002',
      'reward-003',
      'reward-004',
      'reward-005',
      'reward-006',
    ]);

    expect(samsungMileage.rewards[0]!.support.status).toBe('supported');
    expect(
      samsungMileage.rewards
        .filter((rule) => affectedRuleIds.has(rule.id))
        .map((rule) => [rule.id, rule.support.status]),
    ).toEqual([
      ['reward-002', 'unsupported'],
      ['reward-003', 'unsupported'],
      ['reward-004', 'unsupported'],
      ['reward-005', 'unsupported'],
      ['reward-006', 'unsupported'],
    ]);
    expect(
      cards.flatMap((card) =>
        card.rewards.flatMap((rule) =>
          rule.support.status === 'supported'
            ? rule.tiers
                .filter((tier) =>
                  ((tier.rate ?? 0) > 0 && tier.unit !== null) ||
                  ((tier.fixedAmount ?? 0) > 0 && tier.unit === 'miles')
                )
                .map((tier) =>
                  `${card.card.id}:${rule.id}:${tier.performanceTier}`,
                )
            : [],
        ),
      ),
    ).toEqual([]);
  });

  test('ignored global constraints require every affected reward to fail closed', () => {
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [{
        ...cards[0]!.rewards[0]!,
        support: { status: 'supported' },
      }],
      globalConstraints: {
        ...cards[0]!.globalConstraints,
        minimumAnnualSpending: 2_400_000,
      },
    };

    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /monthly calculator cannot execute/,
    );
    invalid.rewards[0]!.support = {
      status: 'unsupported',
      reason: 'unmodeled_global_constraints',
    };
    expect(() => validateCardRuleSet(invalid, registry)).not.toThrow();
  });

  test('real catalog has zero supported false-exact domain cases', () => {
    const supported = cards.flatMap((card) =>
      card.rewards.map((rule) => ({ card, rule }))
        .filter(({ rule }) => rule.support.status === 'supported'),
    );

    expect(
      supported.filter(({ rule }) => {
        const resolved = registry.resolvePair(rule.category, rule.subcategory);
        return (
          !resolved.value ||
          buildCategoryKey(
            resolved.value.category,
            resolved.value.subcategory,
          ) !== buildCategoryKey(rule.category, rule.subcategory)
        );
      }),
    ).toHaveLength(0);
    expect(
      supported.filter(({ rule }) =>
        rule.tiers.every(
          (tier) => (tier.rate ?? 0) === 0 && (tier.fixedAmount ?? 0) === 0,
        )
      ),
    ).toHaveLength(0);
    expect(
      supported.filter(
        ({ rule }) => collectUnmodeledRuleRestrictions(rule).length > 0,
      ),
    ).toHaveLength(0);
    expect(
      cards.filter((card) => {
        const constraints = card.globalConstraints;
        const hasUnmodeledGlobal =
          (constraints.minimumAnnualSpending ?? 0) > 0 ||
          (constraints.monthlyMileageCap ?? 0) > 0 ||
          (constraints.annualBonusMileage ?? 0) > 0 ||
          (constraints.note?.trim().length ?? 0) > 0;
        return (
          hasUnmodeledGlobal &&
          card.rewards.some((rule) => rule.support.status === 'supported')
        );
      }),
    ).toHaveLength(0);
  });

  test('same-scope rules with identical conditions cannot both be supported', () => {
    const first = {
      ...cards[0]!.rewards[0]!,
      id: 'duplicate-a',
      capGroup: 'duplicate-a',
      support: { status: 'supported' as const },
    };
    const invalid: CardRuleSet = {
      ...cards[0]!,
      rewards: [
        first,
        {
          ...first,
          id: 'duplicate-b',
          capGroup: 'duplicate-b',
        },
      ],
    };
    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /same scope, conditions/,
    );
  });
});
