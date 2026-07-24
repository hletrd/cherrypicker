import { describe, expect, test } from 'bun:test';
import { readFile, readdir } from 'node:fs/promises';
import {
  bestRewardTiersByComparisonGroup,
  buildIdentityFreeWebCatalogArtifacts,
  buildWebCatalogArtifacts,
  computePublicationSourceHash,
  injectPublicationIdentity,
  isIndexableReward,
  parsePublicationCard,
  publicationRewardComparison,
  publicationRewardIndexValue,
  sortAndLimitRewardComparisons,
  staleGeneratedShardNames,
} from '../catalog-publication.js';

function cardWithUrl(url: string) {
  return {
    card: {
      id: 'fixture-safe-card',
      issuer: 'fixture',
      name: 'Fixture',
      nameKo: '픽스처',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      url,
      lastUpdated: '2026-07-23',
      source: 'manual',
    },
    performanceTiers: [
      { id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null },
    ],
    performanceExclusions: [],
    rewards: [
      {
        id: 'reward-001',
        category: '*',
        type: 'discount',
        priority: 1,
        combination: 'exclusive',
        stackingGroup: 'base',
        capGroup: 'reward-001',
        support: { status: 'supported' },
        tiers: [
          {
            performanceTier: 'tier0',
            rate: 1,
            monthlyCap: null,
            perTransactionCap: null,
          },
        ],
      },
    ],
    globalConstraints: {
      monthlyTotalDiscountCap: null,
      minimumAnnualSpending: null,
    },
  };
}

type PublicationRewardTier =
  ReturnType<typeof parsePublicationCard>['rewards'][number]['tiers'][number];

async function readJson<T>(url: URL): Promise<T> {
  return JSON.parse(await readFile(url, 'utf8')) as T;
}

function parsedRewardTier(
  valueKind: PublicationRewardTier['value']['kind'],
  amount: number,
  mileageUnit: 'mile_per_1500won' | 'miles' = 'mile_per_1500won',
): PublicationRewardTier {
  const raw = cardWithUrl('https://example.com/card');
  const tier = raw.rewards[0]!.tiers[0]!;
  if (valueKind === 'percentage') {
    Object.assign(tier, { rate: amount });
  } else if (valueKind === 'fixed_per_transaction') {
    Object.assign(tier, { rate: null, fixedAmount: amount });
  } else if (valueKind === 'fixed_per_day') {
    Object.assign(tier, {
      rate: null,
      fixedAmount: amount,
      unit: 'won_per_day',
    });
  } else if (valueKind === 'mileage_per_spend') {
    Object.assign(
      tier,
      mileageUnit === 'miles'
        ? { rate: amount, unit: 'miles' }
        : {
            rate: null,
            fixedAmount: amount,
            unit: 'mile_per_1500won',
          },
    );
  } else {
    Object.assign(tier, {
      rate: null,
      fixedAmount: amount,
      unit: 'won_per_liter',
    });
  }
  return parsePublicationCard(raw, `${valueKind}.yaml`)
    .rewards[0]!.tiers[0]!;
}

describe('catalog publication boundary', () => {
  test.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ])('rejects executable URL %s before generation', (url) => {
    expect(() => parsePublicationCard(cardWithUrl(url), 'fixture.yaml')).toThrow(
      /URL must be empty or an absolute HTTP\(S\) URL/,
    );
  });

  test.each(['', 'https://example.com/card'])(
    'accepts safe publication URL %s',
    (url) => {
      expect(parsePublicationCard(cardWithUrl(url), 'fixture.yaml').card.url).toBe(
        url,
      );
    },
  );

  test('rejects a safe-scheme model-authored source URL without reviewed provenance', () => {
    const scraped = cardWithUrl('https://attacker.example/phish');
    scraped.card.source = 'llm-scrape';

    expect(() => parsePublicationCard(scraped, 'scraped.yaml')).toThrow(
      /llm-scrape.*card source URL/i,
    );
    expect(
      parsePublicationCard(
        cardWithUrl('https://attacker.example/phish'),
        'reviewed.yaml',
      ).card.url,
    ).toBe('https://attacker.example/phish');
  });

  test('rejects a future lastUpdated value against an injected publication clock', () => {
    const raw = cardWithUrl('https://example.com/card');
    raw.card.lastUpdated = '2026-07-24';

    expect(() =>
      parsePublicationCard(
        raw,
        'future.yaml',
        () => new Date('2026-07-23T23:59:59.999Z'),
      ),
    ).toThrow(
      /lastUpdated "2026-07-24" is after validation date "2026-07-23"/,
    );
  });

  test('accepts a leap-day lastUpdated value at the injected publication date', () => {
    const raw = cardWithUrl('https://example.com/card');
    raw.card.lastUpdated = '2024-02-29';

    expect(
      parsePublicationCard(
        raw,
        'leap-day.yaml',
        () => new Date('2024-02-29T00:00:00.000Z'),
      ).card.lastUpdated,
    ).toBe('2024-02-29');
  });

  test('uses the shared invalid-clock diagnostic', () => {
    expect(() =>
      parsePublicationCard(
        cardWithUrl('https://example.com/card'),
        'invalid-clock.yaml',
        () => new Date(Number.NaN),
      ),
    ).toThrow(/catalog validation clock must return a valid Date/);
  });

  test('rejects duplicate reward tier references before publication', () => {
    const raw = cardWithUrl('https://example.com/card');
    raw.rewards[0]!.tiers.push({ ...raw.rewards[0]!.tiers[0]! });
    expect(() => parsePublicationCard(raw, 'duplicate.yaml')).toThrow(
      /duplicate performance tier reference "tier0"/,
    );
  });

  test('keeps explicitly unsupported benefits out of ranking indexes', () => {
    const supported = parsePublicationCard(
      cardWithUrl('https://example.com/card'),
      'fixture.yaml',
    ).rewards[0]!;
    expect(isIndexableReward(supported)).toBe(true);
    expect(
      isIndexableReward({
        ...supported,
        support: {
          status: 'unsupported',
          reason: 'statement does not contain the required eligibility fact',
        },
      }),
    ).toBe(false);
  });

  test('indexes legacy rate-zero fixed rewards by their canonical value', () => {
    const raw = cardWithUrl('https://example.com/card');
    Object.assign(raw.rewards[0]!.tiers[0]!, {
      rate: 0,
      fixedAmount: 1_500,
    });
    const tier = parsePublicationCard(raw, 'fixed.yaml')
      .rewards[0]!.tiers[0]!;

    expect(tier.rate).toBeNull();
    expect(tier.value).toEqual({
      kind: 'fixed_per_transaction',
      amount: 1_500,
    });
    expect(publicationRewardIndexValue(tier)).toEqual({
      amount: 1_500,
      kind: 'fixedAmount',
    });
  });

  test('selects best tiers only inside exact canonical kind-and-unit groups', () => {
    const percentageOne = parsedRewardTier('percentage', 1);
    const percentageThree = parsedRewardTier('percentage', 3);
    const percentageThreeTie = parsedRewardTier('percentage', 3);
    const tiers = [
      parsedRewardTier('percentage', 0),
      percentageOne,
      parsedRewardTier('fixed_per_transaction', 1_500),
      parsedRewardTier('fixed_per_day', 10_000),
      parsedRewardTier('mileage_per_spend', 2),
      parsedRewardTier('mileage_per_spend', 1, 'miles'),
      parsedRewardTier('fuel_per_liter', 100),
      percentageThree,
      percentageThreeTie,
    ];

    const projections = bestRewardTiersByComparisonGroup(tiers);

    expect(
      projections.map(({ comparison }) => comparison.comparisonGroup),
    ).toEqual([
      'fixed_per_day:won_per_day',
      'fixed_per_transaction:none',
      'fuel_per_liter:won_per_liter',
      'mileage_per_spend:mile_per_1500won',
      'mileage_per_spend:miles',
      'percentage:none',
    ]);
    expect(projections.map(({ comparison }) => comparison.valueKind)).toEqual([
      'fixed_per_day',
      'fixed_per_transaction',
      'fuel_per_liter',
      'mileage_per_spend',
      'mileage_per_spend',
      'percentage',
    ]);
    expect(projections.at(-1)?.tier).toBe(percentageThree);
    expect(publicationRewardComparison(percentageThree)).toEqual({
      amount: 3,
      comparisonGroup: 'percentage:none',
      valueKind: 'percentage',
      legacyKind: 'rate',
      unit: null,
    });
  });

  test('orders and limits rewards independently inside each comparison group', () => {
    const values = [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `percentage-${index + 1}`,
        amount: index + 1,
        comparisonGroup: 'percentage:none',
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `fixed-${index + 1}`,
        amount: (index + 1) * 1_000,
        comparisonGroup: 'fixed_per_transaction:none',
      })),
      {
        id: 'mileage-1',
        amount: 2,
        comparisonGroup: 'mileage_per_spend:mile_per_1500won',
      },
    ];

    const ordered = sortAndLimitRewardComparisons(
      values,
      ({ amount, comparisonGroup }) => ({ amount, comparisonGroup }),
      5,
    );

    expect(ordered).toHaveLength(11);
    expect(
      ordered
        .filter(({ comparisonGroup }) =>
          comparisonGroup.startsWith('fixed_per_transaction')
        )
        .map(({ amount }) => amount),
    ).toEqual([6_000, 5_000, 4_000, 3_000, 2_000]);
    expect(
      ordered
        .filter(({ comparisonGroup }) =>
          comparisonGroup.startsWith('percentage')
        )
        .map(({ amount }) => amount),
    ).toEqual([6, 5, 4, 3, 2]);
    expect(ordered.some(({ id }) => id === 'mileage-1')).toBe(true);
    expect(
      sortAndLimitRewardComparisons(
        [
          { id: 'first', amount: 0, comparisonGroup: 'percentage:none' },
          { id: 'second', amount: 0, comparisonGroup: 'percentage:none' },
          { id: 'negative', amount: -1, comparisonGroup: 'percentage:none' },
        ],
        (value) => value,
      ).map(({ id }) => id),
    ).toEqual(['first', 'second', 'negative']);
    expect(() =>
      sortAndLimitRewardComparisons(values, (value) => value, -1)
    ).toThrow(/nonnegative safe integer/);
  });

  test('excludes unsupported rewards only from summary categories', () => {
    const supportedCard = parsePublicationCard(
      cardWithUrl('https://example.com/card'),
      'fixture.yaml',
    );
    const unsupportedReward = {
      ...supportedCard.rewards[0]!,
      id: 'reward-unsupported',
      category: 'travel',
      support: {
        status: 'unsupported' as const,
        reason: 'statement does not contain the required eligibility fact',
      },
    };
    const card = {
      ...supportedCard,
      rewards: [...supportedCard.rewards, unsupportedReward],
    };
    const artifacts = buildWebCatalogArtifacts(
      {
        version: '1.0.0',
        generatedAt: '2026-07-23T00:00:00.000Z',
        totalIssuers: 1,
        totalCards: 1,
        categories: ['travel', 'uncategorized'],
      },
      [
        {
          id: 'fixture',
          nameKo: '픽스처',
          nameEn: 'Fixture',
          website: 'https://example.com',
          cardCount: 1,
          cards: [card],
        },
      ],
      [{ id: 'uncategorized' }, { id: 'travel' }],
    );

    expect(artifacts.summary.cards[0]?.rewardCategories).toEqual(['*']);
    expect(artifacts.summary.cards[0]?.rewardCategories).not.toContain('travel');
    expect(artifacts.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(artifacts.summary.meta.sourceHash).toBe(artifacts.sourceHash);
    expect(artifacts.optimizer.sourceHash).toBe(artifacts.sourceHash);
    expect(artifacts.categories.sourceHash).toBe(artifacts.sourceHash);
    expect(artifacts.optimizer.cards[0]?.rewards).toHaveLength(2);
    expect(artifacts.detailShards.get('fixture')?.sourceHash).toBe(
      artifacts.sourceHash,
    );
    expect(artifacts.detailShards.get('fixture')?.cards[0]?.rewards).toHaveLength(
      2,
    );
  });

  test('retains fail-closed merchant-scope rules only in disclosure artifacts', () => {
    const parsed = parsePublicationCard(
      cardWithUrl('https://example.com/card'),
      'fixture.yaml',
    );
    const card = {
      ...parsed,
      rewards: parsed.rewards.map((reward) => ({
        ...reward,
        support: {
          status: 'unsupported' as const,
          reason: 'unverified_merchant_scope',
        },
      })),
    };
    const artifacts = buildWebCatalogArtifacts(
      {
        version: '1.0.0',
        generatedAt: '2026-07-23T00:00:00.000Z',
        totalIssuers: 1,
        totalCards: 1,
        categories: ['*'],
      },
      [{
        id: 'fixture',
        nameKo: '픽스처',
        nameEn: 'Fixture',
        website: 'https://example.com',
        cardCount: 1,
        cards: [card],
      }],
      [{ id: '*' }],
    );

    expect(artifacts.summary.cards[0]?.rewardCategories).toEqual([]);
    expect(artifacts.optimizer.cards[0]?.rewards[0]?.support).toEqual({
      status: 'unsupported',
      reason: 'unverified_merchant_scope',
    });
    expect(
      artifacts.detailShards.get('fixture')?.cards[0]?.rewards[0]?.support,
    ).toEqual({
      status: 'unsupported',
      reason: 'unverified_merchant_scope',
    });
  });

  test('keeps discontinued availability in summaries and details but not recommendations', () => {
    const active = parsePublicationCard(
      cardWithUrl('https://example.com/active'),
      'active.yaml',
    );
    const discontinued = parsePublicationCard(
      {
        ...cardWithUrl('https://example.com/discontinued'),
        card: {
          ...cardWithUrl('https://example.com/discontinued').card,
          id: 'fixture-z-discontinued-card',
          discontinued: true,
        },
      },
      'discontinued.yaml',
    );
    const artifacts = buildWebCatalogArtifacts(
      {
        version: '1.0.0',
        generatedAt: '2026-07-23T00:00:00.000Z',
        totalIssuers: 1,
        totalCards: 2,
        categories: ['*'],
      },
      [{
        id: 'fixture',
        nameKo: '픽스처',
        nameEn: 'Fixture',
        website: 'https://example.com',
        cardCount: 2,
        cards: [discontinued, active],
      }],
      [{ id: '*' }],
    );

    expect(artifacts.summary.cards).toEqual([
      expect.objectContaining({
        id: active.card.id,
        discontinued: false,
      }),
      expect.objectContaining({
        id: discontinued.card.id,
        discontinued: true,
      }),
    ]);
    expect(artifacts.optimizer.cards.map((card) => card.card.id)).toEqual([
      active.card.id,
    ]);
    expect(
      artifacts.detailShards.get('fixture')?.cards.map((card) => card.card.id),
    ).toEqual([active.card.id, discontinued.card.id]);
  });

  test('builds byte-stable sorted browser projections', () => {
    const first = parsePublicationCard(
      cardWithUrl('https://example.com/first'),
      'fixture-first.yaml',
    );
    const second = parsePublicationCard(
      {
        ...cardWithUrl('https://example.com/second'),
        card: {
          ...cardWithUrl('https://example.com/second').card,
          id: 'fixture-another-card',
        },
      },
      'fixture-second.yaml',
    );
    const meta = {
      version: '1.0.0',
      generatedAt: '2026-07-23T00:00:00.000Z',
      totalIssuers: 1,
      totalCards: 2,
      categories: ['uncategorized'],
    };
    const categoryPayload = [{ id: 'uncategorized', keywords: [] }];
    const issuer = {
      id: 'fixture',
      nameKo: '픽스처',
      nameEn: 'Fixture',
      website: 'https://example.com',
      cardCount: 2,
      cards: [first, second],
    };

    const forward = buildWebCatalogArtifacts(meta, [issuer], categoryPayload);
    const reverse = buildWebCatalogArtifacts(meta, [
      { ...issuer, cards: [...issuer.cards].reverse() },
    ], categoryPayload);

    expect(forward.sourceHash).toBe(reverse.sourceHash);
    expect(JSON.stringify(forward.summary)).toBe(JSON.stringify(reverse.summary));
    expect(JSON.stringify(forward.optimizer)).toBe(
      JSON.stringify(reverse.optimizer),
    );
    expect(
      JSON.stringify([...forward.detailShards]),
    ).toBe(JSON.stringify([...reverse.detailShards]));
  });

  test('changes identity when projection bytes change while source inputs stay stable', () => {
    const first = parsePublicationCard(
      cardWithUrl('https://example.com/first'),
      'fixture-first.yaml',
    );
    const second = parsePublicationCard(
      {
        ...cardWithUrl('https://example.com/second'),
        card: {
          ...cardWithUrl('https://example.com/second').card,
          id: 'fixture-another-card',
        },
      },
      'fixture-second.yaml',
    );
    const issuer = {
      id: 'fixture',
      nameKo: '픽스처',
      nameEn: 'Fixture',
      website: 'https://example.com',
      cardCount: 2,
      cards: [first, second],
    };
    const meta = {
      version: '1.0.0',
      generatedAt: '2026-07-23T00:00:00.000Z',
      totalIssuers: 1,
      totalCards: 2,
      categories: ['uncategorized'],
    };
    const categories = [{ id: 'uncategorized', keywords: [] }];
    const identityFree = buildIdentityFreeWebCatalogArtifacts(
      meta,
      [issuer],
      categories,
    );
    const reordered = buildIdentityFreeWebCatalogArtifacts(
      meta,
      [{ ...issuer, cards: [...issuer.cards].reverse() }],
      categories,
    );
    const projectionChanged = {
      ...identityFree,
      summary: {
        ...identityFree.summary,
        cards: identityFree.summary.cards.map((card, index) =>
          index === 0 ? { ...card, nameKo: '변경된 요약 투영' } : card
        ),
      },
    };
    const optimizerChanged = {
      ...identityFree,
      optimizer: {
        cards: identityFree.optimizer.cards.map((card, index) =>
          index === 0
            ? { ...card, card: { ...card.card, nameKo: '변경된 최적화 투영' } }
            : card
        ),
      },
    };
    const detailChanged = {
      ...identityFree,
      detailShards: new Map(
        [...identityFree.detailShards].map(([issuerId, shard]) => [
          issuerId,
          {
            ...shard,
            cards: shard.cards.map((card, index) =>
              index === 0
                ? { ...card, card: { ...card.card, nameKo: '변경된 상세 투영' } }
                : card
            ),
          },
        ]),
      ),
    };
    const categoriesChanged = {
      ...identityFree,
      categories: {
        categories: [
          ...identityFree.categories.categories,
          { id: 'projection-only-category' },
        ],
      },
    };

    const originalHash = computePublicationSourceHash(identityFree, {});
    const reorderedHash = computePublicationSourceHash(reordered, {});
    const changedHash = computePublicationSourceHash(projectionChanged, {});

    expect(originalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(reorderedHash).toBe(originalHash);
    for (const changedProjection of [
      projectionChanged,
      optimizerChanged,
      detailChanged,
      categoriesChanged,
    ]) {
      expect(computePublicationSourceHash(changedProjection, {})).not.toBe(
        originalHash,
      );
    }

    const original = injectPublicationIdentity(identityFree, originalHash);
    const changed = injectPublicationIdentity(projectionChanged, changedHash);
    const originalHashes = [
      original.summary.meta.sourceHash,
      original.optimizer.sourceHash,
      original.categories.sourceHash,
      ...[...original.detailShards.values()].map((shard) => shard.sourceHash),
    ];
    const changedHashes = [
      changed.summary.meta.sourceHash,
      changed.optimizer.sourceHash,
      changed.categories.sourceHash,
      ...[...changed.detailShards.values()].map((shard) => shard.sourceHash),
    ];

    expect(new Set(originalHashes)).toEqual(new Set([originalHash]));
    expect(new Set(changedHashes)).toEqual(new Set([changedHash]));
    expect(original.summary.meta.sourceHash).not.toBe(
      changed.optimizer.sourceHash,
    );
  });

  test('covers keyed legacy projections in the publication identity', () => {
    const card = parsePublicationCard(
      cardWithUrl('https://example.com/card'),
      'fixture-card.yaml',
    );
    const identityFree = buildIdentityFreeWebCatalogArtifacts(
      {
        version: '1.0.0',
        generatedAt: '2026-07-24T00:00:00.000Z',
        totalIssuers: 1,
        totalCards: 1,
        categories: ['uncategorized'],
      },
      [{
        id: 'fixture',
        nameKo: '픽스처',
        nameEn: 'Fixture',
        website: 'https://example.com',
        cardCount: 1,
        cards: [card],
      }],
      [{ id: 'uncategorized', keywords: [] }],
    );
    const supplemental = {
      legacyFull: {
        meta: { version: '2.0.0' },
        index: { byCategory: { uncategorized: ['fixture-safe-card'] } },
      },
      legacyCompact: {
        meta: { version: '2.0.0' },
        issuers: [{ id: 'fixture', topRewards: ['reward-001'] }],
      },
    };
    const reorderedKeys = {
      legacyCompact: supplemental.legacyCompact,
      legacyFull: supplemental.legacyFull,
    };
    const fullChanged = {
      ...supplemental,
      legacyFull: {
        ...supplemental.legacyFull,
        index: { byCategory: { uncategorized: ['changed-card'] } },
      },
    };
    const compactChanged = {
      ...supplemental,
      legacyCompact: {
        ...supplemental.legacyCompact,
        issuers: [{ id: 'fixture', topRewards: ['changed-reward'] }],
      },
    };

    const originalHash = computePublicationSourceHash(
      identityFree,
      supplemental,
    );

    expect(originalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      computePublicationSourceHash(identityFree, reorderedKeys),
    ).toBe(originalHash);
    expect(
      computePublicationSourceHash(identityFree, fullChanged),
    ).not.toBe(originalHash);
    expect(
      computePublicationSourceHash(identityFree, compactChanged),
    ).not.toBe(originalHash);
  });

  test('publishes one complete identity with an explicit legacy version', async () => {
    type LegacyArtifact = {
      meta: { version: string; sourceHash: string };
    };
    type SourceHashArtifact = { sourceHash: string };
    const detailsUrl = new URL(
      '../../apps/web/public/data/card-details/',
      import.meta.url,
    );
    const detailNames = (await readdir(detailsUrl))
      .filter((name) => name.endsWith('.json'))
      .sort();
    const [
      rulesFull,
      rulesCompact,
      publicFull,
      summary,
      optimizer,
      categories,
      details,
    ] = await Promise.all([
      readJson<LegacyArtifact>(
        new URL('../../packages/rules/data/cards.json', import.meta.url),
      ),
      readJson<LegacyArtifact>(
        new URL(
          '../../packages/rules/data/cards-compact.json',
          import.meta.url,
        ),
      ),
      readJson<LegacyArtifact>(
        new URL('../../apps/web/public/data/cards.json', import.meta.url),
      ),
      readJson<LegacyArtifact>(
        new URL(
          '../../apps/web/public/data/cards-summary.json',
          import.meta.url,
        ),
      ),
      readJson<SourceHashArtifact>(
        new URL(
          '../../apps/web/public/data/cards-optimizer.json',
          import.meta.url,
        ),
      ),
      readJson<SourceHashArtifact>(
        new URL(
          '../../apps/web/public/data/categories.json',
          import.meta.url,
        ),
      ),
      Promise.all(
        detailNames.map((name) =>
          readJson<SourceHashArtifact>(new URL(name, detailsUrl))
        ),
      ),
    ]);
    const hashes = [
      rulesFull.meta.sourceHash,
      rulesCompact.meta.sourceHash,
      publicFull.meta.sourceHash,
      summary.meta.sourceHash,
      optimizer.sourceHash,
      categories.sourceHash,
      ...details.map((detail) => detail.sourceHash),
    ];

    expect(detailNames).toHaveLength(24);
    expect([
      rulesFull.meta.version,
      rulesCompact.meta.version,
      publicFull.meta.version,
    ]).toEqual(['2.0.0', '2.0.0', '2.0.0']);
    expect(summary.meta.version).toBe('1.0.0');
    expect(new Set(hashes)).toEqual(new Set([summary.meta.sourceHash]));
  });

  test('finds only stale generated JSON shards in stable order', () => {
    expect(
      staleGeneratedShardNames(
        ['z.json', 'keep.json', 'notes.txt', 'a.json'],
        new Set(['keep.json']),
      ),
    ).toEqual(['a.json', 'z.json']);
  });
});
