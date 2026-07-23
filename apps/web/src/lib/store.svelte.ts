// Shared Svelte 5 state store for analysis results across dashboard components
// Must be .svelte.ts so that $state runes are compiled properly

import type {
  CardAssignment,
  CardRewardResult,
  OptimizationResult,
} from '@cherrypicker/core';
export type {
  CalculationIssue,
  CapInfo,
  CardAssignment,
  CardRewardResult,
  CategoryReward,
  OptimizationResult,
} from '@cherrypicker/core';
import { buildAnalysisContext } from './analysis-context.js';
import {
  buildCategorySpendingSummary,
  isAnalysisResultCoherent,
  normalizeCardIdsOption,
  type AnalysisResult,
  type AnalyzeExecution,
  type AnalyzeOptions,
  type CategorizedTx,
} from './analysis-result.js';
export type {
  AnalysisResult,
  AnalyzeExecution,
  AnalyzeOptions,
  CategorizedTx,
} from './analysis-result.js';
import { buildCategoryLabelMap } from './category-labels.js';
import {
  deserializeAnalysis,
  serializeAnalysis,
  STORAGE_KEY,
} from './persistence.js';
import type {
  PersistResult,
  PersistWarningKind,
} from './persistence.js';
import type { FileParseRun } from './file-parse-queue.js';
import { OperationEpoch } from './operation-epoch.js';
import {
  AnalysisReplacementRuntime,
  type AnalysisReplacementState,
} from './analysis-replacement-runtime.js';
import { resetAnalysisState } from './analysis-reset-runtime.js';

type AnalyzerModule = typeof import('./analyzer.js');
let analyzerModulePromise: Promise<AnalyzerModule> | null = null;

function loadAnalyzerModule(): Promise<AnalyzerModule> {
  analyzerModulePromise ??= import('./analyzer.js');
  return analyzerModulePromise;
}

// --- SessionStorage persistence ---
// NOTE(C33-F4): sessionStorage persists analysis data as plaintext JSON.
// This is acceptable for the current threat model (single-user browser tab)
// but means financial data is visible to any JavaScript on the origin,
// including browser extensions. The side-effect-free persistence module
// validates and migrates data before this store accepts it, but encryption is
// not implemented.

function persistToStorage(data: AnalysisResult): PersistResult {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const { serialized, result } = serializeAnalysis(data);
      sessionStorage.setItem(STORAGE_KEY, serialized);
      return result;
    }
  } catch (err) {
    // QuotaExceededError is expected in private browsing or with very large data
    if (typeof DOMException !== 'undefined' && err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      return { kind: 'quota_exceeded', truncatedTxCount: null };
    }
    // Non-quota errors (e.g., circular reference in JSON.stringify) are unexpected.
    // Return 'error' instead of 'corrupted' to distinguish code bugs from quota
    // failures (C66-04/C69). The UI surfaces this via persistWarningKind.
    return { kind: 'error', truncatedTxCount: null };
  }
  return { kind: null, truncatedTxCount: null };
}

function clearPersistedAnalysis(): PersistResult {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    return { kind: null, truncatedTxCount: null };
  } catch {
    return { kind: 'error', truncatedTxCount: null };
  }
}

/** Track the persist warning kind detected during loadFromStorage.
 *  - 'truncated': transactions key was absent (omitted during save due to size)
 *  - 'corrupted': one or more persisted transactions failed validation
 */
let _loadPersistWarningKind: PersistWarningKind = null;

/** Track how many transactions were lost during truncation, read from
 *  the _truncatedTxCount field in the persisted data (C22-03). */
let _loadTruncatedTxCount: number | null = null;
/** Initial route-shell error when a persisted payload cannot be restored. */
let _loadRestoreError: string | null = null;

const CORRUPTED_RESTORE_ERROR =
  '저장된 분석 결과가 손상되어 불러오지 못했어요. 명세서를 다시 분석해 주세요.';
const STORAGE_ACCESS_ERROR =
  '저장된 분석 결과에 접근하지 못했어요. 페이지를 새로고침하고 다시 시도해 주세요.';

function loadFromStorage(): AnalysisResult | null {
  _loadPersistWarningKind = null;
  _loadTruncatedTxCount = null;
  _loadRestoreError = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const deserialized = deserializeAnalysis(raw);
      _loadPersistWarningKind = deserialized.warningKind;
      _loadTruncatedTxCount = deserialized.truncatedTxCount;
      if (deserialized.data === null) {
        _loadRestoreError = CORRUPTED_RESTORE_ERROR;
      }
      if (deserialized.shouldRemove) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      return deserialized.data;
    }
  } catch {
    // Load failure handles JSON.parse errors, validation failures, and
    // unexpected exceptions from sessionStorage access. The route readiness
    // shell consumes _loadRestoreError instead of announcing a false empty state.
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY); } catch {
      // Best-effort cleanup: corrupted data removal.
      // SecurityError in sandboxed iframes is expected and safe to ignore.
    }
    _loadPersistWarningKind = 'error';
    _loadTruncatedTxCount = null;
    _loadRestoreError = STORAGE_ACCESS_ERROR;
  }
  return null;
}

function clearDismissedWarning(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('cherrypicker:dismissed-warning');
    }
  } catch {
    // This preference cannot restore analysis data and is best effort.
  }
}

// --- Store ---

function createAnalysisStore() {
  let result = $state<AnalysisResult | null>(loadFromStorage());
  let loading = $state(false);
  let error = $state<string | null>(_loadRestoreError);
  // Initialize generation to 1 when data is restored from sessionStorage so
  // that TransactionReview's sync effect triggers on mount (1 !== 0). Without
  // this, both generation and lastSyncedGeneration start at 0 after a page
  // refresh, the condition `gen !== lastSyncedGeneration` is false, and
  // editedTxs stays empty even though the store has transactions (C7-01).
  let generation = $state(result !== null ? 1 : 0);
  // Analyze, reoptimize, cancel, and reset all mutate the same state. One
  // operation owner prevents any older async continuation from committing.
  const operationEpoch = new OperationEpoch();
  // Set when sessionStorage persistence was partial (transactions truncated)
  // or failed entirely (quota exceeded). Reset on successful full save.
  // Only set the warning when we have evidence the data came from storage
  // (i.e. _loadPersistWarningKind was set by loadFromStorage). If the data
  // was just computed (not loaded), there's no persistence warning to show.
  let persistWarningKind = $state<PersistWarningKind>(
    result !== null && _loadPersistWarningKind !== null
      ? _loadPersistWarningKind
      : null
  );
  // When transactions are truncated during sessionStorage persistence,
  // records how many were lost so the warning can inform the user (C22-03).
  let truncatedTxCount = $state<number | null>(
    persistWarningKind === 'truncated' ? _loadTruncatedTxCount : null
  );
  // Consume and reset the load-time warning kind so it doesn't leak
  // across store re-creation (e.g. HMR) or stale after reset.
  _loadPersistWarningKind = null;
  _loadTruncatedTxCount = null;
  _loadRestoreError = null;

  // Cache category labels to avoid rebuilding the Map on every reoptimize call.
  let cachedCategoryLabels: Map<string, string> | undefined;

  async function getCategoryLabels(
    signal?: AbortSignal,
  ): Promise<Map<string, string>> {
    if (cachedCategoryLabels) return cachedCategoryLabels;
    const { loadCategories } = await import('./cards.js');
    const nodes = await loadCategories(signal);
    if (signal?.aborted) {
      throw new DOMException('재계산이 취소되었어요.', 'AbortError');
    }
    // Don't cache an empty Map: an unexpectedly empty artifact must not poison
    // later reoptimization calls with raw English keys (C72-03).
    // Returning the empty Map for this call is acceptable because the caller
    // (reoptimize) will still function — labels are cosmetic, not structural.
    const labels = buildCategoryLabelMap(nodes);
    if (nodes.length > 0) {
      cachedCategoryLabels = labels;
    }
    return labels;
  }

  const replacementState: AnalysisReplacementState = {
    get result() {
      return result;
    },
    set result(value) {
      result = value;
    },
    get loading() {
      return loading;
    },
    set loading(value) {
      loading = value;
    },
    get error() {
      return error;
    },
    set error(value) {
      error = value;
    },
    get generation() {
      return generation;
    },
    set generation(value) {
      generation = value;
    },
    get persistWarningKind() {
      return persistWarningKind;
    },
    set persistWarningKind(value) {
      persistWarningKind = value;
    },
    get truncatedTxCount() {
      return truncatedTxCount;
    },
    set truncatedTxCount(value) {
      truncatedTxCount = value;
    },
  };
  const replacementRuntime = new AnalysisReplacementRuntime(
    replacementState,
    {
      loadAnalyzerModule,
      persist: persistToStorage,
      clearPersistedAnalysis,
    },
    operationEpoch,
  );

  return {
    get result() {
      return result;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get generation() {
      return generation;
    },
    get persistWarning(): boolean {
      return persistWarningKind !== null;
    },
    get persistWarningKind(): PersistWarningKind {
      return persistWarningKind;
    },
    get truncatedTxCount(): number | null {
      return truncatedTxCount;
    },

    // Derived helpers
    get analysisResult(): AnalysisResult | null {
      return result;
    },
    get optimization(): OptimizationResult | null {
      return result?.optimization ?? null;
    },
    get assignments(): CardAssignment[] {
      return result?.optimization?.assignments ?? [];
    },
    get cardResults(): CardRewardResult[] {
      return result?.optimization?.cardResults ?? [];
    },
    get transactionCount(): number {
      return result?.transactionCount ?? 0;
    },
    get statementPeriod(): { start: string; end: string } | undefined {
      return result?.statementPeriod;
    },
    get totalTransactionCount(): number {
      return result?.totalTransactionCount ?? result?.transactionCount ?? 0;
    },
    get fullStatementPeriod(): { start: string; end: string } | undefined {
      return result?.fullStatementPeriod ?? result?.statementPeriod;
    },
    get transactions(): CategorizedTx[] {
      return result?.transactions ?? [];
    },

    async analyze(
      files: File | File[],
      options: AnalyzeOptions | undefined,
      execution: AnalyzeExecution,
    ): Promise<void> {
      await replacementRuntime.analyze(files, options, execution);
    },

    cancelAnalysis(): void {
      replacementRuntime.cancel();
    },

    async reoptimize(editedTransactions: CategorizedTx[], options?: AnalyzeOptions): Promise<void> {
      const operation = operationEpoch.begin();
      loading = true;
      error = null;
      try {
        // Early null guard — if the store was reset before reoptimize is called,
        // we cannot apply edits. This also fixes the TypeScript compilation error
        // where result.previousMonthSpendingOption was accessed before the null
        // check at the bottom of this method (C45-01).
        if (!result) {
          clearPersistedAnalysis();
          error = '분석 결과가 없어요. 다시 분석해 보세요.';
          return;
        }

        // Snapshot the result immediately after the null guard so that all
        // subsequent reads use the same value. Without this, the reactive
        // $state variable could change during the async gaps (e.g., if
        // analyze() is called concurrently), causing the ...result! spread
        // at the end of this method to mix data from two different analysis
        // runs (C81-01).
        const snapshot = result;

        const categoryLabels = await getCategoryLabels(operation.signal);
        if (!operation.isCurrent() || result !== snapshot) return;
        const explicitPreviousMonthSpending =
          options?.previousMonthSpending ??
          (options?.previousSpendingBasis?.kind === 'user-total'
            ? options.previousSpendingBasis.amount
            : snapshot.previousSpendingBasis?.kind === 'user-total'
              ? snapshot.previousSpendingBasis.amount
              : snapshot.previousMonthSpendingOption);
        const context = buildAnalysisContext(
          editedTransactions,
          explicitPreviousMonthSpending,
        );
        if (!context) {
          throw new Error(
            '거래 내역의 날짜를 해석할 수 없어요. 파일 형식을 확인해 주세요.',
          );
        }

        const { optimizeFromTransactions } = await loadAnalyzerModule();
        if (!operation.isCurrent() || result !== snapshot) return;
        const selectedCardIds = normalizeCardIdsOption(
          options?.cardIds,
          snapshot.cardIdsOption,
        );
        const reoptimizationRun: FileParseRun = Object.freeze({
          generation: operation.epoch,
          signal: operation.signal,
          isCurrent: () =>
            operation.isCurrent() && result === snapshot,
          commit(effect: () => void): boolean {
            if (!operation.isCurrent() || result !== snapshot) return false;
            effect();
            return true;
          },
        });
        const optimization = await optimizeFromTransactions(context.latestTransactions, {
          ...options,
          previousMonthSpending: explicitPreviousMonthSpending,
          previousSpendingBasis: context.previousSpendingBasis,
          previousMonthTransactions: context.previousTransactions,
          // Forward the user's cardIds selection from the initial analysis
          // so reoptimize doesn't silently switch to optimizing against all cards.
          cardIds: selectedCardIds,
        }, categoryLabels, { run: reoptimizationRun });
        if (!operation.isCurrent() || result !== snapshot) return;
        // result is guaranteed non-null here (early null guard at top of try block).
        // Keep all months in the transactions field for display/editing,
        // but the optimization only covers the latest month.
        // Use the snapshot captured at function entry instead of reading the
        // reactive result variable, which may have changed during the async
        // gaps above (C81-01).
        const nextResult: AnalysisResult = {
          ...snapshot,
          transactions: editedTransactions,
          categoryBreakdown: buildCategorySpendingSummary(
            context.latestTransactions,
            categoryLabels,
          ),
          optimization,
          monthlyBreakdown: context.monthlyBreakdown,
          transactionCount: context.latestTransactions.length,
          totalTransactionCount: context.validTransactions.length,
          statementPeriod: context.statementPeriod,
          fullStatementPeriod: context.fullStatementPeriod,
          previousSpendingBasis: context.previousSpendingBasis,
          cardIdsOption: selectedCardIds,
          previousMonthSpendingOption:
            context.previousSpendingBasis.kind === 'user-total'
              ? context.previousSpendingBasis.amount
              : undefined,
        };
        if (!isAnalysisResultCoherent(nextResult)) {
          throw new Error(
            '재계산 결과의 합계가 거래 내역과 일치하지 않아요. 다시 분석해 주세요.',
          );
        }
        result = nextResult;
        generation++;
        if (!operation.isCurrent()) return;
        const persistResult = persistToStorage(result);
        persistWarningKind = persistResult.kind;
        truncatedTxCount = persistResult.truncatedTxCount;
      } catch (e) {
        if (
          !operation.isCurrent() ||
          (e instanceof Error && e.name === 'AbortError')
        ) return;
        error = e instanceof Error ? e.message : '재계산 중 문제가 생겼어요';
      } finally {
        if (operation.isCurrent()) loading = false;
      }
    },

    reset(): void {
      resetAnalysisState(replacementState, {
        clearPersistedAnalysis,
        invalidateOperations: () => operationEpoch.invalidate(),
        clearCachedData: () => {
          cachedCategoryLabels = undefined;
        },
        clearDismissedWarning,
      });
    },
  };
}

export const analysisStore = createAnalysisStore();
