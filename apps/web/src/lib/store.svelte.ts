// Shared Svelte 5 state store for analysis results across dashboard components
// Must be .svelte.ts so that $state runes are compiled properly

import type { CategorizedTx } from './analyzer.js';
import {
  buildAnalysisContext,
  type PreviousSpendingBasis,
} from './analysis-context.js';
import { loadCategories } from './cards.js';
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
import type {
  FileParseProgress,
  FileParseRun,
} from './file-parse-queue.js';
import { OperationEpoch } from './operation-epoch.js';

type AnalyzerModule = typeof import('./analyzer.js');
let analyzerModulePromise: Promise<AnalyzerModule> | null = null;

function loadAnalyzerModule(): Promise<AnalyzerModule> {
  analyzerModulePromise ??= import('./analyzer.js');
  return analyzerModulePromise;
}

// --- Types matching the API response shape ---

export interface CategoryReward {
  category: string;
  categoryNameKo: string;
  spending: number;
  reward: number;
  rate: number;
  rewardType: string;
  capReached: boolean;
  capAmount?: number;
}

export interface CapInfo {
  category: string;
  capType: 'monthly_category' | 'monthly_total' | 'per_transaction';
  capAmount: number;
  actualReward: number;
  appliedReward: number;
}

export interface CardRewardResult {
  cardId: string;
  cardName: string;
  totalReward: number;
  totalSpending: number;
  effectiveRate: number;
  byCategory: CategoryReward[];
  performanceTier: string;
  capsHit: CapInfo[];
  unsupportedRules?: CalculationIssue[];
}

export interface CalculationIssue {
  cardId: string;
  transactionId: string;
  ruleId: string;
  category: string;
  reason: string;
  detail?: string;
}

export interface CardAssignment {
  category: string;
  categoryNameKo: string;
  assignedCardId: string;
  assignedCardName: string;
  spending: number;
  reward: number;
  rate: number;
  alternatives: {
    cardId: string;
    cardName: string;
    reward: number;
    rate: number;
  }[];
}

export interface OptimizationResult {
  assignments: CardAssignment[];
  totalReward: number;
  totalSpending: number;
  effectiveRate: number;
  savingsVsSingleCard: number;
  bestSingleCard: { cardId: string; cardName: string; totalReward: number };
  cardResults: CardRewardResult[];
  unsupportedRules?: CalculationIssue[];
}

export interface AnalysisResult {
  success: boolean;
  bank: string | null;
  format: string;
  /** Period and count for the optimized month only */
  statementPeriod?: { start: string; end: string };
  transactionCount: number;
  /** Period and count spanning all uploaded months */
  fullStatementPeriod?: { start: string; end: string };
  totalTransactionCount?: number;
  parseErrors: {
    fileName: string;
    format: string;
    line?: number;
    message: string;
    raw?: string;
    count?: number;
  }[];
  transactions?: CategorizedTx[];
  optimization: OptimizationResult;
  monthlyBreakdown?: { month: string; spending: number; transactionCount: number }[];
  /** The user's explicit previousMonthSpending input (if provided during
   *  analysis). Forwarded to reoptimize() so that category edits preserve
   *  the user's original performance tier baseline instead of silently
   *  recomputing it from exclusion-filtered spending (C44-01). */
  previousMonthSpendingOption?: number;
  /** The user's explicit cardIds filter (if provided during analysis).
   *  Forwarded to reoptimize() so that category edits preserve the user's
   *  card selection instead of silently optimizing against all cards. */
  cardIdsOption?: string[];
  /** Inspectable provenance for the performance-spending input. */
  previousSpendingBasis?: PreviousSpendingBasis;
}

export interface AnalyzeOptions {
  bank?: string;
  previousMonthSpending?: number;
  cardIds?: string[];
  /** Internal normalized context shared by initial analysis/reoptimization. */
  previousSpendingBasis?: PreviousSpendingBasis;
  /** Exact previous-calendar-month rows for card-specific exclusions. */
  previousMonthTransactions?: CategorizedTx[];
}

export interface AnalyzeExecution {
  run: FileParseRun;
  onProgress?: (progress: FileParseProgress) => void;
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

/** Track the persist warning kind detected during loadFromStorage.
 *  - 'truncated': transactions key was absent (omitted during save due to size)
 *  - 'corrupted': transactions key existed but all entries failed validation
 */
let _loadPersistWarningKind: PersistWarningKind = null;

/** Track how many transactions were lost during truncation, read from
 *  the _truncatedTxCount field in the persisted data (C22-03). */
let _loadTruncatedTxCount: number | null = null;

function loadFromStorage(): AnalysisResult | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const deserialized = deserializeAnalysis(raw);
      _loadPersistWarningKind = deserialized.warningKind;
      _loadTruncatedTxCount = deserialized.truncatedTxCount;
      if (deserialized.shouldRemove) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      return deserialized.data;
    }
  } catch (err) {
    // Load failure handles JSON.parse errors, validation failures, and
    // unexpected exceptions from sessionStorage.getItem. The UI surfaces
    // persistence issues via persistWarningKind; no console logging needed.
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY); } catch (err2) {
      // Best-effort cleanup: corrupted data removal.
      // SecurityError in sandboxed iframes is expected and safe to ignore.
    }
  }
  return null;
}

function clearStorage(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
      // Also clear the dismissed-warning flag so the data-loss warning
      // re-appears after a reset+re-upload (C78-01).
      sessionStorage.removeItem('cherrypicker:dismissed-warning');
    }
  } catch (err) {
    // SSR environments don't have sessionStorage — that's expected.
    // SecurityError in sandboxed iframes is also safe to ignore.
  }
}

// --- Store ---

function createAnalysisStore() {
  let result = $state<AnalysisResult | null>(loadFromStorage());
  let loading = $state(false);
  let error = $state<string | null>(null);
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
    result !== null && result.transactions === undefined && _loadPersistWarningKind !== null
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

  // Cache category labels to avoid rebuilding the Map on every reoptimize call.
  let cachedCategoryLabels: Map<string, string> | undefined;

  async function getCategoryLabels(): Promise<Map<string, string>> {
    if (cachedCategoryLabels) return cachedCategoryLabels;
    const nodes = await loadCategories();
    // Don't cache an empty Map — loadCategories() returns [] on AbortError,
    // and caching the empty result would poison all subsequent reoptimize()
    // calls to show raw English keys instead of Korean labels (C72-03).
    // Returning the empty Map for this call is acceptable because the caller
    // (reoptimize) will still function — labels are cosmetic, not structural.
    const labels = buildCategoryLabelMap(nodes);
    if (nodes.length > 0) {
      cachedCategoryLabels = labels;
    }
    return labels;
  }

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
      const operation = operationEpoch.begin();
      const isActiveRequest = () =>
        operation.isCurrent() && execution.run.isCurrent();
      loading = true;
      error = null;

      try {
        const fileArray = Array.isArray(files) ? files : [files];
        const { analyzeMultipleFiles } = await loadAnalyzerModule();
        const analysisResult = await analyzeMultipleFiles(
          fileArray,
          options,
          execution,
        );
        if (!isActiveRequest()) return;
        // Preserve the user's explicit previousMonthSpending input so
        // reoptimize() can forward it instead of silently dropping it (C44-01).
        if (
          options?.previousMonthSpending !== undefined &&
          Number.isFinite(options.previousMonthSpending) &&
          options.previousMonthSpending >= 0
        ) {
          analysisResult.previousMonthSpendingOption = options.previousMonthSpending;
        }
        // Preserve the user's explicit cardIds filter so reoptimize()
        // can forward it instead of silently optimizing against all cards.
        if (options?.cardIds && options.cardIds.length > 0) {
          analysisResult.cardIdsOption = options.cardIds;
        }
        result = analysisResult;
        generation++;
        const persistResult = persistToStorage(analysisResult);
        persistWarningKind = persistResult.kind;
        truncatedTxCount = persistResult.truncatedTxCount;
      } catch (e) {
        if (!isActiveRequest() || (e instanceof Error && e.name === 'AbortError')) {
          return;
        }
        error = e instanceof Error ? e.message : '분석 중 문제가 생겼어요';
        result = null;
      } finally {
        if (operation.isCurrent()) {
          loading = false;
        }
      }
    },

    cancelAnalysis(): void {
      operationEpoch.invalidate();
      loading = false;
      error = null;
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
          clearStorage();
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

        const categoryLabels = await getCategoryLabels();
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
        const optimization = await optimizeFromTransactions(context.latestTransactions, {
          ...options,
          previousMonthSpending: explicitPreviousMonthSpending,
          previousSpendingBasis: context.previousSpendingBasis,
          previousMonthTransactions: context.previousTransactions,
          // Forward the user's cardIds selection from the initial analysis
          // so reoptimize doesn't silently switch to optimizing against all cards.
          cardIds: options?.cardIds ?? snapshot.cardIdsOption,
        }, categoryLabels);
        if (!operation.isCurrent() || result !== snapshot) return;
        // result is guaranteed non-null here (early null guard at top of try block).
        // Keep all months in the transactions field for display/editing,
        // but the optimization only covers the latest month.
        // Use the snapshot captured at function entry instead of reading the
        // reactive result variable, which may have changed during the async
        // gaps above (C81-01).
        result = {
          ...snapshot,
          transactions: editedTransactions,
          optimization,
          monthlyBreakdown: context.monthlyBreakdown,
          transactionCount: context.latestTransactions.length,
          totalTransactionCount: context.validTransactions.length,
          statementPeriod: context.statementPeriod,
          fullStatementPeriod: context.fullStatementPeriod,
          previousSpendingBasis: context.previousSpendingBasis,
          previousMonthSpendingOption:
            context.previousSpendingBasis.kind === 'user-total'
              ? context.previousSpendingBasis.amount
              : undefined,
        };
        generation++;
        const persistResult = persistToStorage(result);
        persistWarningKind = persistResult.kind;
        truncatedTxCount = persistResult.truncatedTxCount;
      } catch (e) {
        if (!operation.isCurrent()) return;
        error = e instanceof Error ? e.message : '재계산 중 문제가 생겼어요';
      } finally {
        if (operation.isCurrent()) loading = false;
      }
    },

    reset(): void {
      operationEpoch.invalidate();
      result = null;
      error = null;
      loading = false;
      persistWarningKind = null;
      truncatedTxCount = null;
      // NOTE: module-level `_loadPersistWarningKind` / `_loadTruncatedTxCount`
      // are already consumed + nulled during store construction (:379-380) and
      // this store is a singleton, so resetting them here is a no-op. Removed
      // in cycle 8 as D7-M1 cleanup.
      cachedCategoryLabels = undefined;
      clearStorage();
    },
  };
}

export const analysisStore = createAnalysisStore();
