import { createHash } from 'node:crypto';
import {
  cardRuleSetSchema,
  collectCardFreshnessIssues,
  isRecommendationEligibleCard,
} from '../packages/rules/src/index.js';
import type { CardRuleSet } from '../packages/rules/src/index.js';

export interface PublicationMeta {
  version: string;
  generatedAt: string;
  totalIssuers: number;
  totalCards: number;
  categories: string[];
  sourceHash: string;
}

export type PublicationMetaWithoutIdentity = Omit<PublicationMeta, 'sourceHash'>;

export interface PublicationIssuer {
  id: string;
  nameKo: string;
  nameEn: string;
  website: string;
  cardCount: number;
  cards: CardRuleSet[];
}

export interface WebCatalogArtifacts {
  sourceHash: string;
  summary: {
    meta: PublicationMeta;
    issuers: Array<Omit<PublicationIssuer, 'cards'>>;
    cards: Array<{
      id: string;
      issuer: string;
      name: string;
      nameKo: string;
      type: CardRuleSet['card']['type'];
      annualFee: CardRuleSet['card']['annualFee'];
      discontinued: boolean;
      rewardCategories: string[];
    }>;
  };
  optimizer: {
    sourceHash: string;
    cards: CardRuleSet[];
  };
  detailShards: Map<
    string,
    {
      sourceHash: string;
      issuer: Omit<PublicationIssuer, 'cards'>;
      cards: CardRuleSet[];
    }
  >;
  categories: {
    sourceHash: string;
    categories: unknown[];
  };
}

export interface IdentityFreeWebCatalogArtifacts {
  summary: {
    meta: PublicationMetaWithoutIdentity;
    issuers: Array<Omit<PublicationIssuer, 'cards'>>;
    cards: Array<{
      id: string;
      issuer: string;
      name: string;
      nameKo: string;
      type: CardRuleSet['card']['type'];
      annualFee: CardRuleSet['card']['annualFee'];
      discontinued: boolean;
      rewardCategories: string[];
    }>;
  };
  optimizer: {
    cards: CardRuleSet[];
  };
  detailShards: Map<
    string,
    {
      issuer: Omit<PublicationIssuer, 'cards'>;
      cards: CardRuleSet[];
    }
  >;
  categories: {
    categories: unknown[];
  };
}

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort(compareAscii)) {
    result[key] = canonicalize(source[key]);
  }
  return result;
}

/**
 * Derive identity from the complete normalized runtime payload set, before
 * any identity field is injected. Keying every projection (including each
 * detail shard) prevents a generator-only projection change from reusing an
 * older publication identity while source YAML stays unchanged.
 */
export function computePublicationSourceHash(
  artifacts: IdentityFreeWebCatalogArtifacts,
): string {
  const canonicalPayloadSet = canonicalize({
    categories: artifacts.categories,
    detailShards: [...artifacts.detailShards.entries()]
      .sort(([a], [b]) => compareAscii(a, b))
      .map(([issuerId, payload]) => ({ issuerId, payload })),
    optimizer: artifacts.optimizer,
    summary: artifacts.summary,
  });
  return createHash('sha256')
    .update(JSON.stringify(canonicalPayloadSet))
    .digest('hex');
}

export function staleGeneratedShardNames(
  existingNames: readonly string[],
  expectedNames: ReadonlySet<string>,
): string[] {
  return existingNames
    .filter((name) => name.endsWith('.json') && !expectedNames.has(name))
    .sort(compareAscii);
}

/**
 * The single structural boundary used by catalog publication. Keeping this
 * helper side-effect free lets tests prove that malicious metadata cannot
 * enter generated artifacts without running the filesystem-writing CLI.
 */
export function parsePublicationCard(
  raw: unknown,
  sourceName: string,
  clock: () => Date = () => new Date(),
): CardRuleSet {
  const result = cardRuleSetSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid card rule at ${sourceName}:\n${issues}`);
  }
  const freshnessIssues = collectCardFreshnessIssues(result.data, clock);
  if (freshnessIssues.length > 0) {
    throw new Error(
      `Invalid card rule at ${sourceName}:\n` +
        freshnessIssues
          .map((issue) => `  ${issue.path}: ${issue.message}`)
          .join('\n'),
    );
  }
  return result.data;
}

export function isIndexableReward(
  reward: CardRuleSet['rewards'][number],
): boolean {
  return reward.support.status === 'supported';
}

export type PublicationRewardValueKind = 'rate' | 'fixedAmount';

export function publicationRewardIndexValue(
  tier: CardRuleSet['rewards'][number]['tiers'][number],
): { amount: number; kind: PublicationRewardValueKind } {
  return {
    amount: tier.value.amount,
    kind: tier.value.kind === 'percentage' ? 'rate' : 'fixedAmount',
  };
}

/**
 * Project the canonically validated catalog into the three browser payloads.
 * All collections have explicit stable ordering and runtime JSON stays flat
 * and minified when the caller serializes it.
 */
export function buildIdentityFreeWebCatalogArtifacts(
  meta: PublicationMetaWithoutIdentity,
  issuers: readonly PublicationIssuer[],
  categories: readonly unknown[],
): IdentityFreeWebCatalogArtifacts {
  const sortedIssuers = [...issuers].sort((a, b) => compareAscii(a.id, b.id));
  const issuerMetadata = sortedIssuers.map(({ cards: _cards, ...issuer }) => issuer);
  const detailShards = new Map<
    string,
    {
      issuer: Omit<PublicationIssuer, 'cards'>;
      cards: CardRuleSet[];
    }
  >();
  const allCards: CardRuleSet[] = [];

  for (const issuer of sortedIssuers) {
    const cards = [...issuer.cards].sort((a, b) =>
      compareAscii(a.card.id, b.card.id)
    );
    const { cards: _cards, ...metadata } = issuer;
    detailShards.set(issuer.id, {
      issuer: metadata,
      cards,
    });
    allCards.push(...cards);
  }
  allCards.sort((a, b) => compareAscii(a.card.id, b.card.id));
  const optimizer = allCards.filter(isRecommendationEligibleCard);

  return {
    summary: {
      meta: {
        version: meta.version,
        generatedAt: meta.generatedAt,
        totalIssuers: meta.totalIssuers,
        totalCards: meta.totalCards,
        categories: [...meta.categories],
      },
      issuers: issuerMetadata,
      cards: allCards.map((rule) => ({
        id: rule.card.id,
        issuer: rule.card.issuer,
        name: rule.card.name,
        nameKo: rule.card.nameKo,
        type: rule.card.type,
        annualFee: rule.card.annualFee,
        discontinued: rule.card.discontinued ?? false,
        rewardCategories: [
          ...new Set(
            rule.rewards
              .filter(isIndexableReward)
              .map((reward) =>
                reward.subcategory
                  ? `${reward.category}.${reward.subcategory}`
                  : reward.category
              ),
          ),
        ].sort(compareAscii),
      })),
    },
    optimizer: {
      cards: optimizer,
    },
    detailShards,
    categories: {
      categories: [...categories],
    },
  };
}

export function injectPublicationIdentity(
  artifacts: IdentityFreeWebCatalogArtifacts,
  sourceHash: string,
): WebCatalogArtifacts {
  const detailShards = new Map<
    string,
    {
      sourceHash: string;
      issuer: Omit<PublicationIssuer, 'cards'>;
      cards: CardRuleSet[];
    }
  >();
  for (const [issuerId, shard] of artifacts.detailShards) {
    detailShards.set(issuerId, {
      sourceHash,
      issuer: shard.issuer,
      cards: shard.cards,
    });
  }

  return {
    sourceHash,
    summary: {
      ...artifacts.summary,
      meta: {
        ...artifacts.summary.meta,
        sourceHash,
      },
    },
    optimizer: {
      sourceHash,
      cards: artifacts.optimizer.cards,
    },
    detailShards,
    categories: {
      sourceHash,
      categories: artifacts.categories.categories,
    },
  };
}

/**
 * Side-effect-free two-phase publication builder:
 * 1. normalize every identity-free runtime projection;
 * 2. hash the keyed projection set and inject that identity everywhere.
 */
export function buildWebCatalogArtifacts(
  meta: PublicationMetaWithoutIdentity,
  issuers: readonly PublicationIssuer[],
  categories: readonly unknown[],
): WebCatalogArtifacts {
  const identityFree = buildIdentityFreeWebCatalogArtifacts(
    meta,
    issuers,
    categories,
  );
  return injectPublicationIdentity(
    identityFree,
    computePublicationSourceHash(identityFree),
  );
}
