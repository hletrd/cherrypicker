import { greedyOptimize } from '@cherrypicker/core/optimizer';
import type {
  CardRuleSet,
  OptimizationConstraints,
  OptimizationResult,
} from '@cherrypicker/core';
import type {
  OptimizerWorkerRequest,
} from './worker-protocol.js';
import { decodeOptimizerWorkerResponse } from './worker-protocol.js';

type WorkerMessageListener = (
  event: MessageEvent<unknown>,
) => void;
type WorkerErrorListener = (event: ErrorEvent) => void;
type WorkerMessageErrorListener = (event: MessageEvent<unknown>) => void;

export interface OptimizerWorkerLike {
  postMessage(message: OptimizerWorkerRequest): void;
  addEventListener(type: 'message', listener: WorkerMessageListener): void;
  addEventListener(type: 'error', listener: WorkerErrorListener): void;
  addEventListener(
    type: 'messageerror',
    listener: WorkerMessageErrorListener,
  ): void;
  removeEventListener(type: 'message', listener: WorkerMessageListener): void;
  removeEventListener(type: 'error', listener: WorkerErrorListener): void;
  removeEventListener(
    type: 'messageerror',
    listener: WorkerMessageErrorListener,
  ): void;
  terminate(): void;
}

export type OptimizerWorkerFactory = () => OptimizerWorkerLike;

function createOptimizerWorker(): OptimizerWorkerLike {
  return new Worker(
    new URL('./worker.ts', import.meta.url),
    { type: 'module', name: 'cherrypicker-optimizer' },
  ) as OptimizerWorkerLike;
}

function abortError(): DOMException {
  return new DOMException('분석이 취소되었어요.', 'AbortError');
}

export function browserOptimizerWorkerAvailable(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

/**
 * Run the complete optimizer inside an owned browser worker. Aborting the
 * caller terminates that worker, so none of its remaining card evaluations can
 * continue in the background or publish a late result.
 */
export function optimizeWithWorker(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
  signal?: AbortSignal,
  createWorker: OptimizerWorkerFactory = createOptimizerWorker,
): Promise<OptimizationResult> {
  if (signal?.aborted) return Promise.reject(abortError());
  const worker = createWorker();

  return new Promise<OptimizationResult>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onMessageError);
      worker.terminate();
    };
    const settle = (): boolean => {
      if (settled) return false;
      settled = true;
      cleanup();
      return true;
    };
    const succeed = (result: OptimizationResult) => {
      if (settle()) resolve(result);
    };
    const fail = (error: Error | DOMException) => {
      if (settle()) reject(error);
    };
    const onAbort = () => fail(abortError());
    const onMessage: WorkerMessageListener = (event) => {
      try {
        const response = decodeOptimizerWorkerResponse(event.data);
        if (response.ok) {
          succeed(response.result);
        } else {
          fail(new Error(response.message));
        }
      } catch {
        fail(new Error('최적화 작업자 응답 형식이 올바르지 않아요.'));
      }
    };
    const onError: WorkerErrorListener = (event) => {
      fail(new Error(event.message || '최적화 작업자가 실패했어요.'));
    };
    const onMessageError: WorkerMessageErrorListener = () => {
      fail(new Error('최적화 작업자 응답을 읽을 수 없어요.'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onMessageError);
    try {
      worker.postMessage({ constraints, cardRules });
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Browser calls use the terminating worker boundary. The synchronous fallback
 * exists only for SSR and non-browser unit runtimes where Worker is absent.
 */
export async function runCancellableOptimizer(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
  signal?: AbortSignal,
): Promise<OptimizationResult> {
  if (signal?.aborted) throw abortError();
  if (browserOptimizerWorkerAvailable()) {
    return optimizeWithWorker(constraints, cardRules, signal);
  }

  await Promise.resolve();
  if (signal?.aborted) throw abortError();
  return greedyOptimize(constraints, cardRules);
}
