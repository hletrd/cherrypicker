import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  CLEAR_ANALYSIS_RESET_ERROR,
  resetAnalysisState,
  type AnalysisResetState,
} from '../src/lib/analysis-reset-runtime.js';
import {
  deserializeAnalysis,
  serializeAnalysis,
  STORAGE_KEY,
} from '../src/lib/persistence.js';
import type { AnalysisResult } from '../src/lib/analysis-result.js';

function analysisFixture(): AnalysisResult {
  return {
    success: true,
    bank: 'shinhan',
    format: 'csv',
    statementPeriod: { start: '2026-07-23', end: '2026-07-23' },
    transactionCount: 1,
    fullStatementPeriod: { start: '2026-07-23', end: '2026-07-23' },
    totalTransactionCount: 1,
    parseErrors: [],
    transactions: [
      {
        id: 'tx-1',
        date: '2026-07-23',
        merchant: '남겨야 하는 거래',
        amount: 10_000,
        category: 'dining',
        subcategory: undefined,
        confidence: 1,
      },
    ],
    categoryBreakdown: [
      {
        category: 'dining',
        categoryNameKo: '외식',
        spending: 10_000,
        transactionCount: 1,
      },
    ],
    optimization: {
      assignments: [],
      totalReward: 0,
      totalSpending: 10_000,
      unassignedSpending: 10_000,
      unassignedTransactionCount: 1,
      effectiveRate: 0,
      savingsVsSingleCard: 0,
      bestSingleCard: null,
      cardResults: [],
    },
    monthlyBreakdown: [
      { month: '2026-07', spending: 10_000, transactionCount: 1 },
    ],
    previousSpendingBasis: {
      kind: 'missing-calendar-month',
      month: '2026-06',
      assumedAmount: 0,
    },
  };
}

function stateFixture(result: AnalysisResult): AnalysisResetState {
  return {
    result,
    loading: false,
    error: null,
    persistWarningKind: 'truncated',
    truncatedTxCount: 4,
  };
}

describe('durable-clear-first analysis reset', () => {
  test('failed deletion preserves same-session and reloadable analysis', () => {
    const result = analysisFixture();
    const state = stateFixture(result);
    const storage = new Map([
      [STORAGE_KEY, serializeAnalysis(result).serialized],
    ]);
    let invalidations = 0;
    let cacheClears = 0;

    const reset = resetAnalysisState(state, {
      clearPersistedAnalysis: () => ({
        kind: 'error',
        truncatedTxCount: null,
      }),
      invalidateOperations: () => {
        invalidations++;
      },
      clearCachedData: () => {
        cacheClears++;
      },
      clearDismissedWarning: () => {
        throw new Error('must not run');
      },
    });

    expect(reset).toBe(false);
    expect(state.result).toBe(result);
    expect(state.result?.transactions?.[0]?.merchant).toBe('남겨야 하는 거래');
    expect(state.error).toBe(CLEAR_ANALYSIS_RESET_ERROR);
    expect(state.persistWarningKind).toBe('error');
    expect(state.truncatedTxCount).toBeNull();
    expect(invalidations).toBe(0);
    expect(cacheClears).toBe(0);

    const persisted = storage.get(STORAGE_KEY);
    expect(persisted).toBeDefined();
    expect(
      deserializeAnalysis(persisted!).data?.transactions?.[0]?.merchant,
    ).toBe('남겨야 하는 거래');
  });

  test('successful deletion clears memory only after durable storage', () => {
    const result = analysisFixture();
    const state = stateFixture(result);
    const storage = new Map([
      [STORAGE_KEY, serializeAnalysis(result).serialized],
    ]);
    const events: string[] = [];

    const reset = resetAnalysisState(state, {
      clearPersistedAnalysis: () => {
        events.push('durable-clear');
        storage.delete(STORAGE_KEY);
        return { kind: null, truncatedTxCount: null };
      },
      invalidateOperations: () => {
        events.push(`invalidate:${state.result === null ? 'empty' : 'present'}`);
      },
      clearCachedData: () => {
        events.push(`cache:${state.result === null ? 'empty' : 'present'}`);
      },
      clearDismissedWarning: () => {
        events.push('dismissal-clear');
        throw new Error('noncritical preference failure');
      },
    });

    expect(reset).toBe(true);
    expect(events).toEqual([
      'durable-clear',
      'invalidate:present',
      'cache:empty',
      'dismissal-clear',
    ]);
    expect(storage.has(STORAGE_KEY)).toBe(false);
    expect(state).toEqual({
      result: null,
      loading: false,
      error: null,
      persistWarningKind: null,
      truncatedTxCount: null,
    });
  });

  test('store exposes corrupted restore state through its public error signal', async () => {
    const source = await readFile(
      new URL('../src/lib/store.svelte.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain(
      'if (deserialized.data === null) {',
    );
    expect(source).toContain(
      '_loadRestoreError = CORRUPTED_RESTORE_ERROR;',
    );
    expect(source).toContain(
      'let error = $state<string | null>(_loadRestoreError);',
    );
    expect(source).toContain(
      'result !== null && _loadPersistWarningKind !== null',
    );
  });
});
