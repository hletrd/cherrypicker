import {
  buildAnalysisContext,
  resolveCardPreviousSpending,
  type AnalysisContext,
  type CalculationIssue,
  type CategorizedTransaction,
  type OptimizationResult,
} from '@cherrypicker/core';
import type { RawTransaction } from '@cherrypicker/parser/types';
import type { CardRuleSet } from '@cherrypicker/rules';

interface CategoryMatcher {
  match(
    merchantName: string,
    rawCategory?: string,
  ): { category: string; subcategory?: string; confidence: number };
}

export interface PreparedCliAnalysis {
  context: AnalysisContext<CategorizedTransaction>;
  cardPreviousSpending: Map<string, number>;
  performanceIssues: CalculationIssue[];
}

export function categorizeRawTransactions(
  transactions: readonly RawTransaction[],
  matcher: CategoryMatcher,
): CategorizedTransaction[] {
  return transactions.map((tx, index) => {
    const match = matcher.match(tx.merchant, tx.category);
    return {
      id: `tx-${index}`,
      date: tx.date,
      merchant: tx.merchant,
      amount: tx.amount,
      currency: 'KRW',
      installments: tx.installments,
      rawCategory: tx.category,
      memo: tx.memo,
      category: match.category,
      subcategory: match.subcategory,
      confidence: match.confidence,
      paymentType: tx.paymentType,
      channel: tx.channel,
      fuelVolumeLiters: tx.fuelVolumeLiters,
      performanceExclusionTags: tx.performanceExclusionTags,
      factProvenance: tx.factProvenance,
    };
  });
}

export function prepareCliAnalysis(
  transactions: readonly CategorizedTransaction[],
  cardRules: readonly CardRuleSet[],
  explicitPreviousMonthSpending?: number,
): PreparedCliAnalysis {
  const context = buildAnalysisContext(
    transactions,
    explicitPreviousMonthSpending,
  );
  if (!context) {
    throw new Error(
      '유효한 거래 날짜가 없습니다. 명세서의 날짜 형식을 확인해 주세요.',
    );
  }

  const previous = resolveCardPreviousSpending(
    cardRules,
    context.previousTransactions,
    context.previousSpendingBasis,
  );
  return {
    context,
    cardPreviousSpending: previous.cardPreviousSpending,
    performanceIssues: previous.issues,
  };
}

export function calendarScopeWarnings(
  context: AnalysisContext<CategorizedTransaction>,
): string[] {
  const warnings = context.invalidDateTransactions.map(
    (transaction) =>
      `날짜를 확인할 수 없어 추천에서 제외했습니다: ` +
      `${transaction.date || '(빈 날짜)'} / ${transaction.merchant}`,
  );
  if (context.validTransactions.length > context.latestTransactions.length) {
    warnings.push(
      `월별 한도를 정확히 적용하기 위해 최신 명세서 월 ` +
      `${context.latestMonth}의 ${context.latestTransactions.length}건만 추천에 사용합니다.`,
    );
  }
  return warnings;
}

export function attachPerformanceIssues(
  result: OptimizationResult,
  issues: readonly CalculationIssue[],
): void {
  if (issues.length === 0) return;

  result.unsupportedRules = [
    ...(result.unsupportedRules ?? []),
    ...issues,
  ];
  const issuesByCard = new Map<string, CalculationIssue[]>();
  for (const issue of issues) {
    const cardIssues = issuesByCard.get(issue.cardId) ?? [];
    cardIssues.push(issue);
    issuesByCard.set(issue.cardId, cardIssues);
  }
  for (const cardResult of result.cardResults) {
    const cardIssues = issuesByCard.get(cardResult.cardId);
    if (!cardIssues) continue;
    cardResult.unsupportedRules = [
      ...(cardResult.unsupportedRules ?? []),
      ...cardIssues,
    ];
  }
}
