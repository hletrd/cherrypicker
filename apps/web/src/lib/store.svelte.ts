// Shared Svelte 5 state store for analysis results across dashboard components
// Must be .svelte.ts so that $state runes are compiled properly

import { analyzeMultipleFiles, optimizeFromTransactions } from './analyzer.js';
import type { CategorizedTx } from './analyzer.js';

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
>;

/** Maximum serialized payload size to persist in sessionStorage (4MB, leaving
 *  1MB headroom for other keys within the typical 5MB per-origin limit). */
const MAX_PERSIST_SIZE = 4 * 1024 * 1024;

/** Set when sessionStorage persistence partially or fully failed.
 *  - 'truncated': transactions omitted due to size limit
 *  - 'corrupted': save failed entirely (quota exceeded) or loaded data failed validation
 *  Read by the store to inform the user that their data may not survive a tab close. */
type PersistWarningKind = 'truncated' | 'corrupted' | null;
let _persistWarningKind: PersistWarningKind = null;

function persistToStorage(data: AnalysisResult): void {
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
        // Transactions are the largest field — omit them if over budget
        const withoutTxs: PersistedAnalysisResult = { ...persisted, transactions: undefined };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(withoutTxs));
        _persistWarningKind = 'truncated'; // Data was truncated — transactions not saved
      } else {
        sessionStorage.setItem(STORAGE_KEY, serialized);
        _persistWarningKind = null; // Full save succeeded
      }
    }
  } catch {
    _persistWarningKind = 'corrupted'; // quota exceeded or SSR — save failed entirely
  }
}

function isValidTx(tx: any): tx is CategorizedTx {
  return (
    tx &&
    typeof tx === 'object' &&
    typeof tx.id === 'string' &&
    typeof tx.date === 'string' &&
    typeof tx.merchant === 'string' &&
    typeof tx.amount === 'number' &&
    typeof tx.category === 'string'
  );
}

/** Track the persist warning kind detected during loadFromStorage.
 *  - 'truncated': transactions key was absent (omitted during save due to size)
 *  - 'corrupted': transactions key existed but all entries failed validation
 */
let _loadPersistWarningKind: PersistWarningKind = null;

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
        // Restore transactions with validation — each entry must have
        // the essential fields; invalid entries are silently dropped.
        let transactions: CategorizedTx[] | undefined;
        if (Array.isArray(parsed.transactions)) {
          const validTxs = parsed.transactions.filter(isValidTx);
          transactions = validTxs.length > 0 ? validTxs : undefined;
          // If the transactions array existed but all entries failed validation,
          // that's data corruption rather than truncation
          if (validTxs.length === 0 && parsed.transactions.length > 0) {
            _loadPersistWarningKind = 'corrupted';
          }
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
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }
  return null;
}

function clearStorage(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* SSR */ }
}

// --- Store ---

function createAnalysisStore() {
  let result = $state<AnalysisResult | null>(loadFromStorage());
  let loading = $state(false);
  let error = $state<string | null>(null);
  let generation = $state(0);
  // Set when sessionStorage persistence was partial (transactions truncated)
  // or failed entirely (quota exceeded). Reset on successful full save.
  let persistWarningKind = $state<PersistWarningKind>(
    result !== null && result.transactions === undefined
      ? (_loadPersistWarningKind ?? 'truncated')
      : null
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
      persistToStorage(r);
      persistWarningKind = _persistWarningKind;
    },

    async analyze(files: File | File[], options?: AnalyzeOptions): Promise<void> {
      loading = true;
      error = null;

      try {
        const fileArray = Array.isArray(files) ? files : [files];
        const analysisResult = await analyzeMultipleFiles(fileArray, options);
        result = analysisResult;
        generation++;
        persistToStorage(analysisResult);
        persistWarningKind = _persistWarningKind;
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
        const optimization = await optimizeFromTransactions(editedTransactions, options);
        if (result) {
          result = { ...result, transactions: editedTransactions, optimization };
          generation++;
          persistToStorage(result);
          persistWarningKind = _persistWarningKind;
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
      _persistWarningKind = null;
      clearStorage();
    },
  };
}

export const analysisStore = createAnalysisStore();
