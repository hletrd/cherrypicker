import { describe, expect, test } from 'bun:test';
import {
  buildWebCatalogArtifacts,
  computePublicationSourceHash,
  isIndexableReward,
  parsePublicationCard,
  staleGeneratedShardNames,
} from '../catalog-publication.js';

const SOURCE_HASH = 'a'.repeat(64);

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
        sourceHash: SOURCE_HASH,
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
    );

    expect(artifacts.summary.cards[0]?.rewardCategories).toEqual(['*']);
    expect(artifacts.summary.cards[0]?.rewardCategories).not.toContain('travel');
    expect(artifacts.summary.meta.sourceHash).toBe(SOURCE_HASH);
    expect(artifacts.optimizer.sourceHash).toBe(SOURCE_HASH);
    expect(artifacts.optimizer.cards[0]?.rewards).toHaveLength(2);
    expect(artifacts.detailShards.get('fixture')?.sourceHash).toBe(SOURCE_HASH);
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
        sourceHash: SOURCE_HASH,
      },
      [{
        id: 'fixture',
        nameKo: '픽스처',
        nameEn: 'Fixture',
        website: 'https://example.com',
        cardCount: 1,
        cards: [card],
      }],
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
      sourceHash: SOURCE_HASH,
    };
    const issuer = {
      id: 'fixture',
      nameKo: '픽스처',
      nameEn: 'Fixture',
      website: 'https://example.com',
      cardCount: 2,
      cards: [first, second],
    };

    const forward = buildWebCatalogArtifacts(meta, [issuer]);
    const reverse = buildWebCatalogArtifacts(meta, [
      { ...issuer, cards: [...issuer.cards].reverse() },
    ]);

    expect(JSON.stringify(forward.summary)).toBe(JSON.stringify(reverse.summary));
    expect(JSON.stringify(forward.optimizer)).toBe(
      JSON.stringify(reverse.optimizer),
    );
    expect(
      JSON.stringify([...forward.detailShards]),
    ).toBe(JSON.stringify([...reverse.detailShards]));
  });

  test('computes a deterministic identity from normalized publication content', () => {
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
    const input = {
      version: '1.0.0',
      categories: [{ id: 'uncategorized', keywords: [] }],
      issuers: [issuer],
    };

    const forward = computePublicationSourceHash(input);
    const reordered = computePublicationSourceHash({
      ...input,
      issuers: [{ ...issuer, cards: [...issuer.cards].reverse() }],
    });
    const changed = computePublicationSourceHash({
      ...input,
      issuers: [{
        ...issuer,
        cards: [
          { ...first, card: { ...first.card, nameKo: '변경된 카드' } },
          second,
        ],
      }],
    });

    expect(forward).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered).toBe(forward);
    expect(changed).not.toBe(forward);
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
