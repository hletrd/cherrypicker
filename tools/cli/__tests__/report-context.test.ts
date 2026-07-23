import { describe, expect, test } from 'bun:test';
import type {
  AnalysisContext,
  CalculationIssue,
  CategorizedTransaction,
  OptimizationResult,
} from '@cherrypicker/core';
import { ParseError, type ParseResult } from '@cherrypicker/parser/types';
import { buildStandaloneReportContext } from '../src/report-context.js';

function transaction(
  id: string,
  date: string,
): CategorizedTransaction {
  return {
    id,
    date,
    merchant: `merchant-${id}`,
    amount: 1_000,
    currency: 'KRW',
    category: 'shopping',
    confidence: 1,
  };
}

describe('buildStandaloneReportContext', () => {
  test('carries scope and exclusions while deduplicating calculation issues', () => {
    const prior = transaction('prior', '2026-01-03');
    const latest = transaction('latest', '2026-02-04');
    const invalid = transaction('invalid', 'not-a-date');
    const analysisContext: AnalysisContext<CategorizedTransaction> = {
      validTransactions: [prior, latest],
      invalidDateTransactions: [invalid],
      latestMonth: '2026-02',
      latestTransactions: [latest],
      previousTransactions: [prior],
      previousSpendingBasis: {
        kind: 'statement-month',
        month: '2026-01',
      },
      statementPeriod: { start: latest.date, end: latest.date },
      fullStatementPeriod: { start: prior.date, end: latest.date },
      monthlyBreakdown: [],
    };
    const parseError = new ParseError('bad amount', {
      code: 'BAD_AMOUNT',
      line: 9,
      file: 'statement.csv',
    });
    const parseResult: ParseResult = {
      bank: 'kb',
      format: 'csv',
      transactions: [],
      errors: [parseError],
    };
    const issue: CalculationIssue = {
      cardId: 'card-a',
      transactionId: 'tx-1',
      ruleId: 'reward-1',
      category: 'shopping',
      reason: 'missing_payment_type',
      detail: 'payment type is required',
    };
    const result: OptimizationResult = {
      assignments: [],
      totalReward: 0,
      totalSpending: 0,
      effectiveRate: 0,
      savingsVsSingleCard: 0,
      bestSingleCard: { cardId: 'card-a', cardName: 'Card A', totalReward: 0 },
      unsupportedRules: [issue, { ...issue }],
      cardResults: [
        {
          cardId: 'card-a',
          cardName: 'Card A',
          totalReward: 0,
          totalSpending: 0,
          effectiveRate: 0,
          byCategory: [],
          performanceTier: 'tier0',
          capsHit: [],
          unsupportedRules: [{ ...issue }],
        },
      ],
    };

    const context = buildStandaloneReportContext({
      analysisContext,
      parseResult,
      result,
    });

    expect(context).toMatchObject({
      latestStatementPeriod: { start: latest.date, end: latest.date },
      fullStatementPeriod: { start: prior.date, end: latest.date },
      latestTransactionCount: 1,
      fullTransactionCount: 2,
      previousSpendingBasis: {
        kind: 'statement-month',
        month: '2026-01',
      },
    });
    expect(context.parserExclusions).toEqual([
      {
        message: 'bad amount',
        code: 'BAD_AMOUNT',
        line: 9,
        file: 'statement.csv',
        format: 'csv',
      },
    ]);
    expect(context.calendarExclusions).toEqual([
      expect.objectContaining({ kind: 'invalid-date', count: 1 }),
      expect.objectContaining({ kind: 'outside-latest-month', count: 1 }),
    ]);
    expect(context.unsupportedIssues).toEqual([issue]);
  });
});
