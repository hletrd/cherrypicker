import type { AnalysisResult } from './analysis-result.js';
import type {
  PersistResult,
  PersistWarningKind,
} from './persistence.js';

export const CLEAR_ANALYSIS_RESET_ERROR =
  '저장된 분석 결과를 삭제하지 못했어요. 현재 결과는 그대로 두었어요. 페이지를 새로고침하고 다시 시도해 주세요.';

export interface AnalysisResetState {
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  persistWarningKind: PersistWarningKind;
  truncatedTxCount: number | null;
}

export interface AnalysisResetDependencies {
  clearPersistedAnalysis(): PersistResult;
  invalidateOperations(): void;
  clearCachedData(): void;
  clearDismissedWarning(): void;
}

function failedClear(state: AnalysisResetState): false {
  state.error = CLEAR_ANALYSIS_RESET_ERROR;
  state.persistWarningKind = 'error';
  state.truncatedTxCount = null;
  return false;
}

/**
 * Clear durable analysis data before presenting an empty in-memory state.
 *
 * The dismissal flag is deliberately best effort: unlike the analysis
 * payload, retaining that flag cannot resurrect financial data.
 */
export function resetAnalysisState(
  state: AnalysisResetState,
  dependencies: AnalysisResetDependencies,
): boolean {
  let clearResult: PersistResult;
  try {
    clearResult = dependencies.clearPersistedAnalysis();
  } catch {
    return failedClear(state);
  }
  if (clearResult.kind !== null) {
    return failedClear(state);
  }

  dependencies.invalidateOperations();
  state.result = null;
  state.error = null;
  state.loading = false;
  state.persistWarningKind = null;
  state.truncatedTxCount = null;
  dependencies.clearCachedData();

  try {
    dependencies.clearDismissedWarning();
  } catch {
    // The noncritical preference flag must not make a durable data clear fail.
  }
  return true;
}
