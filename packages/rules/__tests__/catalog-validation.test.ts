import { beforeAll, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MerchantMatcher } from '../../core/src/categorizer/matcher.js';
import {
  CatalogValidationError,
  CategoryRegistry,
  buildCategoryKey,
  collectCardFreshnessIssues,
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

const CHOICE_QUARANTINE_INVENTORY = [
  'bnk-2030-platinum-gold:reward-003',
  'bnk-myzone-check:reward-001',
  'bnk-rex2-kal:reward-003',
  'bnk-rex2-point:reward-005',
  'jb-1st-triple:reward-001',
  'jb-1st-triple:reward-002',
  'jb-1st-triple:reward-003',
  'kb-golden-life-ollim:reward-001',
  'kb-our-wesh:reward-001',
  'kb-our-wesh:reward-002',
  'kb-you-prime:reward-001',
  'kb-you-prime:reward-002',
  'kb-you-prime:reward-003',
  'kb-you-prime:reward-004',
  'kb-youth-club-check:reward-001',
  'kb-youth-club-check:reward-003',
  'kb-youth-club-check:reward-004',
  'nh-take5:reward-001',
  'nh-take5:reward-002',
  'nh-take5:reward-003',
  'nh-take5:reward-004',
  'nh-take5:reward-005',
  'nh-zgm-play:reward-004',
  'samsung-id-select-all:reward-001',
  'samsung-id-select-all:reward-002',
  'samsung-taptap-o:reward-004',
  'samsung-taptap-o:reward-005',
  'shinhan-yolo:reward-001',
  'shinhan-yolo:reward-002',
  'shinhan-yolo:reward-003',
  'toss-moim-check:reward-001',
  'toss-moim-check:reward-002',
  'toss-moim-check:reward-003',
  'woori-card-of-rules-every-mile:reward-001',
  'woori-royal-blue-m:reward-002',
] as const;

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

  test('duplicate tier references fail with rule and duplicate-index identity', () => {
    const invalid: CardRuleSet = structuredClone(cards[0]!);
    invalid.rewards[0]!.tiers.push({
      ...invalid.rewards[0]!.tiers[0]!,
    });

    const duplicate = collectCardRuleIssues(invalid, registry).find(
      ({ code }) => code === 'duplicate_tier_reference',
    );
    expect(duplicate).toEqual({
      code: 'duplicate_tier_reference',
      cardId: invalid.card.id,
      path: 'rewards.0.tiers.1.performanceTier',
      message:
        `duplicate performance tier reference ` +
        `"${invalid.rewards[0]!.tiers[0]!.performanceTier}" in reward rule ` +
        `"${invalid.rewards[0]!.id}" (first referenced at tiers.0)`,
    });
    expect(() => validateCardRuleSet(invalid, registry)).toThrow(
      /duplicate performance tier reference/,
    );
  });

  test('uses one injected UTC-day clock across a catalog operation', () => {
    const first = structuredClone(cards[0]!);
    const second = structuredClone(cards[1]!);
    first.card.lastUpdated = '2024-02-29';
    second.card.lastUpdated = '2024-02-28';
    let reads = 0;

    expect(() =>
      validateCardCatalog([first, second], registry, {
        clock: () => {
          reads++;
          return new Date('2024-02-29T23:59:59.999Z');
        },
      }),
    ).not.toThrow();
    expect(reads).toBe(1);
  });

  test('shares stable freshness diagnostics for future dates and invalid clocks', () => {
    const future = structuredClone(cards[0]!);
    future.card.lastUpdated = '2026-07-24';
    expect(
      collectCardFreshnessIssues(
        future,
        () => new Date('2026-07-23T23:59:59.999Z'),
      ),
    ).toEqual([{
      code: 'future_last_updated',
      cardId: future.card.id,
      path: 'card.lastUpdated',
      message:
        'lastUpdated "2026-07-24" is after validation date "2026-07-23"',
    }]);

    expect(
      collectCardFreshnessIssues(future, () => new Date(Number.NaN)),
    ).toEqual([{
      code: 'invalid_validation_clock',
      cardId: future.card.id,
      path: 'card.lastUpdated',
      message: 'catalog validation clock must return a valid Date',
    }]);
  });

  test.each([
    ['past date', '2026-07-22', '2026-07-23', 0],
    ['current UTC date', '2026-07-23', '2026-07-23', 0],
    ['real leap day', '2024-02-29', '2024-02-29', 0],
    ['future date', '2026-07-24', '2026-07-23', 1],
  ])(
    'applies the UTC freshness table for %s',
    (_label, lastUpdated, today, issueCount) => {
      const card = structuredClone(cards[0]!);
      card.card.lastUpdated = lastUpdated;
      expect(
        collectCardFreshnessIssues(
          card,
          () => new Date(`${today}T23:59:59.999Z`),
        ),
      ).toHaveLength(issueCount);
    },
  );

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
      'reward-001',
      'reward-002',
      'reward-003',
      'reward-004',
      'reward-005',
      'reward-006',
    ]);

    expect(
      samsungMileage.rewards
        .filter((rule) => affectedRuleIds.has(rule.id))
        .map((rule) => [
          rule.id,
          rule.support.status,
          rule.support.status === 'unsupported'
            ? rule.support.reason
            : null,
        ]),
    ).toEqual([
      ['reward-001', 'unsupported', 'mileage reward valuation contract is not modeled'],
      ['reward-002', 'unsupported', 'mileage reward valuation contract is not modeled'],
      ['reward-003', 'unsupported', 'mileage reward valuation contract is not modeled'],
      ['reward-004', 'unsupported', 'mileage reward valuation contract is not modeled'],
      ['reward-005', 'unsupported', 'mileage reward valuation contract is not modeled'],
      ['reward-006', 'unsupported', 'mileage reward valuation contract is not modeled'],
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

  test.each([
    '선택 카테고리 5% 캐시백',
    '병원/약국 5% 할인 (선택 시)',
    'A팩 선택 시 OTT 할인',
    'Joy Pack 선택 시 외식 할인',
    '영화/커피/학원 중 선택',
    'SELECT 서비스1 선택A',
    '커피전문점 패키지 선택 시',
    '연간 기프트 중 택1',
    '월별 선택 혜택',
    '15만원 상당 바우처 선택',
    '대한항공 또는 아시아나 선택',
    'Choose one reward category',
    'Use the selected option',
    'Select one benefit pack',
  ])('recognizes user-choice restriction wording: %s', (label) => {
    const fixture = {
      ...cards[0]!.rewards[0]!,
      label,
      conditions: undefined,
    };
    expect(collectUnmodeledRuleRestrictions(fixture)).toContain('user_choice');
  });

  test.each([
    'SELECT 서비스: 음식점 (평일 5%, 금토일 10%)',
    '최다이용 1개 자동선택 30% 할인',
    '선택약정 통신요금 10% 할인',
    '고객을 위해 엄선한 카페 할인',
    '선택지가 많은 카드 디자인',
  ])('does not treat near-miss prose as user choice: %s', (label) => {
    const fixture = {
      ...cards[0]!.rewards[0]!,
      label,
      conditions: undefined,
    };
    expect(collectUnmodeledRuleRestrictions(fixture)).not.toContain(
      'user_choice',
    );
  });

  test('all current choice-bearing rewards are quarantined with a stable reason', () => {
    const byKey = new Map(
      cards.flatMap((card) =>
        card.rewards.map((rule) => [
          `${card.card.id}:${rule.id}`,
          rule,
        ] as const)
      ),
    );

    expect(new Set(CHOICE_QUARANTINE_INVENTORY).size).toBe(35);
    for (const key of CHOICE_QUARANTINE_INVENTORY) {
      const rule = byKey.get(key);
      expect(rule).toBeDefined();
      expect(collectUnmodeledRuleRestrictions(rule!)).toContain('user_choice');
      expect(rule!.support).toEqual({
        status: 'unsupported',
        reason: 'unmodeled eligibility: user_choice',
      });
    }

    const supportedChoiceRules = cards.flatMap((card) =>
      card.rewards
        .filter(
          (rule) =>
            rule.support.status === 'supported' &&
            collectUnmodeledRuleRestrictions(rule).includes('user_choice'),
        )
        .map((rule) => `${card.card.id}:${rule.id}`)
    );
    expect(supportedChoiceRules).toEqual([]);
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
