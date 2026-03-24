import type { APIRoute } from 'astro';
import { join } from 'path';
import { parseStatement } from '@cherrypicker/parser';
import { MerchantMatcher, buildConstraints, greedyOptimize } from '@cherrypicker/core';
import { loadCategories, loadAllCardRules } from '@cherrypicker/rules';
import type { BankId } from '@cherrypicker/parser';
import type { CategorizedTransaction } from '@cherrypicker/core';
import type { RawTransaction } from '@cherrypicker/parser';

const RULES_DIR = join(process.cwd(), '../../packages/rules/data');
const CARDS_DIR = join(RULES_DIR, 'cards');
const CATEGORIES_FILE = join(RULES_DIR, 'categories.yaml');

// Cache card rules and categories so we don't reload on every request
let cardRulesCache: Awaited<ReturnType<typeof loadAllCardRules>> | null = null;
let categoryNodesCache: Awaited<ReturnType<typeof loadCategories>> | null = null;

async function getCardRules() {
  if (!cardRulesCache) {
    cardRulesCache = await loadAllCardRules(CARDS_DIR);
  }
  return cardRulesCache;
}

async function getCategoryNodes() {
  if (!categoryNodesCache) {
    categoryNodesCache = await loadCategories(CATEGORIES_FILE);
  }
  return categoryNodesCache;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      filePath?: string;
      bank?: string;
      previousMonthSpending?: number;
      cardIds?: string[];
    };

    const { filePath, bank, previousMonthSpending = 500000, cardIds } = body;

    if (!filePath) {
      return new Response(JSON.stringify({ error: '파일 경로가 필요합니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Parse the statement file
    const parseResult = await parseStatement(filePath, {
      bank: bank as BankId | undefined,
    });

    if (parseResult.transactions.length === 0) {
      return new Response(
        JSON.stringify({
          error: '거래 내역을 찾을 수 없습니다',
          parseErrors: parseResult.errors,
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // 2. Load categories and build merchant matcher
    const categoryNodes = await getCategoryNodes();
    const matcher = new MerchantMatcher(categoryNodes);

    // 3. Categorize each raw transaction
    const categorized: CategorizedTransaction[] = parseResult.transactions.map(
      (tx: RawTransaction, idx: number) => {
        const match = matcher.match(tx.merchant, tx.category);
        return {
          id: `tx-${idx}`,
          date: tx.date,
          merchant: tx.merchant,
          amount: tx.amount,
          currency: 'KRW',
          installments: tx.installments,
          isOnline: tx.isOnline,
          rawCategory: tx.category,
          memo: tx.memo,
          category: match.category,
          subcategory: match.subcategory,
          confidence: match.confidence,
        };
      },
    );

    // 4. Load card rules (optionally filtered)
    let cardRules = await getCardRules();
    if (cardIds && cardIds.length > 0) {
      cardRules = cardRules.filter((r) => cardIds.includes(r.card.id));
    }

    if (cardRules.length === 0) {
      return new Response(
        JSON.stringify({ error: '사용 가능한 카드 규칙이 없습니다' }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // 5. Build optimization constraints — same previous-month spending for all cards
    const cardPreviousSpending = new Map<string, number>(
      cardRules.map((r) => [r.card.id, previousMonthSpending]),
    );
    const constraints = buildConstraints(categorized, cardPreviousSpending);

    // 6. Run greedy optimizer
    const optimizationResult = greedyOptimize(constraints, cardRules);

    return new Response(
      JSON.stringify({
        success: true,
        bank: parseResult.bank,
        format: parseResult.format,
        statementPeriod: parseResult.statementPeriod,
        transactionCount: categorized.length,
        parseErrors: parseResult.errors,
        optimization: optimizationResult,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
