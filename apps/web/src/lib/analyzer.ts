import { MerchantMatcher, buildConstraints, greedyOptimize } from '@cherrypicker/core';
import type { CategorizedTransaction, CardRuleSet as CoreCardRuleSet } from '@cherrypicker/core';
import type { CategoryNode as RulesCategoryNode } from '@cherrypicker/rules';
import { parseFile } from './parser/index.js';
import type { RawTransaction } from './parser/types.js';
import type { BankId } from './parser/types.js';
import { getAllCardRules, loadCategories } from './cards.js';
import type { AnalysisResult, AnalyzeOptions } from './store.svelte.js';

export interface CategorizedTx {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  subcategory: string | undefined;
  confidence: number;
  rawCategory?: string;
  memo?: string;
}

export async function parseAndCategorize(
  file: File,
  options?: AnalyzeOptions,
): Promise<{ transactions: CategorizedTx[]; bank: string | null; format: string; statementPeriod?: { start: string; end: string }; parseErrors: { line?: number; message: string; raw?: string }[] }> {
  const parseResult = await parseFile(file, options?.bank as BankId | undefined);
  if (parseResult.transactions.length === 0) {
    throw new Error('거래 내역을 찾을 수 없어요');
  }

  const categoryNodes = await loadCategories();
  // MerchantMatcher expects CategoryNode[] from @cherrypicker/rules which has
  // { id, labelKo, labelEn, keywords, subcategories? }. The static JSON uses
  // the same shape; the local type has an extra `label` field but is otherwise
  // structurally compatible, so we cast through the rules type.
  const matcher = new MerchantMatcher(categoryNodes as unknown as RulesCategoryNode[]);

  const transactions: CategorizedTx[] = parseResult.transactions.map(
    (tx: RawTransaction, idx: number) => {
      const match = matcher.match(tx.merchant, tx.category);
      return {
        id: `tx-${idx}`,
        date: tx.date,
        merchant: tx.merchant,
        amount: tx.amount,
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
  };
}

export async function optimizeFromTransactions(
  transactions: CategorizedTx[],
  options?: AnalyzeOptions,
): Promise<AnalysisResult['optimization']> {
  // Convert CategorizedTx to CategorizedTransaction for the optimizer
  const categorized: CategorizedTransaction[] = transactions.map(tx => ({
    id: tx.id,
    date: tx.date,
    merchant: tx.merchant,
    amount: tx.amount,
    currency: 'KRW',
    installments: 0,
    isOnline: false,
    rawCategory: tx.rawCategory,
    memo: tx.memo,
    category: tx.category,
    subcategory: tx.subcategory,
    confidence: tx.confidence,
  }));

  let cardRules = await getAllCardRules();
  if (options?.cardIds && options.cardIds.length > 0) {
    cardRules = cardRules.filter(r => options.cardIds!.includes(r.card.id));
  }

  const previousMonthSpending = options?.previousMonthSpending ?? 500000;
  const cardPreviousSpending = new Map<string, number>(
    cardRules.map(r => [r.card.id, previousMonthSpending]),
  );
  const constraints = buildConstraints(categorized, cardPreviousSpending);

  // cardRules from static JSON match the CardRuleSet shape;
  // the local type differs only in minor string-literal widening on `source`.
  const optimizationResult = greedyOptimize(constraints, cardRules as unknown as CoreCardRuleSet[]);

  return optimizationResult;
}

// Keep the original combined function for backward compatibility
export async function analyzeFile(
  file: File,
  options?: AnalyzeOptions,
): Promise<AnalysisResult> {
  const parsed = await parseAndCategorize(file, options);
  const optimization = await optimizeFromTransactions(parsed.transactions, options);

  return {
    success: true,
    bank: parsed.bank,
    format: parsed.format,
    statementPeriod: parsed.statementPeriod,
    transactionCount: parsed.transactions.length,
    parseErrors: parsed.parseErrors,
    transactions: parsed.transactions,
    optimization,
  };
}
