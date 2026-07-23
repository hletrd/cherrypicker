import { cardRuleSetSchema } from '../packages/rules/src/index.js';
import type { CardRuleSet } from '../packages/rules/src/index.js';

export interface PublicationMeta {
  version: string;
  generatedAt: string;
  totalIssuers: number;
  totalCards: number;
  categories: string[];
  sourceHash?: string;
}

export interface PublicationIssuer {
  id: string;
  nameKo: string;
  nameEn: string;
  website: string;
  cardCount: number;
  cards: CardRuleSet[];
}

export interface WebCatalogArtifacts {
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
      rewardCategories: string[];
    }>;
  };
  optimizer: CardRuleSet[];
  detailShards: Map<
    string,
    {
      issuer: Omit<PublicationIssuer, 'cards'>;
      cards: CardRuleSet[];
    }
  >;
}

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
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
): CardRuleSet {
  const result = cardRuleSetSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid card rule at ${sourceName}:\n${issues}`);
  }
  return result.data;
}

export function isIndexableReward(
  reward: CardRuleSet['rewards'][number],
): boolean {
  return reward.support.status === 'supported';
}

/**
 * Project the canonically validated catalog into the three browser payloads.
 * All collections have explicit stable ordering and runtime JSON stays flat
 * and minified when the caller serializes it.
 */
export function buildWebCatalogArtifacts(
  meta: PublicationMeta,
  issuers: readonly PublicationIssuer[],
): WebCatalogArtifacts {
  const sortedIssuers = [...issuers].sort((a, b) => compareAscii(a.id, b.id));
  const issuerMetadata = sortedIssuers.map(({ cards: _cards, ...issuer }) => issuer);
  const detailShards = new Map<
    string,
    {
      issuer: Omit<PublicationIssuer, 'cards'>;
      cards: CardRuleSet[];
    }
  >();
  const optimizer: CardRuleSet[] = [];

  for (const issuer of sortedIssuers) {
    const cards = [...issuer.cards].sort((a, b) =>
      compareAscii(a.card.id, b.card.id)
    );
    const { cards: _cards, ...metadata } = issuer;
    detailShards.set(issuer.id, { issuer: metadata, cards });
    optimizer.push(...cards);
  }
  optimizer.sort((a, b) => compareAscii(a.card.id, b.card.id));

  return {
    summary: {
      meta: { ...meta },
      issuers: issuerMetadata,
      cards: optimizer.map((rule) => ({
        id: rule.card.id,
        issuer: rule.card.issuer,
        name: rule.card.name,
        nameKo: rule.card.nameKo,
        type: rule.card.type,
        annualFee: rule.card.annualFee,
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
    optimizer,
    detailShards,
  };
}
