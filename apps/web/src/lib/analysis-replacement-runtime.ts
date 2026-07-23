import type {
  AnalysisResult,
  AnalyzeExecution,
  AnalyzeOptions,
} from './store.svelte.js';
import type {
  PersistResult,
  PersistWarningKind,
} from './persistence.js';
import type { FileParseRun } from './file-parse-queue.js';
import {
  OperationEpoch,
  type OperationToken,
} from './operation-epoch.js';

export interface AnalysisReplacementState {
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  generation: number;
  persistWarningKind: PersistWarningKind;
  truncatedTxCount: number | null;
}

interface AnalyzerModuleLike {
  analyzeMultipleFiles(
    files: File[],
    options?: AnalyzeOptions,
    execution?: AnalyzeExecution,
  ): Promise<AnalysisResult>;
}

export interface AnalysisReplacementDependencies {
  loadAnalyzerModule(): Promise<AnalyzerModuleLike>;
  persist(data: AnalysisResult): PersistResult;
  clearPersistedAnalysis(): PersistResult;
}

function composeOwnedRun(
  operation: OperationToken,
  callerRun: FileParseRun,
): { run: FileParseRun; dispose(): void } {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const sourceSignals = [operation.signal, callerRun.signal];

  for (const signal of sourceSignals) {
    if (signal.aborted) {
      abort();
      break;
    }
    signal.addEventListener('abort', abort, { once: true });
  }

  const isCurrent = () =>
    !controller.signal.aborted &&
    operation.isCurrent() &&
    callerRun.isCurrent();
  const run: FileParseRun = Object.freeze({
    generation: callerRun.generation,
    signal: controller.signal,
    isCurrent,
    commit(effect: () => void): boolean {
      if (!isCurrent()) return false;
      effect();
      return true;
    },
  });

  return {
    run,
    dispose(): void {
      for (const signal of sourceSignals) {
        signal.removeEventListener('abort', abort);
      }
    },
  };
}

/**
 * Owns replacement-analysis state transitions without depending on Svelte.
 *
 * Policy:
 * - Starting an analysis synchronously removes the previous persisted record
 *   and clears its in-memory result before the first await.
 * - A non-abort failure leaves both locations empty and exposes the error.
 * - Canceling an active replacement leaves that already-empty state intact and
 *   suppresses an error. Canceling while idle preserves the committed result.
 */
export class AnalysisReplacementRuntime {
  readonly #state: AnalysisReplacementState;
  readonly #dependencies: AnalysisReplacementDependencies;
  readonly #operationEpoch: OperationEpoch;

  constructor(
    state: AnalysisReplacementState,
    dependencies: AnalysisReplacementDependencies,
    operationEpoch = new OperationEpoch(),
  ) {
    this.#state = state;
    this.#dependencies = dependencies;
    this.#operationEpoch = operationEpoch;
  }

  async analyze(
    files: File | File[],
    options: AnalyzeOptions | undefined,
    execution: AnalyzeExecution,
  ): Promise<void> {
    const operation = this.#operationEpoch.begin();
    const owned = composeOwnedRun(operation, execution.run);
    const ownedExecution: AnalyzeExecution = {
      run: owned.run,
      onProgress: execution.onProgress,
    };

    this.#state.loading = true;
    this.#state.error = null;

    // Storage and memory are replaced as one synchronous transition. Clearing
    // storage even when state.result is null also repairs legacy split-brain
    // states left by an earlier failed replacement.
    const hadResult = this.#state.result !== null;
    const clearResult = this.#dependencies.clearPersistedAnalysis();
    this.#state.result = null;
    if (hadResult) this.#state.generation++;
    this.#state.persistWarningKind = clearResult.kind;
    this.#state.truncatedTxCount = clearResult.truncatedTxCount;

    try {
      const fileArray = Array.isArray(files) ? files : [files];
      const { analyzeMultipleFiles } =
        await this.#dependencies.loadAnalyzerModule();
      if (!owned.run.isCurrent()) return;

      const analysisResult = await analyzeMultipleFiles(
        fileArray,
        options,
        ownedExecution,
      );
      if (!owned.run.isCurrent()) return;

      if (
        options?.previousMonthSpending !== undefined &&
        Number.isFinite(options.previousMonthSpending) &&
        options.previousMonthSpending >= 0
      ) {
        analysisResult.previousMonthSpendingOption =
          options.previousMonthSpending;
      }
      if (options?.cardIds && options.cardIds.length > 0) {
        analysisResult.cardIdsOption = [...options.cardIds];
      }

      // Check ownership immediately before each externally visible commit.
      if (!owned.run.isCurrent()) return;
      this.#state.result = analysisResult;
      this.#state.generation++;

      if (!owned.run.isCurrent()) return;
      const persistResult = this.#dependencies.persist(analysisResult);
      this.#state.persistWarningKind = persistResult.kind;
      this.#state.truncatedTxCount = persistResult.truncatedTxCount;
    } catch (error) {
      if (
        !owned.run.isCurrent() ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return;
      }
      this.#state.error =
        error instanceof Error ? error.message : '분석 중 문제가 생겼어요';
      this.#state.result = null;
    } finally {
      owned.dispose();
      if (operation.isCurrent()) {
        this.#state.loading = false;
      }
    }
  }

  cancel(): void {
    this.#operationEpoch.invalidate();
    this.#state.loading = false;
    this.#state.error = null;
  }
}
