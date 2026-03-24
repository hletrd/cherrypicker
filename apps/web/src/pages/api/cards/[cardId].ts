import type { APIRoute } from 'astro';
import { readFile } from 'fs/promises';
import { join } from 'path';

const CARDS_JSON = join(process.cwd(), '../../packages/rules/data/cards.json');

interface CardMeta {
  id: string;
  issuer: string;
  name: string;
  nameKo: string;
  type: string;
  annualFee: { domestic: number; international: number };
  url?: string;
  lastUpdated: string;
  source: string;
}

interface PerformanceTier {
  id: string;
  label: string;
  minSpending: number;
  maxSpending: number | null;
}

interface RewardTierEntry {
  performanceTier: string;
  rate: number;
  monthlyCap: number | null;
  perTransactionCap: number | null;
}

interface RewardEntry {
  category: string;
  type: string;
  tiers: RewardTierEntry[];
  conditions?: {
    excludeOnline?: boolean;
    specificMerchants?: string[];
    minAmount?: number;
  };
}

interface CardEntry {
  card: CardMeta;
  performanceTiers: PerformanceTier[];
  performanceExclusions: string[];
  rewards: RewardEntry[];
  globalConstraints: unknown;
}

interface IssuerEntry {
  id: string;
  nameKo: string;
  nameEn: string;
  website: string;
  cardCount: number;
  cards: CardEntry[];
}

interface CardsJson {
  meta: {
    version: string;
    generatedAt: string;
    totalIssuers: number;
    totalCards: number;
    categories: string[];
  };
  issuers: IssuerEntry[];
}

// H3 - Promise-based cache to prevent race conditions
let cardsDataPromise: Promise<CardsJson> | null = null;

function getCardsData(): Promise<CardsJson> {
  if (!cardsDataPromise) {
    cardsDataPromise = readFile(CARDS_JSON, 'utf-8').then(raw => JSON.parse(raw) as CardsJson).catch(err => {
      cardsDataPromise = null;
      throw err;
    });
  }
  return cardsDataPromise;
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const { cardId } = params;
    if (!cardId) {
      return new Response(JSON.stringify({ error: '카드 ID가 필요합니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await getCardsData();

    // Find card across all issuers
    for (const issuer of data.issuers) {
      for (const entry of issuer.cards) {
        if (entry.card.id === cardId) {
          return new Response(
            JSON.stringify({
              id: entry.card.id,
              issuer: entry.card.issuer,
              issuerNameKo: issuer.nameKo,
              issuerNameEn: issuer.nameEn,
              name: entry.card.name,
              nameKo: entry.card.nameKo,
              type: entry.card.type,
              annualFee: entry.card.annualFee,
              url: entry.card.url,
              lastUpdated: entry.card.lastUpdated,
              source: entry.card.source,
              rewardCategories: entry.rewards.map((r) => r.category),
              performanceTiers: entry.performanceTiers,
              performanceExclusions: entry.performanceExclusions,
              rewards: entry.rewards,
              globalConstraints: entry.globalConstraints,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
      }
    }

    return new Response(JSON.stringify({ error: '카드를 찾을 수 없습니다' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api/cards/detail]', error);
    return new Response(JSON.stringify({ error: '카드 정보를 불러오는 중 오류가 발생했습니다' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
