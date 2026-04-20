// Load card data from static JSON files served by GitHub Pages

/** Conditions that may apply to a reward rule. Matches the rules package
 *  RewardConditions shape with specific known fields plus an index signature
 *  for forward compatibility. */
interface WebRewardConditions {
  minTransaction?: number;
  excludeOnline?: boolean;
  specificMerchants?: string[];
  note?: string;
  [key: string]: unknown;
}

export interface CardRuleSet {
  card: {
    id: string;
    issuer: string;
    name: string;
    nameKo: string;
    type: 'credit' | 'check' | 'prepaid';
    annualFee: { domestic: number; international: number };
    url: string;
    lastUpdated: string;
    source: string;
  };
  performanceTiers: Array<{
    id: string;
    label: string;
    minSpending: number;
    maxSpending: number | null;
  }>;
  performanceExclusions: string[];
  rewards: Array<{
    category: string;
    subcategory?: string;
    label?: string;
    type: string;
    tiers: Array<{
      performanceTier: string;
      rate: number | null;
      fixedAmount?: number | null;
      unit?: string | null;
      monthlyCap: number | null;
      perTransactionCap: number | null;
    }>;
    conditions?: WebRewardConditions;
  }>;
  globalConstraints: {
    monthlyTotalDiscountCap: number | null;
    minimumAnnualSpending: number | null;
  };
}

export interface PerformanceTier {
  id: string;
  label: string;
  minSpending: number;
  maxSpending: number | null;
}

export interface RewardTier {
  performanceTier: string;
  rate: number | null;
  fixedAmount?: number | null;
  unit?: string | null;
  monthlyCap: number | null;
  perTransactionCap: number | null;
}

export interface RewardEntry {
  category: string;
  subcategory?: string;
  label?: string;
  type: string;
  tiers: RewardTier[];
  conditions?: {
    excludeOnline?: boolean;
    specificMerchants?: string[];
    minAmount?: number;
    note?: string;
    [key: string]: unknown;
  };
}

export interface CardSummary {
  id: string;
  issuer: string;
  issuerNameKo: string;
  issuerNameEn: string;
  name: string;
  nameKo: string;
  type: string;
  annualFee: { domestic: number; international: number };
  url?: string;
  lastUpdated: string;
  source: string;
  rewardCategories: string[];
}

export interface CardDetail extends CardSummary {
  performanceTiers: PerformanceTier[];
  performanceExclusions: string[];
  rewards: RewardEntry[];
  globalConstraints?: {
    monthlyTotalDiscountCap: number | null;
    minimumAnnualSpending: number | null;
  };
}

interface IssuerData {
  id: string;
  nameKo: string;
  nameEn: string;
  website: string;
  cardCount: number;
  cards: CardRuleSet[];
}

interface CardsJson {
  meta: { version: string; generatedAt: string; totalIssuers: number; totalCards: number; categories: string[] };
  issuers: IssuerData[];
  categories: unknown[];
  index: {
    byCategory: Record<string, Array<{
      cardId: string;
      issuer: string;
      type: string;
      rewardValue: number;
      rewardValueKind: 'rate' | 'fixedAmount';
      unit: string | null;
      monthlyCap: number | null;
      subcategory?: string;
    }>>;
    byType: { credit: string[]; check: string[]; prepaid: string[] };
    noMinSpend: string[];
  };
}

export interface CategoryNode {
  id: string;
  label: string;
  labelKo: string;
  keywords: string[];
  subcategories?: CategoryNode[];
}

// Cached data — the promise resolves to undefined when an AbortError occurs
// (component unmount or signal cancellation), so callers must guard with
// `if (!data)`. Downstream functions (getAllCardRules, getCardList, getCardById)
// already handle this case.
let cardsPromise: Promise<CardsJson | undefined> | null = null;
let cardsAbortController: AbortController | null = null;
let categoriesPromise: Promise<{ categories: CategoryNode[] } | undefined> | null = null;
let categoriesAbortController: AbortController | null = null;

// Card-by-ID index for O(1) lookups instead of O(n) linear scan (C62-09).
// Built once when loadCardsData() first resolves, cleared on error/reset.
let cardIndex: Map<string, { issuer: IssuerData; card: CardRuleSet }> | null = null;

function buildCardIndex(data: CardsJson): Map<string, { issuer: IssuerData; card: CardRuleSet }> {
  const index = new Map<string, { issuer: IssuerData; card: CardRuleSet }>();
  for (const issuer of data.issuers) {
    for (const card of issuer.cards) {
      index.set(card.card.id, { issuer, card });
    }
  }
  return index;
}

function getBaseUrl(): string {
  return import.meta.env.BASE_URL ?? '/';
}

/** Chain an external AbortSignal to an internal AbortController so that
 *  aborting the external signal also aborts the internal controller's fetch.
 *  Returns early if the external signal is already aborted. */
function chainAbortSignal(controller: AbortController, signal?: AbortSignal): void {
  if (!signal) return;
  if (signal.aborted) {
    controller.abort();
    return;
  }
  signal.addEventListener('abort', () => controller.abort(), { once: true });
}

/** Check if an error is an AbortError (expected cancellation from component
 *  unmount or explicit signal abort). Used to distinguish intentional
 *  cancellations from real network failures in fetch catch blocks. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export async function loadCardsData(signal?: AbortSignal): Promise<CardsJson | undefined> {
  // If an in-flight fetch was aborted, reset the cache so a retry can succeed
  if (cardsPromise && cardsAbortController?.signal.aborted) {
    cardsPromise = null;
    cardsAbortController = null;
  }

  if (!cardsPromise) {
    const controller = new AbortController();
    chainAbortSignal(controller, signal);
    cardsAbortController = controller;

    cardsPromise = fetch(`${getBaseUrl()}data/cards.json`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('카드 데이터를 불러올 수 없습니다');
        return res.json() as Promise<CardsJson>;
      })
      .then(data => {
        // Build card-by-ID index for O(1) lookups (C62-09)
        cardIndex = buildCardIndex(data);
        return data;
      })
      .catch(err => {
        cardsPromise = null;
        cardsAbortController = null;
        cardIndex = null; // Clear stale index on error
        // AbortError is expected (component unmount, signal cancellation).
        // Don't propagate it — callers who passed a signal already know
        // about the abort. Callers without signals should not receive an
        // unexpected AbortError rejection. The cache reset above ensures
        // the next call re-fetches successfully.
        if (isAbortError(err)) return undefined;
        throw err;
      });
  } else if (signal) {
    // A fetch is already in-flight — chain the new caller's signal so they
    // can still abort the active request if needed.
    chainAbortSignal(cardsAbortController!, signal);
  }
  const result = await cardsPromise;
  // If the awaited promise resolved to undefined (AbortError), another caller
  // may have already started a new fetch (the catch handler resets
  // cardsPromise to null, and a concurrent call would set a new one).
  // Retry with the new promise instead of returning undefined (C72-05).
  if (result === undefined && cardsPromise) {
    return cardsPromise;
  }
  return result;
}

export async function loadCategories(signal?: AbortSignal): Promise<CategoryNode[]> {
  // If an in-flight fetch was aborted, reset the cache so a retry can succeed
  if (categoriesPromise && categoriesAbortController?.signal.aborted) {
    categoriesPromise = null;
    categoriesAbortController = null;
  }

  if (!categoriesPromise) {
    const controller = new AbortController();
    chainAbortSignal(controller, signal);
    categoriesAbortController = controller;

    categoriesPromise = fetch(`${getBaseUrl()}data/categories.json`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('카테고리 데이터를 불러올 수 없습니다');
        return res.json() as Promise<{ categories: CategoryNode[] }>;
      })
      .catch(err => {
        categoriesPromise = null;
        categoriesAbortController = null;
        // AbortError is expected (component unmount, signal cancellation).
        // Don't propagate it — same rationale as loadCardsData above.
        if (isAbortError(err)) return undefined;
        throw err;
      });
  } else if (signal) {
    chainAbortSignal(categoriesAbortController!, signal);
  }
  let data = await categoriesPromise;
  // If the awaited promise resolved to undefined (AbortError), another caller
  // may have already started a new fetch (the catch handler resets
  // categoriesPromise to null, and a concurrent call would set a new one).
  // Retry with the new promise instead of returning [] (C72-05).
  if (!data && categoriesPromise) {
    data = await categoriesPromise;
  }
  // data may be undefined after an AbortError — return empty array so callers
  // that don't pass a signal never crash on an unexpected abort.
  if (!data) return [];
  return data.categories;
}

export async function getAllCardRules(): Promise<CardRuleSet[]> {
  const data = await loadCardsData();
  if (!data) return [];
  return data.issuers.flatMap(issuer => issuer.cards);
}

export async function getCardList(filters?: { issuer?: string; type?: string }, options?: { signal?: AbortSignal }): Promise<CardSummary[]> {
  const data = await loadCardsData(options?.signal);
  if (!data) return [];
  let cards: CardSummary[] = data.issuers.flatMap(issuer =>
    issuer.cards.map(c => ({
      id: c.card.id,
      issuer: c.card.issuer,
      issuerNameKo: issuer.nameKo,
      issuerNameEn: issuer.nameEn,
      name: c.card.name,
      nameKo: c.card.nameKo,
      type: c.card.type,
      annualFee: c.card.annualFee,
      url: c.card.url,
      lastUpdated: c.card.lastUpdated,
      source: c.card.source,
      rewardCategories: c.rewards.map(r => r.category),
    }))
  );
  if (filters?.issuer) cards = cards.filter(c => c.issuer === filters.issuer);
  if (filters?.type) cards = cards.filter(c => c.type === filters.type);
  return cards;
}

export async function getCardById(cardId: string, options?: { signal?: AbortSignal }): Promise<CardDetail | null> {
  const data = await loadCardsData(options?.signal);
  if (!data) return null;
  // Use the O(1) index when available, fall back to linear scan (C62-09)
  if (cardIndex) {
    const entry = cardIndex.get(cardId);
    if (!entry) return null;
    const { issuer, card } = entry;
    return {
      id: card.card.id,
      issuer: card.card.issuer,
      issuerNameKo: issuer.nameKo,
      issuerNameEn: issuer.nameEn,
      name: card.card.name,
      nameKo: card.card.nameKo,
      type: card.card.type,
      annualFee: card.card.annualFee,
      url: card.card.url,
      lastUpdated: card.card.lastUpdated,
      source: card.card.source,
      rewardCategories: card.rewards.map(r => r.category),
      performanceTiers: card.performanceTiers,
      performanceExclusions: card.performanceExclusions,
      rewards: card.rewards,
      globalConstraints: card.globalConstraints,
    };
  }
  // Fallback: linear scan (should not normally be reached)
  for (const issuer of data.issuers) {
    const card = issuer.cards.find(c => c.card.id === cardId);
    if (card) {
      return {
        id: card.card.id,
        issuer: card.card.issuer,
        issuerNameKo: issuer.nameKo,
        issuerNameEn: issuer.nameEn,
        name: card.card.name,
        nameKo: card.card.nameKo,
        type: card.card.type,
        annualFee: card.card.annualFee,
        url: card.card.url,
        lastUpdated: card.card.lastUpdated,
        source: card.card.source,
        rewardCategories: card.rewards.map(r => r.category),
        performanceTiers: card.performanceTiers,
        performanceExclusions: card.performanceExclusions,
        rewards: card.rewards,
        globalConstraints: card.globalConstraints,
      };
    }
  }
  return null;
}
