import type { APIRoute } from 'astro';
import { join, resolve } from 'path';
import { access } from 'fs/promises';
import { parseStatement } from '@cherrypicker/parser';
import { MerchantMatcher, buildConstraints, greedyOptimize } from '@cherrypicker/core';
import { loadCategories, loadAllCardRules } from '@cherrypicker/rules';
import type { BankId } from '@cherrypicker/parser';
import type { CategorizedTransaction } from '@cherrypicker/core';
import type { RawTransaction } from '@cherrypicker/parser';

const UPLOAD_DIR = resolve(join(process.cwd(), 'uploads'));
const RULES_DIR = join(process.cwd(), '../../packages/rules/data');
const CARDS_DIR = join(RULES_DIR, 'cards');
const CATEGORIES_FILE = join(RULES_DIR, 'categories.yaml');

const VALID_BANK_IDS = new Set([
  'hyundai', 'kb', 'samsung', 'shinhan', 'lotte', 'hana', 'woori',
  'ibk', 'nh', 'bc', 'kakao', 'toss', 'kbank', 'bnk', 'dgb',
  'suhyup', 'jb', 'kwangju',
]);

// H3 - Promise-based cache to prevent race conditions
let cardRulesPromise: Promise<Awaited<ReturnType<typeof loadAllCardRules>>> | null = null;
let categoryNodesPromise: Promise<Awaited<ReturnType<typeof loadCategories>>> | null = null;

function getCardRules() {
  if (!cardRulesPromise) {
    cardRulesPromise = loadAllCardRules(CARDS_DIR).catch((err) => {
      cardRulesPromise = null;
      throw err;
    });
  }
  return cardRulesPromise;
}

function getCategoryNodes() {
  if (!categoryNodesPromise) {
    categoryNodesPromise = loadCategories(CATEGORIES_FILE).catch((err) => {
      categoryNodesPromise = null;
      throw err;
    });
  }
  return categoryNodesPromise;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: { fileName?: string; bank?: string; previousMonthSpending?: number; cardIds?: string[] };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: '잘못된 요청 형식입니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { fileName, bank, cardIds } = body;

    // H2 - Validate previousMonthSpending
    const rawSpending = body.previousMonthSpending;
    const previousMonthSpending = typeof rawSpending === 'number' && Number.isFinite(rawSpending) && rawSpending >= 0 ? rawSpending : 500000;

    // H1 - Validate cardIds
    if (cardIds !== undefined) {
      if (!Array.isArray(cardIds) || !cardIds.every((id: unknown) => typeof id === 'string')) {
        return new Response(JSON.stringify({ error: '유효하지 않은 카드 ID 목록입니다' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!fileName) {
      return new Response(JSON.stringify({ error: '파일 이름이 필요합니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // C1 - Path traversal prevention: reconstruct path from filename only
    const resolvedPath = resolve(join(UPLOAD_DIR, fileName));
    if (!resolvedPath.startsWith(UPLOAD_DIR + '/') && resolvedPath !== UPLOAD_DIR) {
      return new Response(JSON.stringify({ error: '잘못된 파일 경로입니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check the file exists before trying to parse it
    try {
      await access(resolvedPath);
    } catch {
      return new Response(JSON.stringify({ error: '파일을 찾을 수 없습니다' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // H7 - Validate bank parameter against whitelist
    if (bank !== undefined && !VALID_BANK_IDS.has(bank)) {
      return new Response(JSON.stringify({ error: '유효하지 않은 은행/카드사입니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Parse the statement file
    const parseResult = await parseStatement(resolvedPath, {
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
