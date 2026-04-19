import { MerchantMatcher, buildConstraints, greedyOptimize } from '@cherrypicker/core';
import type { CategorizedTransaction, CardRuleSet as CoreCardRuleSet } from '@cherrypicker/core';
import type { CategoryNode as RulesCategoryNode } from '@cherrypicker/rules';
import { parseFile } from './parser/index.js';
import type { RawTransaction } from './parser/types.js';
import type { BankId } from './parser/types.js';
import { getAllCardRules, loadCategories } from './cards.js';
import type { CardRuleSet, CategoryNode } from './cards.js';
import type { AnalysisResult, AnalyzeOptions } from './store.svelte.js';

// ---------------------------------------------------------------------------
// Type adapters — safely bridge local types to core/rules types without
// bypassing TypeScript's structural checking via `as unknown as`.
// ---------------------------------------------------------------------------

/** Project the web CategoryNode (which has `label` but no `labelEn`) to the
 *  rules package's CategoryNode shape (which has `labelKo` + `labelEn`).
 *  We provide `labelEn` as an empty string since it is not used by the
 *  MerchantMatcher — only `id`, `labelKo`, and `keywords` matter for
 *  matching. */
function toRulesCategoryNodes(nodes: CategoryNode[]): RulesCategoryNode[] {
  return nodes.map((node) => ({
    id: node.id,
    labelKo: node.labelKo,
    labelEn: '', // not present in web CategoryNode; unused by matcher
    keywords: node.keywords,
    ...(node.subcategories
      ? { subcategories: toRulesCategoryNodes(node.subcategories) }
      : {}),
  }));
}

/** Validate and narrow the web CardRuleSet to the core package's CardRuleSet.
 *  Fields that differ between web and core types:
 *  - `card.source`: web has `string`, core expects `'manual' | 'llm-scrape' | 'web'`
 *  - `rewards[].type`: web has `string`, core expects `RewardType`
 *  The static JSON is validated by the Zod schema at build time, so the narrowing
 *  is safe — but we assert explicitly so the type system stays honest. */
const VALID_SOURCES = new Set(['manual', 'llm-scrape', 'web']);
const VALID_REWARD_TYPES = new Set(['discount', 'points', 'cashback', 'mileage']);

// Cache for toCoreCardRuleSets — rules from static JSON don't change per session.
// The cache is keyed by existence only (not reference equality) because
// getAllCardRules() returns a new array via flatMap on every call, making
// reference comparisons always fail. Since the underlying cards.json data
// never changes within a session, caching the first transformation is safe.
let cachedCoreRules: CoreCardRuleSet[] | null = null;

function toCoreCardRuleSets(rules: CardRuleSet[]): CoreCardRuleSet[] {
  return rules.map((rule) => ({
    ...rule,
    card: {
      ...rule.card,
      source: VALID_SOURCES.has(rule.card.source)
        ? (rule.card.source as 'manual' | 'llm-scrape' | 'web')
        : 'web', // fallback for unknown source values
    },
    rewards: rule.rewards.map((r) => ({
      ...r,
      type: VALID_REWARD_TYPES.has(r.type)
        ? (r.type as 'discount' | 'points' | 'cashback' | 'mileage')
        : 'discount', // fallback for unknown reward types
      tiers: r.tiers.map((t) => ({
        ...t,
        // Ensure unit is narrowed from string | undefined to the expected union
        unit: t.unit ?? null,
      })),
    })),
  }));
}

export interface CategorizedTx {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  installments?: number;
  isOnline?: boolean;
  category: string;
  subcategory: string | undefined;
  confidence: number;
  rawCategory?: string;
  memo?: string;
}

export async function parseAndCategorize(
  file: File,
  options?: AnalyzeOptions,
): Promise<{ transactions: CategorizedTx[]; bank: string | null; format: string; statementPeriod?: { start: string; end: string }; parseErrors: { line?: number; message: string; raw?: string }[]; categoryNodes: CategoryNode[] }> {
  const parseResult = await parseFile(file, options?.bank as BankId | undefined);
  if (parseResult.transactions.length === 0) {
    throw new Error('거래 내역을 찾을 수 없어요');
  }

  const categoryNodes = await loadCategories();
  // MerchantMatcher expects CategoryNode[] from @cherrypicker/rules which has
  // { id, labelKo, labelEn, keywords, subcategories? }. We project our local
  // type (which has an extra `label` field) to the rules shape via the adapter.
  const matcher = new MerchantMatcher(toRulesCategoryNodes(categoryNodes));

  const transactions: CategorizedTx[] = parseResult.transactions.map(
    (tx: RawTransaction, idx: number) => {
      const match = matcher.match(tx.merchant, tx.category);
      return {
        id: `tx-${idx}`,
        date: tx.date,
        merchant: tx.merchant,
        amount: tx.amount,
        installments: tx.installments,
        isOnline: tx.isOnline,
        category: match.category,
        subcategory: match.subcategory,
        confidence: match.confidence,
        rawCategory: tx.category,
        memo: tx.memo,
      };
    },
  );

  return {
    transactions,
    bank: parseResult.bank ?? null,
    format: parseResult.format ?? 'csv',
    statementPeriod: parseResult.statementPeriod,
    parseErrors: parseResult.errors ?? [],
    categoryNodes,
  };
}

export async function optimizeFromTransactions(
  transactions: CategorizedTx[],
  options?: AnalyzeOptions,
  prebuiltCategoryLabels?: Map<string, string>,
): Promise<AnalysisResult['optimization']> {
  // Convert CategorizedTx to CategorizedTransaction for the optimizer
  const categorized: CategorizedTransaction[] = transactions.map(tx => ({
    id: tx.id,
    date: tx.date,
    merchant: tx.merchant,
    amount: tx.amount,
    currency: 'KRW',
    installments: tx.installments,
    isOnline: tx.isOnline,
    rawCategory: tx.rawCategory,
    memo: tx.memo,
    category: tx.category,
    subcategory: tx.subcategory,
    confidence: tx.confidence,
  }));

  // cardRules from static JSON are validated and narrowed to the core
  // CardRuleSet shape via the adapter function. Cache the FULL unfiltered
  // result since the underlying cards.json data never changes within a session.
  // The cardIds filter is applied after cache retrieval so filtered calls
  // don't get stale unfiltered data from the cache.
  const allCardRules = await getAllCardRules();
  if (!cachedCoreRules) {
    cachedCoreRules = toCoreCardRuleSets(allCardRules);
  }
  let coreRules = cachedCoreRules;

  // Apply cardIds filter AFTER cache retrieval to avoid returning stale
  // unfiltered rules when a filtered set is requested.
  if (options?.cardIds && options.cardIds.length > 0) {
    const idSet = new Set(options.cardIds);
    coreRules = coreRules.filter(r => idSet.has(r.card.id));
  }

  // 전월실적 기본값: 사용자가 입력하지 않으면 이번 달 총 지출과 같다고 가정
  // 단, 카드사별 performanceExclusions에 포함된 카테고리의 지출은 전월실적에서 제외
  // 각 카드마다 제외 항목이 다르므로 카드별로 개별 계산
  const cardPreviousSpending = new Map<string, number>();
  for (const rule of coreRules) {
    if (options?.previousMonthSpending !== undefined) {
      // 사용자가 명시적으로 입력한 값 — 모든 카드에 동일 적용
      cardPreviousSpending.set(rule.card.id, options.previousMonthSpending);
    } else {
      // 카드별 performanceExclusions에 따라 전월실적 개별 계산
      const exclusions = new Set(rule.performanceExclusions);
      const qualifying = transactions
        .filter(tx => !exclusions.has(tx.category))
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      cardPreviousSpending.set(rule.card.id, qualifying);
    }
  }
  // Build category labels map from taxonomy for the optimizer
  // Skip loadCategories() if labels were pre-built by the caller
  let categoryLabels = prebuiltCategoryLabels;
  if (!categoryLabels) {
    const categoryNodes = await loadCategories();
    categoryLabels = new Map<string, string>();
    for (const node of categoryNodes) {
      categoryLabels.set(node.id, node.labelKo);
      if (node.subcategories) {
        for (const sub of node.subcategories) {
          categoryLabels.set(sub.id, sub.labelKo);
        }
      }
    }
  }

  const constraints = buildConstraints(categorized, cardPreviousSpending, categoryLabels);

  const optimizationResult = greedyOptimize(constraints, coreRules);

  return optimizationResult;
}

/** Determine the latest month (YYYY-MM) from a list of categorized transactions. */
export function getLatestMonth(transactions: CategorizedTx[]): string | null {
  if (transactions.length === 0) return null;
  const months = new Set<string>();
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7) {
      months.add(tx.date.slice(0, 7));
    }
  }
  const sorted = [...months].sort();
  return sorted[sorted.length - 1] ?? null;
}

export async function analyzeMultipleFiles(
  files: File[],
  options?: AnalyzeOptions,
): Promise<AnalysisResult> {
  // 1. Parse and categorize ALL files
  const allParsed = await Promise.all(
    files.map(f => parseAndCategorize(f, options))
  );

  // 2. Merge all transactions and build category labels from the first parsed result
  const allTransactions: CategorizedTx[] = [];
  const allErrors: { line?: number; message: string; raw?: string }[] = [];
  let bank: string | null = null;
  let format = 'csv';

  // Build category labels once from the taxonomy data returned by parseAndCategorize
  const categoryLabels = new Map<string, string>();
  for (const parsed of allParsed) {
    allTransactions.push(...parsed.transactions);
    allErrors.push(...parsed.parseErrors);
    if (parsed.bank) bank = parsed.bank;
    format = parsed.format;
    // Build labels from the first parsed result (all results use the same taxonomy)
    if (categoryLabels.size === 0 && parsed.categoryNodes) {
      for (const node of parsed.categoryNodes) {
        categoryLabels.set(node.id, node.labelKo);
        if (node.subcategories) {
          for (const sub of node.subcategories) {
            categoryLabels.set(sub.id, sub.labelKo);
          }
        }
      }
    }
  }

  if (allTransactions.length === 0) {
    throw new Error('거래 내역을 찾을 수 없어요');
  }

  // 3. Sort transactions by date
  allTransactions.sort((a, b) => a.date.localeCompare(b.date));

  // 4. Detect months and calculate per-month spending + transaction counts
  const monthlySpending = new Map<string, number>();
  const monthlyTxCount = new Map<string, number>();
  for (const tx of allTransactions) {
    const month = tx.date.slice(0, 7); // "2026-01"
    monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + Math.abs(tx.amount));
    monthlyTxCount.set(month, (monthlyTxCount.get(month) ?? 0) + 1);
  }

  // 5. Find the latest month's transactions for optimization
  const months = [...monthlySpending.keys()].sort();
  const latestMonth = months[months.length - 1]!;
  const previousMonth = months.length >= 2 ? months[months.length - 2]! : null;

  // Use previous month's spending as performance tier input
  // If only one month uploaded, leave undefined so optimizeFromTransactions
  // computes per-card exclusion-filtered spending automatically
  const previousMonthSpending = previousMonth
    ? monthlySpending.get(previousMonth)!
    : options?.previousMonthSpending;

  // 6. Filter to latest month for optimization
  const latestTransactions = allTransactions.filter(tx => tx.date.startsWith(latestMonth));

  // 7. Optimize using the latest month's transactions with previous month's spending
  const optimization = await optimizeFromTransactions(latestTransactions, {
    ...options,
    previousMonthSpending,
  }, categoryLabels);

  // 8. Calculate statement periods from transactions
  // - fullStatementPeriod / totalTransactionCount: all uploaded months
  // - statementPeriod / transactionCount: optimized month only
  const allDates = allTransactions.map(tx => tx.date).filter(Boolean).sort();
  const fullStatementPeriod = allDates.length > 0
    ? { start: allDates[0]!, end: allDates[allDates.length - 1]! }
    : undefined;

  const optimizedDates = latestTransactions.map(tx => tx.date).filter(Boolean).sort();
  const statementPeriod = optimizedDates.length > 0
    ? { start: optimizedDates[0]!, end: optimizedDates[optimizedDates.length - 1]! }
    : undefined;

  // Note: `transactions` includes ALL months for display/editing, but the
  // optimization only covers the latest month. When reoptimize is called
  // with edited transactions, it includes all months. This is acceptable
  // because non-latest-month transactions still contribute to per-card
  // previousMonthSpending calculations and don't distort the optimization
  // — they just add more data for the optimizer to consider.
  return {
    success: true,
    bank,
    format,
    statementPeriod,
    transactionCount: latestTransactions.length,
    fullStatementPeriod,
    totalTransactionCount: allTransactions.length,
    parseErrors: allErrors,
    transactions: allTransactions,
    optimization,
    monthlyBreakdown: [...monthlySpending.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, spending]) => ({
        month,
        spending,
        transactionCount: monthlyTxCount.get(month) ?? 0,
      })),
  };
}

// Keep the original combined function for backward compatibility
export async function analyzeFile(
  file: File,
  options?: AnalyzeOptions,
): Promise<AnalysisResult> {
  return analyzeMultipleFiles([file], options);
}
