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

interface CardEntry {
  card: CardMeta;
  performanceTiers: unknown[];
  performanceExclusions: string[];
  rewards: unknown[];
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

export const GET: APIRoute = async ({ url }) => {
  try {
    const issuerFilter = url.searchParams.get('issuer');
    const typeFilter = url.searchParams.get('type');

    const data = await getCardsData();

    // Flatten all cards from all issuers
    let allCards = data.issuers.flatMap((issuer) =>
      issuer.cards.map((entry) => ({
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
        rewardCategories: (entry.rewards as Array<{ category: string }>).map(
          (r) => r.category,
        ),
      })),
    );

    // Apply optional filters
    if (issuerFilter) {
      allCards = allCards.filter((c) => c.issuer === issuerFilter);
    }
    if (typeFilter) {
      allCards = allCards.filter((c) => c.type === typeFilter);
    }

    return new Response(
      JSON.stringify({
        total: allCards.length,
        cards: allCards,
        meta: {
          version: data.meta.version,
          generatedAt: data.meta.generatedAt,
          totalIssuers: data.issuers.length,
          categories: data.meta.categories,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load cards';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
