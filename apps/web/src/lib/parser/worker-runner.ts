import type { ParseResult } from './types.js';
import {
  deserializeParserWorkerError,
  deserializeParserWorkerResult,
  type ParserWorkerFormat,
  type ParserWorkerRequest,
  type ParserWorkerResponse,
} from './worker-protocol.js';

type WorkerMessageListener = (
  event: MessageEvent<ParserWorkerResponse>,
) => void;
type WorkerErrorListener = (event: ErrorEvent) => void;
type WorkerMessageErrorListener = (event: MessageEvent<unknown>) => void;

export interface ParserWorkerLike {
  postMessage(message: ParserWorkerRequest, transfer?: Transferable[]): void;
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

export type ParserWorkerFactory = (
  format: ParserWorkerFormat,
) => ParserWorkerLike;

function createParserWorker(format: ParserWorkerFormat): ParserWorkerLike {
  switch (format) {
    case 'csv':
      return new Worker(
        new URL('./workers/csv-worker.ts', import.meta.url),
        { type: 'module', name: 'cherrypicker-csv-parser' },
      ) as ParserWorkerLike;
    case 'xlsx':
      return new Worker(
        new URL('./workers/xlsx-worker.ts', import.meta.url),
        { type: 'module', name: 'cherrypicker-xlsx-parser' },
      ) as ParserWorkerLike;
    case 'json':
      return new Worker(
        new URL('./workers/json-worker.ts', import.meta.url),
        { type: 'module', name: 'cherrypicker-json-parser' },
      ) as ParserWorkerLike;
    case 'ofx':
      return new Worker(
        new URL('./workers/ofx-worker.ts', import.meta.url),
        { type: 'module', name: 'cherrypicker-ofx-parser' },
      ) as ParserWorkerLike;
    case 'html':
      return new Worker(
        new URL('./workers/html-worker.ts', import.meta.url),
        { type: 'module', name: 'cherrypicker-html-parser' },
      ) as ParserWorkerLike;
  }
}

function abortError(): DOMException {
  return new DOMException('분석이 취소되었어요.', 'AbortError');
}

export function browserParserWorkersAvailable(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

export function parseWithWorker(
  request: ParserWorkerRequest,
  signal?: AbortSignal,
  createWorker: ParserWorkerFactory = createParserWorker,
): Promise<ParseResult> {
  if (signal?.aborted) return Promise.reject(abortError());
  const worker = createWorker(request.format);

  return new Promise<ParseResult>((resolve, reject) => {
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
    const succeed = (result: ParseResult) => {
      if (settle()) resolve(result);
    };
    const fail = (error: Error | DOMException) => {
      if (settle()) reject(error);
    };
    const onAbort = () => fail(abortError());
    const onMessage: WorkerMessageListener = (event) => {
      try {
        if (event.data.ok) {
          succeed(deserializeParserWorkerResult(event.data.result));
        } else {
          fail(deserializeParserWorkerError(event.data));
        }
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const onError: WorkerErrorListener = (event) => {
      fail(new Error(event.message || '파서 작업자가 실패했어요.'));
    };
    const onMessageError: WorkerMessageErrorListener = () => {
      fail(new Error('파서 작업자 응답을 읽을 수 없어요.'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onMessageError);
    try {
      worker.postMessage(request, [request.payload]);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
