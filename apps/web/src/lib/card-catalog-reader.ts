import { cardRuleSetSchema } from '@cherrypicker/rules/browser';
import type { CardRuleSet } from '@cherrypicker/rules/browser';
import {
  readCatalogSourceHash,
  type CatalogPublicationIdentity,
} from './catalog-publication-identity.js';

export interface DetailIssuer {
  id: string;
  nameKo: string;
  nameEn: string;
  website: string;
  cardCount: number;
}

export interface OptimizerCatalogArtifact
  extends CatalogPublicationIdentity {
  cards: CardRuleSet[];
}

export interface CardDetailShardArtifact
  extends CatalogPublicationIdentity {
  issuer: DetailIssuer;
  cards: CardRuleSet[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validationMessage(
  label: string,
  index: number,
  error: { issues: readonly { path: PropertyKey[]; message: string }[] },
): string {
  const issue = error.issues[0];
  const path = issue?.path.length ? `.${issue.path.join('.')}` : '';
  return `${label}[${index}]${path}: ${issue?.message ?? '형식이 올바르지 않아요'}`;
}

/** Canonically validate and normalize a generated rule array. */
function readCardRuleArray(value: unknown, label: string): CardRuleSet[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}가 비어 있거나 배열 형식이 아니에요`);
  }

  const ids = new Set<string>();
  const cards: CardRuleSet[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const result = cardRuleSetSchema.safeParse(value[index]);
    if (!result.success) {
      throw new Error(validationMessage(label, index, result.error));
    }
    if (ids.has(result.data.card.id)) {
      throw new Error(`${label}에 중복 카드 ID가 있어요: ${result.data.card.id}`);
    }
    ids.add(result.data.card.id);
    cards.push(result.data);
  }

  return cards;
}

export function readOptimizerCatalog(
  value: unknown,
): OptimizerCatalogArtifact {
  if (!isRecord(value)) {
    throw new Error('카드 혜택 데이터 형식이 올바르지 않아요');
  }
  return {
    sourceHash: readCatalogSourceHash(value, '카드 혜택 데이터'),
    cards: readCardRuleArray(value.cards, '카드 혜택 데이터'),
  };
}

export function readCardDetailShard(
  value: unknown,
  expectedIssuer: string,
): CardDetailShardArtifact {
  if (!isRecord(value) || !isRecord(value.issuer)) {
    throw new Error('카드 상세 데이터의 카드사 정보가 올바르지 않아요');
  }

  const sourceHash = readCatalogSourceHash(value, '카드 상세 데이터');
  const issuer = value.issuer;
  if (
    issuer.id !== expectedIssuer ||
    typeof issuer.nameKo !== 'string' ||
    typeof issuer.nameEn !== 'string' ||
    typeof issuer.website !== 'string' ||
    !Number.isSafeInteger(issuer.cardCount) ||
    (issuer.cardCount as number) < 1
  ) {
    throw new Error('카드 상세 데이터의 카드사 정보가 일치하지 않아요');
  }

  const cards = readCardRuleArray(value.cards, '카드 상세 데이터');
  if (cards.length !== issuer.cardCount) {
    throw new Error('카드 상세 데이터의 카드 수가 맞지 않아요');
  }
  if (cards.some((card) => card.card.issuer !== expectedIssuer)) {
    throw new Error('카드 상세 데이터에 다른 카드사의 카드가 섞여 있어요');
  }

  return {
    sourceHash,
    issuer: {
      id: issuer.id,
      nameKo: issuer.nameKo,
      nameEn: issuer.nameEn,
      website: issuer.website,
      cardCount: issuer.cardCount as number,
    },
    cards,
  };
}
