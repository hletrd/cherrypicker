// Shared Svelte 5 state store for analysis results across dashboard components
// Must be .svelte.ts so that $state runes are compiled properly

import { analyzeMultipleFiles, optimizeFromTransactions, getLatestMonth, invalidateAnalyzerCaches } from './analyzer.js';
import type { CategorizedTx } from './analyzer.js';
import { loadCategories } from './cards.js';
import { buildCategoryLabelMap } from './category-labels.js';

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
  parseErrors: { line?: number; message: string; raw?: string }[];
  transactions?: CategorizedTx[];
  optimization: OptimizationResult;
  monthlyBreakdown?: { month: string; spending: number; transactionCount: number }[];
}

export interface AnalyzeOptions {
  bank?: string;
  previousMonthSpending?: number;
  cardIds?: string[];
}

// --- SessionStorage persistence ---

const STORAGE_KEY = 'cherrypicker:analysis';

type PersistedAnalysisResult = Pick<
  AnalysisResult,
  'success' | 'bank' | 'format' | 'statementPeriod' | 'transactionCount' | 'fullStatementPeriod' | 'totalTransactionCount' | 'optimization' | 'monthlyBreakdown' | 'transactions'
> & {
  /** When transactions are omitted due to size limits, records how many
   *  were lost so the warning can inform the user (C22-03). */
  _truncatedTxCount?: number;
};

/** Maximum serialized payload size to persist in sessionStorage (4MB, leaving
 *  1MB headroom for other keys within the typical 5MB per-origin limit). */
const MAX_PERSIST_SIZE = 4 * 1024 * 1024;

/** Set when sessionStorage persistence partially or fully failed.
 *  - 'truncated': transactions omitted due to size limit
 *  - 'corrupted': save failed entirely (quota exceeded) or loaded data failed validation
 *  Read by the store to inform the user that their data may not survive a tab close. */
type PersistWarningKind = 'truncated' | 'corrupted' | null;

/** Result of persisting analysis data to sessionStorage.
 *  - kind: 'truncated' (transactions omitted), 'corrupted' (save failed), or null (success)
 *  - truncatedTxCount: when kind is 'truncated', how many transactions were lost (C22-03) */
interface PersistResult {
  kind: PersistWarningKind;
  truncatedTxCount: number | null;
}

function persistToStorage(data: AnalysisResult): PersistResult {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const persisted: PersistedAnalysisResult = {
        success: data.success,
        bank: data.bank,
        format: data.format,
        statementPeriod: data.statementPeriod,
        transactionCount: data.transactionCount,
        fullStatementPeriod: data.fullStatementPeriod,
        totalTransactionCount: data.totalTransactionCount,
        optimization: data.optimization,
        monthlyBreakdown: data.monthlyBreakdown,
        transactions: data.transactions,
      };
      const serialized = JSON.stringify(persisted);
      if (serialized.length > MAX_PERSIST_SIZE) {
        // Transactions are the largest field — omit them if over budget.
        // Record how many were lost so the warning can inform the user (C22-03).
        const txCount = data.transactions?.length ?? 0;
        const withoutTxs: PersistedAnalysisResult = { ...persisted, transactions: undefined, _truncatedTxCount: txCount };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(withoutTxs));
        return { kind: 'truncated', truncatedTxCount: txCount }; // Data was truncated — transactions not saved
      } else {
        sessionStorage.setItem(STORAGE_KEY, serialized);
        return { kind: null, truncatedTxCount: null }; // Full save succeeded
      }
    }
  } catch {
    return { kind: 'corrupted', truncatedTxCount: null }; // quota exceeded or SSR — save failed entirely
  }
  return { kind: null, truncatedTxCount: null };
}

/** Validate that a transaction is suitable for spending optimization.
 *  Zero-amount entries (e.g., balance inquiries, declined transactions)
 *  are excluded because they don't contribute to optimization — they are
 *  not "invalid" per se, just not optimizable. Renamed from isOptimizableTx
 *  to clarify the filtering intent (C19-07). */
function isOptimizableTx(tx: unknown): tx is CategorizedTx {
  if (!tx || typeof tx !== 'object') return false;
  const obj = tx as Record<string, unknown>;
  return (
    typeof obj.id === 'string' && obj.id.length > 0 &&
    typeof obj.date === 'string' && obj.date.length > 0 &&
    typeof obj.merchant === 'string' &&
    typeof obj.amount === 'number' &&
    Number.isFinite(obj.amount) &&
    obj.amount !== 0 &&
    typeof obj.category === 'string' && obj.category.length > 0
  );
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
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.optimization &&
        Array.isArray(parsed.optimization.assignments) &&
        typeof parsed.optimization.totalReward === 'number' &&
        typeof parsed.optimization.totalSpending === 'number' &&
        typeof parsed.optimization.effectiveRate === 'number'
      ) {
        // Shallow validation of cardResults entries — each must have the
        // essential fields that dashboard components access during rendering.
        // If any entry fails validation, strip the entire cardResults array
        // to prevent TypeError crashes in CategoryBreakdown / OptimalCardMap.
        if (Array.isArray(parsed.optimization.cardResults)) {
          const validCardResults = parsed.optimization.cardResults.filter(
            (cr: any) =>
              cr &&
              typeof cr === 'object' &&
              typeof cr.cardId === 'string' &&
              typeof cr.totalReward === 'number' &&
              Array.isArray(cr.byCategory)
          );
          parsed.optimization.cardResults = validCardResults;
        }
        // Restore transactions with validation — each entry must have
        // the essential fields; invalid entries are silently dropped.
        let transactions: CategorizedTx[] | undefined;
        if (Array.isArray(parsed.transactions)) {
          const validTxs = parsed.transactions.filter(isOptimizableTx);
          transactions = validTxs.length > 0 ? validTxs : undefined;
          // If the transactions array existed but all entries failed validation,
          // that's data corruption rather than truncation
          if (validTxs.length === 0 && parsed.transactions.length > 0) {
            _loadPersistWarningKind = 'corrupted';
          }
        } else if (!Array.isArray(parsed.transactions) && typeof parsed._truncatedTxCount === 'number') {
          // Transactions were omitted during save due to size limits.
          // Record how many were lost so the warning can inform the user (C22-03).
          _loadPersistWarningKind = 'truncated';
          _loadTruncatedTxCount = parsed._truncatedTxCount;
        }

        return {
          success: Boolean(parsed.success),
          bank: typeof parsed.bank === 'string' || parsed.bank === null ? parsed.bank : null,
          format: typeof parsed.format === 'string' ? parsed.format : 'unknown',
          statementPeriod: parsed.statementPeriod,
          transactionCount: typeof parsed.transactionCount === 'number' ? parsed.transactionCount : 0,
          fullStatementPeriod: parsed.fullStatementPeriod,
          totalTransactionCount: typeof parsed.totalTransactionCount === 'number' ? parsed.totalTransactionCount : undefined,
          parseErrors: [],
          transactions,
          optimization: parsed.optimization,
          monthlyBreakdown: Array.isArray(parsed.monthlyBreakdown)
            ? parsed.monthlyBreakdown.map((item: any) => ({
                month: typeof item?.month === 'string' ? item.month : '',
                spending: typeof item?.spending === 'number' ? item.spending : 0,
                transactionCount: typeof item?.transactionCount === 'number' ? item.transactionCount : 0,
              }))
            : undefined,
        } as AnalysisResult;
      }
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY); } catch (err) {
      // Best-effort cleanup: corrupted data removal.
      // SecurityError in sandboxed iframes is expected and safe to ignore.
      // Log when sessionStorage is available but the remove failed for another
      // reason, matching the pattern in clearStorage() (C24-02/C27-01/C30-03).
      if (typeof sessionStorage !== 'undefined') {
        console.warn('[cherrypicker] Failed to remove corrupted data from sessionStorage:', err);
      }
    }
  }
  return null;
}

function clearStorage(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    // SSR environments don't have sessionStorage — that's expected.
    // Non-SSR failures (e.g., SecurityError in sandboxed iframes) are
    // worth logging for diagnostics (C24-02).
    if (typeof sessionStorage !== 'undefined') {
      console.warn('[cherrypicker] Failed to clear sessionStorage:', err);
    }
  }
}

// --- Store ---

function createAnalysisStore() {
  let result = $state<AnalysisResult | null>(loadFromStorage());
  let loading = $state(false);
  let error = $state<string | null>(null);
  let generation = $state(0);
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
    cachedCategoryLabels = buildCategoryLabelMap(nodes);
    return cachedCategoryLabels;
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

    setResult(r: AnalysisResult): void {
      result = r;
      generation++;
      error = null;
      const persistResult = persistToStorage(r);
      persistWarningKind = persistResult.kind;
      truncatedTxCount = persistResult.truncatedTxCount;
    },

    async analyze(files: File | File[], options?: AnalyzeOptions): Promise<void> {
      loading = true;
      error = null;

      try {
        const fileArray = Array.isArray(files) ? files : [files];
        const analysisResult = await analyzeMultipleFiles(fileArray, options);
        result = analysisResult;
        generation++;
        const persistResult = persistToStorage(analysisResult);
        persistWarningKind = persistResult.kind;
        truncatedTxCount = persistResult.truncatedTxCount;
      } catch (e) {
        error = e instanceof Error ? e.message : '분석 중 문제가 생겼어요';
        result = null;
      } finally {
        loading = false;
      }
    },

    async reoptimize(editedTransactions: CategorizedTx[], options?: AnalyzeOptions): Promise<void> {
      loading = true;
      error = null;
      try {
        const categoryLabels = await getCategoryLabels();
        // Filter to the latest month to match the initial optimization behavior.
        // analyzeMultipleFiles only optimizes the latest month; reoptimize must
        // do the same to avoid cap distortion from non-latest-month transactions.
        const latestMonth = getLatestMonth(editedTransactions);
        const latestTransactions = latestMonth
          ? editedTransactions.filter(tx => tx.date.startsWith(latestMonth))
          : editedTransactions;

        // Recalculate monthlyBreakdown from the edited transactions FIRST so
        // that previousMonthSpending reflects the user's edits (not stale data
        // from the initial analysis). Without this, editing a previous month's
        // transaction wouldn't affect the previousMonthSpending used for the
        // optimizer's performance tier calculation.
        const monthlySpending = new Map<string, number>();
        const monthlyTxCount = new Map<string, number>();
        for (const tx of editedTransactions) {
          // Guard against malformed dates shorter than 7 chars (YYYY-MM) —
          // matches the guard in analyzer.ts getLatestMonth().
          if (!tx.date || tx.date.length < 7) continue;
          const month = tx.date.slice(0, 7);
          monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + Math.abs(tx.amount));
          monthlyTxCount.set(month, (monthlyTxCount.get(month) ?? 0) + 1);
        }
        const updatedMonthlyBreakdown = [...monthlySpending.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, spending]) => ({
            month,
            spending,
            transactionCount: monthlyTxCount.get(month) ?? 0,
          }));

        // Compute previousMonthSpending from the FRESH monthly breakdown
        // (derived from editedTransactions), not from the stale result.monthlyBreakdown.
        let previousMonthSpending: number | undefined;
        if (latestMonth) {
          const months = updatedMonthlyBreakdown.map(m => m.month).sort();
          const latestIdx = months.indexOf(latestMonth);
          if (latestIdx > 0) {
            const prevMonth = months[latestIdx - 1];
            const prevData = updatedMonthlyBreakdown.find(m => m.month === prevMonth);
            previousMonthSpending = prevData?.spending;
          }
        }

        const optimization = await optimizeFromTransactions(latestTransactions, {
          ...options,
          previousMonthSpending,
        }, categoryLabels);
        if (result) {
          // Keep all months in the transactions field for display/editing,
          // but the optimization only covers the latest month.
          result = {
            ...result,
            transactions: editedTransactions,
            optimization,
            monthlyBreakdown: updatedMonthlyBreakdown,
          };
          generation++;
          const persistResult = persistToStorage(result);
          persistWarningKind = persistResult.kind;
          truncatedTxCount = persistResult.truncatedTxCount;
        } else {
          // Store was reset while reoptimizing — cannot apply edits.
          // Clear stale sessionStorage data to prevent confusion on refresh.
          clearStorage();
          error = '분석 결과가 없어요. 다시 분석해 보세요.';
        }
      } catch (e) {
        error = e instanceof Error ? e.message : '재계산 중 문제가 생겼어요';
      } finally {
        loading = false;
      }
    },

    reset(): void {
      result = null;
      error = null;
      loading = false;
      persistWarningKind = null;
      truncatedTxCount = null;
      _loadPersistWarningKind = null;
      _loadTruncatedTxCount = null;
      cachedCategoryLabels = undefined;
      invalidateAnalyzerCaches();
      clearStorage();
    },
  };
}

export const analysisStore = createAnalysisStore();
