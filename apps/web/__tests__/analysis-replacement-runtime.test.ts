import { describe, expect, test } from 'bun:test';
import {
  AnalysisReplacementRuntime,
  type AnalysisReplacementState,
} from '../src/lib/analysis-replacement-runtime.js';
import {
  LatestFileParseRun,
  type FileParseRun,
} from '../src/lib/file-parse-queue.js';
import { OperationEpoch } from '../src/lib/operation-epoch.js';
import {
  deserializeAnalysis,
  serializeAnalysis,
  STORAGE_KEY,
} from '../src/lib/persistence.js';
import {
  isAnalysisResultCoherent,
  type AnalysisResult,
} from '../src/lib/analysis-result.js';

function analysisFixture(merchant: string): AnalysisResult {
  return {
    success: true,
    bank: 'shinhan',
    format: 'csv',
    statementPeriod: { start: '2026-07-23', end: '2026-07-23' },
    transactionCount: 1,
    fullStatementPeriod: { start: '2026-07-23', end: '2026-07-23' },
    totalTransactionCount: 1,
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

function rejectedRun(kind: 'stale' | 'aborted'): FileParseRun {
  const controller = new AbortController();
  if (kind === 'aborted') controller.abort();

  return Object.freeze({
    generation: 99,
    signal: controller.signal,
    isCurrent: () => kind !== 'stale',
    commit(): boolean {
      throw new Error(`${kind} entry must not acquire operation ownership`);
    },
  });
}

async function expectRejectedEntryDoesNotDisturbCurrent(
  rejected: FileParseRun,
): Promise<void> {
  const storage = new Map<string, string>();
  const state = {
    ...emptyState(),
    result: analysisFixture('success-a'),
    loading: true,
    error: 'current operation owns this state',
    generation: 1,
    persistWarningKind: 'truncated' as const,
    truncatedTxCount: 4,
  };
  const persistedA = serializeAnalysis(state.result).serialized;
  storage.set(STORAGE_KEY, persistedA);

  const calls = {
    clear: 0,
    load: 0,
    analyze: 0,
    persist: 0,
  };
  const operationEpoch = new OperationEpoch();
  const currentOperation = operationEpoch.begin();
  const runtime = new AnalysisReplacementRuntime(
    state,
    {
      async loadAnalyzerModule() {
        calls.load++;
        return {
          async analyzeMultipleFiles() {
            calls.analyze++;
            return analysisFixture('replacement-b');
          },
        };
      },
      persist(data) {
        calls.persist++;
        const persisted = serializeAnalysis(data);
        storage.set(STORAGE_KEY, persisted.serialized);
        return persisted.result;
      },
      clearPersistedAnalysis() {
        calls.clear++;
        storage.delete(STORAGE_KEY);
        return { kind: null, truncatedTxCount: null };
      },
    },
    operationEpoch,
  );
  const stateBeforeRejectedEntry = { ...state };

  await runtime.analyze(
    new File(['row'], 'rejected.csv'),
    undefined,
    { run: rejected },
  );

  expect(state).toEqual(stateBeforeRejectedEntry);
  expect(state.result).toBe(stateBeforeRejectedEntry.result);
  expect(state.result?.transactions?.[0]?.merchant).toBe('success-a');
  expect(storage.get(STORAGE_KEY)).toBe(persistedA);
  expect(calls).toEqual({
    clear: 0,
    load: 0,
    analyze: 0,
    persist: 0,
  });
  expect(currentOperation.isCurrent()).toBe(true);
  expect(currentOperation.signal.aborted).toBe(false);
}

describe('replacement analysis runtime', () => {
  test('deduplicates and revalidates card selection before commit and persistence', async () => {
    const state = emptyState();
    const persisted: AnalysisResult[] = [];
    const runtime = new AnalysisReplacementRuntime(state, {
      async loadAnalyzerModule() {
        return {
          async analyzeMultipleFiles() {
            return analysisFixture('deduplicated');
          },
        };
      },
      persist(data) {
        persisted.push(data);
        return { kind: null, truncatedTxCount: null };
      },
      clearPersistedAnalysis() {
        return { kind: null, truncatedTxCount: null };
      },
    });

    await runtime.analyze(
      new File(['row'], 'statement.csv'),
      { cardIds: ['card-1', 'card-1'] },
      { run: new LatestFileParseRun().begin() },
    );

    const committed = state.result;
    if (!committed) throw new Error('expected a committed analysis result');
    expect(committed.cardIdsOption).toEqual(['card-1']);
    expect(isAnalysisResultCoherent(committed)).toBe(true);
    expect(persisted).toEqual([committed]);
    expect(state.error).toBeNull();
  });

  test('already-stale entry is a complete no-op and does not abort current owned analysis', async () => {
    await expectRejectedEntryDoesNotDisturbCurrent(rejectedRun('stale'));
  });

  test('already-aborted entry is a complete no-op and does not abort current owned analysis', async () => {
    await expectRejectedEntryDoesNotDisturbCurrent(rejectedRun('aborted'));
  });

  test('failed persisted clear preserves A in memory and reload storage without starting B', async () => {
    const storage = new Map<string, string>();
    const resultA = analysisFixture('success-a');
    const persistedA = serializeAnalysis(resultA).serialized;
    storage.set(STORAGE_KEY, persistedA);
    const state: AnalysisReplacementState = {
      ...emptyState(),
      result: resultA,
      generation: 7,
      persistWarningKind: 'truncated',
      truncatedTxCount: 4,
    };
    const calls = {
      clear: 0,
      load: 0,
      analyze: 0,
      persist: 0,
    };
    const runtime = new AnalysisReplacementRuntime(state, {
      async loadAnalyzerModule() {
        calls.load++;
        return {
          async analyzeMultipleFiles() {
            calls.analyze++;
            return analysisFixture('replacement-b');
          },
        };
      },
      persist(data) {
        calls.persist++;
        const persisted = serializeAnalysis(data);
        storage.set(STORAGE_KEY, persisted.serialized);
        return persisted.result;
      },
      clearPersistedAnalysis() {
        calls.clear++;
        return { kind: 'error', truncatedTxCount: null };
      },
    });

    await runtime.analyze(
      new File(['row'], 'replacement.csv'),
      undefined,
      { run: new LatestFileParseRun().begin() },
    );

    expect(calls).toEqual({
      clear: 1,
      load: 0,
      analyze: 0,
      persist: 0,
    });
    expect(state.result).toBe(resultA);
    expect(state.generation).toBe(7);
    expect(state.loading).toBe(false);
    expect(state.error).toBe(
      '저장된 이전 분석 결과를 삭제하지 못했어요. 페이지를 새로고침하고 다시 시도해 보세요.',
    );
    expect(state.persistWarningKind).toBe('error');
    expect(state.truncatedTxCount).toBeNull();
    expect(storage.get(STORAGE_KEY)).toBe(persistedA);
    expect(reloadResult(storage)?.transactions?.[0]?.merchant).toBe('success-a');
  });

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
