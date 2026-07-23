// Load one generation of split catalog artifacts served by GitHub Pages.
import type {
  CardRuleSet,
  CategoryNode,
} from '@cherrypicker/rules/browser';
import {
  readCardDetailShard,
  readCategoriesArtifact,
  readOptimizerCatalog,
  type CardDetailShardArtifact,
  type CategoriesArtifact,
} from './card-catalog-reader.js';
import { readCatalogSourceHash } from './catalog-publication-identity.js';

const REQUEST_TIMEOUT_MS = 10_000;
const SAFE_ISSUER_ID = /^[a-z0-9][a-z0-9-]*$/;

export type RewardTier = CardRuleSet['rewards'][number]['tiers'][number];
export type RewardEntry = CardRuleSet['rewards'][number];

export interface CardSummary {
  id: string;
  issuer: string;
  issuerNameKo: string;
  issuerNameEn: string;
  name: string;
  nameKo: string;
  type: CardRuleSet['card']['type'];
  annualFee: { domestic: number; international: number };
  rewardCategories: string[];
  url?: string;
  lastUpdated?: string;
  source?: CardRuleSet['card']['source'];
}

export interface CardDetail extends CardSummary {
  lastUpdated: string;
  source: CardRuleSet['card']['source'];
  performanceTiers: CardRuleSet['performanceTiers'];
  performanceExclusions: CardRuleSet['performanceExclusions'];
  rewards: CardRuleSet['rewards'];
  globalConstraints: CardRuleSet['globalConstraints'];
}

export interface CatalogMeta {
  version: string;
  generatedAt: string;
  totalIssuers: number;
  totalCards: number;
  categories?: string[];
  sourceHash: string;
}

export interface IssuerSummary {
  id: string;
  nameKo: string;
  nameEn: string;
  website: string;
  cardCount: number;
}

export interface CardSummaryArtifactEntry {
  id: string;
  issuer: string;
  name: string;
  nameKo: string;
  type: CardRuleSet['card']['type'];
  annualFee: { domestic: number; international: number };
  rewardCategories: string[];
}

export interface CardsSummaryArtifact {
  meta: CatalogMeta;
  issuers: IssuerSummary[];
  cards: CardSummaryArtifactEntry[];
}

export type { CategoryNode } from '@cherrypicker/rules/browser';

interface LoadedSummary {
  artifact: CardsSummaryArtifact;
  cards: CardSummary[];
  byId: Map<string, CardSummary>;
}

interface LoadedDetailShard {
  artifact: CardDetailShardArtifact;
  byId: Map<string, CardRuleSet>;
}

// Each artifact owns its request lifecycle. A caller's AbortSignal races only
// that caller's wait and never aborts a request shared with another consumer.
let summaryPromise: Promise<LoadedSummary> | null = null;
let summaryAbortController: AbortController | null = null;
let optimizerPromise: Promise<CardRuleSet[]> | null = null;
let optimizerAbortController: AbortController | null = null;
const detailPromises = new Map<string, Promise<LoadedDetailShard>>();
const detailAbortControllers = new Map<string, AbortController>();
let categoriesPromise: Promise<CategoriesArtifact> | null = null;
let categoriesAbortController: AbortController | null = null;
// The first fully validated artifact pins this page session. Every later
// artifact is checked before it can enter a cache or reach a consumer.
let activeSourceHash: string | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isAnnualFee(
  value: unknown,
): value is { domestic: number; international: number } {
  if (!isRecord(value)) return false;
  return (
    Number.isSafeInteger(value.domestic) &&
    (value.domestic as number) >= 0 &&
    Number.isSafeInteger(value.international) &&
    (value.international as number) >= 0
  );
}

function isCardType(value: unknown): value is CardRuleSet['card']['type'] {
  return value === 'credit' || value === 'check' || value === 'prepaid';
}

function acceptSourceHash(sourceHash: string): void {
  if (activeSourceHash === null) {
    activeSourceHash = sourceHash;
    return;
  }
  if (activeSourceHash !== sourceHash) {
    throw new Error(
      '카드 데이터 게시 버전이 일치하지 않아요. 페이지를 새로고침해 주세요.',
    );
  }
}

/** Validate the compact summary without expanding it into full card rules. */
export function readCardsSummaryArtifact(value: unknown): CardsSummaryArtifact {
  if (
    !isRecord(value) ||
    !isRecord(value.meta) ||
    !Array.isArray(value.issuers) ||
    !Array.isArray(value.cards)
  ) {
    throw new Error('카드 목록 데이터 형식이 올바르지 않아요');
  }

  const { meta } = value;
  readCatalogSourceHash(meta, '카드 목록 데이터');
  if (
    !isNonEmptyString(meta.version) ||
    !isNonEmptyString(meta.generatedAt) ||
    !Number.isSafeInteger(meta.totalIssuers) ||
    !Number.isSafeInteger(meta.totalCards) ||
    meta.totalIssuers !== value.issuers.length ||
    meta.totalCards !== value.cards.length ||
    value.cards.length === 0
  ) {
    throw new Error('카드 목록 데이터의 메타 정보가 맞지 않아요');
  }

  const issuers = new Map<string, IssuerSummary>();
  for (const rawIssuer of value.issuers) {
    if (
      !isRecord(rawIssuer) ||
      !isNonEmptyString(rawIssuer.id) ||
      !SAFE_ISSUER_ID.test(rawIssuer.id) ||
      !isNonEmptyString(rawIssuer.nameKo) ||
      !isNonEmptyString(rawIssuer.nameEn) ||
      !isNonEmptyString(rawIssuer.website) ||
      !Number.isSafeInteger(rawIssuer.cardCount) ||
      (rawIssuer.cardCount as number) < 1 ||
      issuers.has(rawIssuer.id)
    ) {
      throw new Error('카드 목록 데이터의 카드사 정보가 올바르지 않아요');
    }
    issuers.set(rawIssuer.id, rawIssuer as unknown as IssuerSummary);
  }

  const issuerCardCounts = new Map<string, number>();
  const cardIds = new Set<string>();
  for (const rawCard of value.cards) {
    if (
      !isRecord(rawCard) ||
      !isNonEmptyString(rawCard.id) ||
      cardIds.has(rawCard.id) ||
      !isNonEmptyString(rawCard.issuer) ||
      !issuers.has(rawCard.issuer) ||
      !isNonEmptyString(rawCard.name) ||
      !isNonEmptyString(rawCard.nameKo) ||
      !isCardType(rawCard.type) ||
      !isAnnualFee(rawCard.annualFee) ||
      !Array.isArray(rawCard.rewardCategories) ||
      !rawCard.rewardCategories.every(isNonEmptyString)
    ) {
      throw new Error('카드 목록 데이터의 카드 정보가 올바르지 않아요');
    }
    cardIds.add(rawCard.id);
    issuerCardCounts.set(
      rawCard.issuer,
      (issuerCardCounts.get(rawCard.issuer) ?? 0) + 1,
    );
  }

  for (const issuer of issuers.values()) {
    if (issuer.cardCount !== issuerCardCounts.get(issuer.id)) {
      throw new Error(`카드 목록 데이터의 ${issuer.id} 카드 수가 맞지 않아요`);
    }
  }

  return value as unknown as CardsSummaryArtifact;
}

function materializeSummary(artifact: CardsSummaryArtifact): LoadedSummary {
  const issuers = new Map(artifact.issuers.map((issuer) => [issuer.id, issuer]));
  const cards = artifact.cards.map((card): CardSummary => {
    const issuer = issuers.get(card.issuer)!;
    return {
      ...card,
      issuerNameKo: issuer.nameKo,
      issuerNameEn: issuer.nameEn,
    };
  });
  return {
    artifact,
    cards,
    byId: new Map(cards.map((card) => [card.id, card])),
  };
}

function getBaseUrl(): string {
  return import.meta.env.BASE_URL ?? '/';
}

function callerAbortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof DOMException && signal.reason.name === 'AbortError') {
    return signal.reason;
  }
  const message = signal.reason instanceof Error
    ? signal.reason.message
    : '요청이 취소되었습니다';
  return new DOMException(message, 'AbortError');
}

/** Race a caller's wait against its signal without touching the shared request. */
function waitForCaller<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(callerAbortReason(signal));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(callerAbortReason(signal));
    };
    const cleanup = () => signal.removeEventListener('abort', onAbort);

    signal.addEventListener('abort', onAbort, { once: true });
    request.then(
      value => {
        cleanup();
        resolve(value);
      },
      error => {
        cleanup();
        reject(error);
      },
    );
  });
}

async function fetchJson(
  path: string,
  controller: AbortController,
  messages: {
    response: string;
    timeout: string;
    malformed: string;
  },
): Promise<unknown> {
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(messages.response);
    return await response.json();
  } catch (error) {
    if (timedOut) throw new Error(messages.timeout);
    if (error instanceof Error && error.message === messages.response) throw error;
    throw new Error(messages.malformed);
  } finally {
    clearTimeout(timeout);
  }
}

function startSummaryRequest(): Promise<LoadedSummary> {
  const controller = new AbortController();
  summaryAbortController = controller;
  const request = fetchJson('data/cards-summary.json', controller, {
    response: '카드 목록 데이터를 불러올 수 없어요. 다시 시도해 주세요.',
    timeout: '카드 목록 데이터 요청 시간이 초과됐어요. 다시 시도해 주세요.',
    malformed: '카드 목록 데이터를 읽지 못했어요. 잠시 후 다시 시도해 주세요.',
  })
    .then(readCardsSummaryArtifact)
    .then((artifact) => {
      acceptSourceHash(artifact.meta.sourceHash);
      return artifact;
    })
    .then(materializeSummary);

  summaryPromise = request;
  void request.then(
    () => {
      if (summaryAbortController === controller) summaryAbortController = null;
    },
    () => {
      if (summaryAbortController === controller) summaryAbortController = null;
      if (summaryPromise === request) summaryPromise = null;
    },
  );
  return request;
}

function startOptimizerRequest(): Promise<CardRuleSet[]> {
  const controller = new AbortController();
  optimizerAbortController = controller;
  const request = fetchJson('data/cards-optimizer.json', controller, {
    response: '카드 혜택 데이터를 불러올 수 없어요. 다시 시도해 주세요.',
    timeout: '카드 혜택 데이터 요청 시간이 초과됐어요. 다시 시도해 주세요.',
    malformed: '카드 혜택 데이터를 읽지 못했어요. 잠시 후 다시 시도해 주세요.',
  }).then((value) => {
    const artifact = readOptimizerCatalog(value);
    acceptSourceHash(artifact.sourceHash);
    return artifact.cards;
  });

  optimizerPromise = request;
  void request.then(
    () => {
      if (optimizerAbortController === controller) optimizerAbortController = null;
    },
    () => {
      if (optimizerAbortController === controller) optimizerAbortController = null;
      if (optimizerPromise === request) optimizerPromise = null;
    },
  );
  return request;
}

function startDetailRequest(issuerId: string): Promise<LoadedDetailShard> {
  const controller = new AbortController();
  detailAbortControllers.set(issuerId, controller);
  const request = fetchJson(
    `data/card-details/${encodeURIComponent(issuerId)}.json`,
    controller,
    {
      response: '카드 상세 데이터를 불러올 수 없어요. 다시 시도해 주세요.',
      timeout: '카드 상세 데이터 요청 시간이 초과됐어요. 다시 시도해 주세요.',
      malformed: '카드 상세 데이터를 읽지 못했어요. 잠시 후 다시 시도해 주세요.',
    },
  ).then((value) => {
    const artifact = readCardDetailShard(value, issuerId);
    acceptSourceHash(artifact.sourceHash);
    return {
      artifact,
      byId: new Map(artifact.cards.map((card) => [card.card.id, card])),
    };
  });

  detailPromises.set(issuerId, request);
  void request.then(
    () => {
      if (detailAbortControllers.get(issuerId) === controller) {
        detailAbortControllers.delete(issuerId);
      }
    },
    () => {
      if (detailAbortControllers.get(issuerId) === controller) {
        detailAbortControllers.delete(issuerId);
      }
      if (detailPromises.get(issuerId) === request) {
        detailPromises.delete(issuerId);
      }
    },
  );
  return request;
}

function startCategoriesRequest(): Promise<CategoriesArtifact> {
  const controller = new AbortController();
  categoriesAbortController = controller;
  const request = fetchJson('data/categories.json', controller, {
    response: '카테고리 데이터를 불러올 수 없어요. 다시 시도해 주세요.',
    timeout: '카테고리 데이터 요청 시간이 초과됐어요. 다시 시도해 주세요.',
    malformed: '카테고리 데이터를 읽지 못했어요. 잠시 후 다시 시도해 주세요.',
  }).then((value) => {
    const artifact = readCategoriesArtifact(value);
    acceptSourceHash(artifact.sourceHash);
    return artifact;
  });

  categoriesPromise = request;
  void request.then(
    () => {
      if (categoriesAbortController === controller) categoriesAbortController = null;
    },
    () => {
      if (categoriesAbortController === controller) categoriesAbortController = null;
      if (categoriesPromise === request) categoriesPromise = null;
    },
  );
  return request;
}

async function loadSummary(signal?: AbortSignal): Promise<LoadedSummary> {
  if (!summaryPromise) startSummaryRequest();
  return waitForCaller(summaryPromise!, signal);
}

export async function loadCardSummaries(
  signal?: AbortSignal,
): Promise<CardSummary[]> {
  return (await loadSummary(signal)).cards;
}

export async function loadOptimizerCatalog(
  signal?: AbortSignal,
): Promise<CardRuleSet[]> {
  if (!optimizerPromise) void startOptimizerRequest();
  return waitForCaller(optimizerPromise!, signal);
}

export async function loadCardDetailShard(
  issuerId: string,
  signal?: AbortSignal,
): Promise<CardDetailShardArtifact> {
  if (!SAFE_ISSUER_ID.test(issuerId)) {
    throw new Error('카드사 ID가 올바르지 않아요');
  }
  if (!detailPromises.has(issuerId)) startDetailRequest(issuerId);
  return (await waitForCaller(detailPromises.get(issuerId)!, signal)).artifact;
}

export async function loadCategories(signal?: AbortSignal): Promise<CategoryNode[]> {
  if (!categoriesPromise) startCategoriesRequest();
  return (await waitForCaller(categoriesPromise!, signal)).categories;
}

export async function getAllCardRules(): Promise<CardRuleSet[]> {
  return loadOptimizerCatalog();
}

export async function getCardList(
  filters?: { issuer?: string; type?: string },
  options?: { signal?: AbortSignal },
): Promise<CardSummary[]> {
  let cards = await loadCardSummaries(options?.signal);
  if (filters?.issuer) cards = cards.filter(card => card.issuer === filters.issuer);
  if (filters?.type) cards = cards.filter(card => card.type === filters.type);
  return cards;
}

export async function getCardSummaryById(
  cardId: string,
  options?: { signal?: AbortSignal },
): Promise<CardSummary | null> {
  return (await loadSummary(options?.signal)).byId.get(cardId) ?? null;
}

export async function getCardById(
  cardId: string,
  options?: { signal?: AbortSignal },
): Promise<CardDetail | null> {
  const summary = await getCardSummaryById(cardId, options);
  if (!summary) return null;

  if (!detailPromises.has(summary.issuer)) startDetailRequest(summary.issuer);
  const shard = await waitForCaller(
    detailPromises.get(summary.issuer)!,
    options?.signal,
  );
  const rule = shard.byId.get(cardId);
  if (!rule) return null;

  return {
    ...summary,
    url: rule.card.url,
    lastUpdated: rule.card.lastUpdated,
    source: rule.card.source,
    performanceTiers: rule.performanceTiers,
    performanceExclusions: rule.performanceExclusions,
    rewards: rule.rewards,
    globalConstraints: rule.globalConstraints,
  };
}

/** Test-only: production resets must not invalidate immutable artifact caches. */
export function resetCardArtifactCachesForTests(): void {
  summaryAbortController?.abort();
  optimizerAbortController?.abort();
  categoriesAbortController?.abort();
  for (const controller of detailAbortControllers.values()) controller.abort();

  summaryPromise = null;
  summaryAbortController = null;
  optimizerPromise = null;
  optimizerAbortController = null;
  detailPromises.clear();
  detailAbortControllers.clear();
  categoriesPromise = null;
  categoriesAbortController = null;
  activeSourceHash = null;
}
