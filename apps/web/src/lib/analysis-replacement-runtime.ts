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

const CLEAR_PERSISTED_ANALYSIS_ERROR =
  '저장된 이전 분석 결과를 삭제하지 못했어요. 페이지를 새로고침하고 다시 시도해 보세요.';

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
 * State transitions:
 * - A stale or aborted replacement B is rejected before it acquires the store
 *   epoch, so committed A and any current owned operation are untouched.
 * - A clear failure preserves A in memory and storage, preserves its
 *   generation, and exposes a storage error without loading or persisting B.
 * - After a successful clear, A is removed from memory and storage and its
 *   generation advances. Successful B then commits, advances the generation,
 *   and persists; failed or aborted B leaves the already-cleared state empty.
 * - Canceling while idle preserves committed A. Store reset, which is owned by
 *   the caller, invalidates active work and clears result/persistence state.
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
    // Acquiring a new store epoch aborts the current owned operation, so caller
    // ownership must be established before begin() has any side effects.
    if (execution.run.signal.aborted || !execution.run.isCurrent()) return;

    const operation = this.#operationEpoch.begin();
    const owned = composeOwnedRun(operation, execution.run);
    const ownedExecution: AnalyzeExecution = {
      run: owned.run,
      onProgress: execution.onProgress,
    };
    const commitState = <Key extends keyof AnalysisReplacementState>(
      key: Key,
      value: AnalysisReplacementState[Key],
    ): boolean => owned.run.commit(() => {
      this.#state[key] = value;
    });

    try {
      if (!commitState('loading', true)) return;
      if (!commitState('error', null)) return;

      // Deleting persisted A is a precondition for replacing committed state.
      // Clearing even when state.result is null also repairs legacy
      // split-brain states left by an earlier failed replacement.
      const hadResult = this.#state.result !== null;
      if (!owned.run.isCurrent()) return;
      const clearResult = this.#dependencies.clearPersistedAnalysis();
      if (!owned.run.isCurrent()) return;

      if (clearResult.kind === 'error') {
        if (!commitState('error', CLEAR_PERSISTED_ANALYSIS_ERROR)) return;
        if (!commitState('persistWarningKind', 'error')) return;
        commitState('truncatedTxCount', null);
        return;
      }

      if (!commitState('result', null)) return;
      if (
        hadResult &&
        !commitState('generation', this.#state.generation + 1)
      ) return;
      if (!commitState('persistWarningKind', clearResult.kind)) return;
      if (!commitState('truncatedTxCount', clearResult.truncatedTxCount)) return;

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
      if (!commitState('result', analysisResult)) return;
      if (!commitState('generation', this.#state.generation + 1)) return;

      if (!owned.run.isCurrent()) return;
      const persistResult = this.#dependencies.persist(analysisResult);
      if (!owned.run.isCurrent()) return;
      if (!commitState('persistWarningKind', persistResult.kind)) return;
      commitState('truncatedTxCount', persistResult.truncatedTxCount);
    } catch (error) {
      if (
        !owned.run.isCurrent() ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return;
      }
      if (!commitState(
        'error',
        error instanceof Error ? error.message : '분석 중 문제가 생겼어요',
      )) return;
      commitState('result', null);
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
