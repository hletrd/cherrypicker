import { describe, expect, test } from 'bun:test';
import {
  AnalysisReplacementRuntime,
  type AnalysisReplacementState,
} from '../src/lib/analysis-replacement-runtime.js';
import { LatestFileParseRun } from '../src/lib/file-parse-queue.js';
import {
  deserializeAnalysis,
  serializeAnalysis,
  STORAGE_KEY,
} from '../src/lib/persistence.js';
import type { AnalysisResult } from '../src/lib/store.svelte.js';

function analysisFixture(merchant: string): AnalysisResult {
  return {
    success: true,
    bank: 'shinhan',
    format: 'csv',
    transactionCount: 1,
    parseErrors: [],
    transactions: [{
      id: `tx-${merchant}`,
      date: '2026-07-23',
      merchant,
      amount: 10_000,
      category: 'dining',
      subcategory: undefined,
      confidence: 1,
    }],
    optimization: {
      assignments: [],
      totalReward: 0,
      totalSpending: 10_000,
      effectiveRate: 0,
      savingsVsSingleCard: 0,
      bestSingleCard: { cardId: '', cardName: '', totalReward: 0 },
      cardResults: [],
    },
  };
}

function emptyState(): AnalysisReplacementState {
  return {
    result: null,
    loading: false,
    error: null,
    generation: 0,
    persistWarningKind: null,
    truncatedTxCount: null,
  };
}

function reloadResult(storage: Map<string, string>): AnalysisResult | null {
  const raw = storage.get(STORAGE_KEY);
  return raw ? deserializeAnalysis(raw).data : null;
}

describe('replacement analysis runtime', () => {
  test('success A then failure B leaves memory, reload, and direct-route state empty', async () => {
    const storage = new Map<string, string>();
    const state = emptyState();
    let call = 0;
    const runtime = new AnalysisReplacementRuntime(state, {
      async loadAnalyzerModule() {
        return {
          async analyzeMultipleFiles() {
            call++;
            if (call === 1) return analysisFixture('success-a');
            throw new Error('replacement B failed');
          },
        };
      },
      persist(data) {
        const persisted = serializeAnalysis(data);
        storage.set(STORAGE_KEY, persisted.serialized);
        return persisted.result;
      },
      clearPersistedAnalysis() {
        storage.delete(STORAGE_KEY);
        return { kind: null, truncatedTxCount: null };
      },
    });
    const runs = new LatestFileParseRun();
    const file = new File(['날짜,가맹점,금액'], 'statement.csv');

    await runtime.analyze(file, undefined, { run: runs.begin() });
    expect(state.result?.transactions?.[0]?.merchant).toBe('success-a');
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.generation).toBe(1);
    expect(state.persistWarningKind).toBeNull();
    expect(state.truncatedTxCount).toBeNull();
    expect(storage.get(STORAGE_KEY)?.length).toBeGreaterThan(0);

    await runtime.analyze(file, undefined, { run: runs.begin() });
    expect(state.result).toBeNull();
    expect(state.error).toBe('replacement B failed');
    expect(state.loading).toBe(false);
    expect(state.generation).toBe(2);
    expect(state.persistWarningKind).toBeNull();
    expect(state.truncatedTxCount).toBeNull();
    expect(storage.has(STORAGE_KEY)).toBe(false);

    // A reload and a direct-route entry both construct from the same absent
    // storage bytes, so neither can resurrect success A.
    expect(reloadResult(storage)).toBeNull();
    expect(reloadResult(storage)).toBeNull();
  });

  test('canceling replacement B keeps its already-cleared state empty without an error', async () => {
    const storage = new Map<string, string>();
    const state = {
      ...emptyState(),
      result: analysisFixture('success-a'),
      generation: 1,
      persistWarningKind: 'truncated' as const,
      truncatedTxCount: 4,
    };
    storage.set(
      STORAGE_KEY,
      serializeAnalysis(state.result).serialized,
    );
    const runtime = new AnalysisReplacementRuntime(state, {
      async loadAnalyzerModule() {
        return {
          analyzeMultipleFiles(
            _files,
            _options,
            execution,
          ): Promise<AnalysisResult> {
            return new Promise((_resolve, reject) => {
              execution?.run.signal.addEventListener(
                'abort',
                () => reject(new DOMException('cancelled', 'AbortError')),
                { once: true },
              );
            });
          },
        };
      },
      persist() {
        throw new Error('cancelled work must not persist');
      },
      clearPersistedAnalysis() {
        storage.delete(STORAGE_KEY);
        return { kind: null, truncatedTxCount: null };
      },
    });
    const analyzing = runtime.analyze(
      new File(['row'], 'replacement.csv'),
      undefined,
      { run: new LatestFileParseRun().begin() },
    );

    await Promise.resolve();
    expect(state.result).toBeNull();
    expect(state.generation).toBe(2);
    expect(state.persistWarningKind).toBeNull();
    expect(state.truncatedTxCount).toBeNull();
    expect(storage.has(STORAGE_KEY)).toBe(false);

    runtime.cancel();
    await analyzing;
    expect(state.result).toBeNull();
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
    expect(storage.has(STORAGE_KEY)).toBe(false);
  });
});
