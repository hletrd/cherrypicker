import { beforeAll, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MerchantMatcher } from '../../core/src/categorizer/matcher.js';
import {
  CatalogValidationError,
  CategoryRegistry,
  buildCategoryKey,
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
