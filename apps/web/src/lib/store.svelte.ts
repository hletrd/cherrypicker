// Shared Svelte 5 state store for analysis results across dashboard components
// Must be .svelte.ts so that $state runes are compiled properly

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
  optimization: OptimizationResult;
}

export interface AnalyzeOptions {
  bank?: string;
  previousMonthSpending?: number;
  cardIds?: string[];
}

// --- Store ---

function createAnalysisStore() {
  let result = $state<AnalysisResult | null>(null);
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

    setResult(r: AnalysisResult): void {
      result = r;
      error = null;
    },

    async analyze(filePath: string, options?: AnalyzeOptions): Promise<void> {
      loading = true;
      error = null;

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath, ...options }),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? '분석 실패');
        }

        result = (await res.json()) as AnalysisResult;
      } catch (e) {
        error = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다';
        result = null;
      } finally {
        loading = false;
      }
    },

    reset(): void {
      result = null;
      error = null;
      loading = false;
    },
  };
}

export const analysisStore = createAnalysisStore();
