import { describe, expect, test } from 'bun:test';
import {
  buildIdentityFreeWebCatalogArtifacts,
  buildWebCatalogArtifacts,
  computePublicationSourceHash,
  injectPublicationIdentity,
  isIndexableReward,
  parsePublicationCard,
  publicationRewardIndexValue,
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

  test('rejects a safe-scheme model-authored URL without reviewed provenance', () => {
    const scraped = cardWithUrl('https://attacker.example/phish');
    scraped.card.source = 'llm-scrape';

    expect(() => parsePublicationCard(scraped, 'scraped.yaml')).toThrow(
      /llm-scrape.*official card URL/i,
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

    const originalHash = computePublicationSourceHash(identityFree);
    const reorderedHash = computePublicationSourceHash(reordered);
    const changedHash = computePublicationSourceHash(projectionChanged);

    expect(originalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(reorderedHash).toBe(originalHash);
    for (const changedProjection of [
      projectionChanged,
      optimizerChanged,
      detailChanged,
      categoriesChanged,
    ]) {
      expect(computePublicationSourceHash(changedProjection)).not.toBe(
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

  test('finds only stale generated JSON shards in stable order', () => {
    expect(
      staleGeneratedShardNames(
        ['z.json', 'keep.json', 'notes.txt', 'a.json'],
        new Set(['keep.json']),
      ),
    ).toEqual(['a.json', 'z.json']);
  });
});
