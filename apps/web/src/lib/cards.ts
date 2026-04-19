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

// Cached data
let cardsPromise: Promise<CardsJson> | null = null;
let categoriesPromise: Promise<{ categories: CategoryNode[] }> | null = null;

function getBaseUrl(): string {
  return import.meta.env.BASE_URL ?? '/';
}

export async function loadCardsData(): Promise<CardsJson> {
  if (!cardsPromise) {
    cardsPromise = fetch(`${getBaseUrl()}data/cards.json`)
      .then(res => {
        if (!res.ok) throw new Error('카드 데이터를 불러올 수 없습니다');
        return res.json() as Promise<CardsJson>;
      })
      .catch(err => {
        cardsPromise = null;
        throw err;
      });
  }
  return cardsPromise;
}

export async function loadCategories(): Promise<CategoryNode[]> {
  if (!categoriesPromise) {
    categoriesPromise = fetch(`${getBaseUrl()}data/categories.json`)
      .then(res => {
        if (!res.ok) throw new Error('카테고리 데이터를 불러올 수 없습니다');
        return res.json() as Promise<{ categories: CategoryNode[] }>;
      })
      .catch(err => {
        categoriesPromise = null;
        throw err;
      });
  }
  const data = await categoriesPromise;
  return data.categories;
}

export async function getAllCardRules(): Promise<CardRuleSet[]> {
  const data = await loadCardsData();
  return data.issuers.flatMap(issuer => issuer.cards);
}

export async function getCardList(filters?: { issuer?: string; type?: string }): Promise<CardSummary[]> {
  const data = await loadCardsData();
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

export async function getCardById(cardId: string): Promise<CardDetail | null> {
  const data = await loadCardsData();
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
