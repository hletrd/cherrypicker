import type {
  AnalysisContext,
  CalculationIssue,
  CategorizedTransaction,
  OptimizationResult,
} from '@cherrypicker/core';
import type { ParseResult } from '@cherrypicker/parser/types';
import type { StandaloneReportContext } from '@cherrypicker/viz';
import { calendarScopeExclusions } from './analysis.js';

interface BuildStandaloneReportContextOptions {
  analysisContext: AnalysisContext<CategorizedTransaction>;
  parseResult: ParseResult;
  result: OptimizationResult;
}

function deduplicateUnsupportedIssues(
  issues: readonly CalculationIssue[],
): CalculationIssue[] {
  const seen = new Set<string>();
  const deduplicated: CalculationIssue[] = [];
  for (const issue of issues) {
    const key = [
      issue.cardId,
      issue.transactionId,
      issue.ruleId,
      issue.category,
      issue.reason,
      issue.detail ?? '',
    ].join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(issue);
  }
  return deduplicated;
}

export function buildStandaloneReportContext({
  analysisContext,
  parseResult,
  result,
}: BuildStandaloneReportContextOptions): StandaloneReportContext {
  const unsupportedIssues = deduplicateUnsupportedIssues([
    ...(result.unsupportedRules ?? []),
    ...result.cardResults.flatMap(
      (cardResult) => cardResult.unsupportedRules ?? [],
    ),
  ]);

  return {
    ...(analysisContext.statementPeriod
      ? { latestStatementPeriod: analysisContext.statementPeriod }
      : {}),
    ...(analysisContext.fullStatementPeriod
      ? { fullStatementPeriod: analysisContext.fullStatementPeriod }
      : {}),
    latestTransactionCount: analysisContext.latestTransactions.length,
    fullTransactionCount: analysisContext.validTransactions.length,
    parserExclusions: parseResult.errors.map((error) => ({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.line !== undefined ? { line: error.line } : {}),
      ...(error.file ? { file: error.file } : {}),
      format: error.format ?? parseResult.format,
    })),
    calendarExclusions: calendarScopeExclusions(analysisContext),
    previousSpendingBasis: analysisContext.previousSpendingBasis,
    unsupportedIssues,
  };
}
