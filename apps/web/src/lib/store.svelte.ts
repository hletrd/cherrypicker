// Shared Svelte 5 state store for analysis results across dashboard components
// Must be .svelte.ts so that $state runes are compiled properly

import { analyzeFile, optimizeFromTransactions } from './analyzer.js';
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
  statementPeriod?: { start: string; end: string };
  transactionCount: number;
  parseErrors: { line?: number; message: string; raw?: string }[];
  transactions?: CategorizedTx[];
  optimization: OptimizationResult;
}

export interface AnalyzeOptions {
  bank?: string;
  previousMonthSpending?: number;
  cardIds?: string[];
}

// --- SessionStorage persistence ---

const STORAGE_KEY = 'cherrypicker:analysis';

function persistToStorage(data: AnalysisResult): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch { /* quota exceeded or SSR */ }
}

function loadFromStorage(): AnalysisResult | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.optimization && Array.isArray(parsed.optimization.assignments)) {
        return parsed as AnalysisResult;
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
    get transactions(): CategorizedTx[] {
      return result?.transactions ?? [];
    },

    setResult(r: AnalysisResult): void {
      result = r;
      error = null;
      persistToStorage(r);
    },

    async analyze(file: File, options?: AnalyzeOptions): Promise<void> {
      loading = true;
      error = null;

      try {
        const analysisResult = await analyzeFile(file, options);
        result = analysisResult;
        persistToStorage(analysisResult);
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
          persistToStorage(result);
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
      clearStorage();
    },
  };
}

export const analysisStore = createAnalysisStore();
