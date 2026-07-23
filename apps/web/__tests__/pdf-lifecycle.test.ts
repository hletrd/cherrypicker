import { describe, expect, test } from 'bun:test';
import {
  extractPDFTextFromLoadingTask,
  type PDFDocumentLike,
} from '../src/lib/parser/pdf-lifecycle.js';
import {
  LatestFileParseRun,
  runFileParseQueue,
} from '../src/lib/file-parse-queue.js';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('browser PDF lifecycle', () => {
  test('cleans and destroys document and loading task exactly once', async () => {
    let cleaned = 0;
    let documentDestroyed = 0;
    let taskDestroyed = 0;
    const document: PDFDocumentLike = {
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({
          items: [{ str: '거래', transform: [1, 0, 0, 1, 0, 10] }],
        }),
      }),
      cleanup: () => {
        cleaned++;
      },
      destroy: () => {
        documentDestroyed++;
      },
    };

    const text = await extractPDFTextFromLoadingTask({
      promise: Promise.resolve(document),
      destroy: () => {
        taskDestroyed++;
      },
    });
    expect(text).toContain('거래');
    expect({ cleaned, documentDestroyed, taskDestroyed }).toEqual({
      cleaned: 1,
      documentDestroyed: 1,
      taskDestroyed: 1,
    });
  });

  test('rejects promptly and destroys an active loading task on abort', async () => {
    const pending = deferred<PDFDocumentLike>();
    let taskDestroyed = 0;
    const controller = new AbortController();
    const extraction = extractPDFTextFromLoadingTask(
      {
        promise: pending.promise,
        destroy: () => {
          taskDestroyed++;
        },
      },
      controller.signal,
    );
    controller.abort();

    const error = await extraction.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(taskDestroyed).toBe(1);
  });

  test('awaits task destruction and still destroys the document when cleanup fails', async () => {
    let releaseDestroy!: () => void;
    const destroyReleased = new Promise<void>((resolve) => {
      releaseDestroy = resolve;
    });
    let documentDestroyed = 0;
    let taskDestroyed = 0;
    let settled = false;
    const extraction = extractPDFTextFromLoadingTask({
      promise: Promise.resolve({
        numPages: 0,
        getPage: async () => {
          throw new Error('unreachable');
        },
        cleanup: () => {
          throw new Error('cleanup failed');
        },
        destroy: () => {
          documentDestroyed++;
        },
      }),
      destroy: async () => {
        taskDestroyed++;
        await destroyReleased;
      },
    }).then((value) => {
      settled = true;
      return value;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    releaseDestroy();
    expect(await extraction).toBe('');
    expect({ documentDestroyed, taskDestroyed }).toEqual({
      documentDestroyed: 1,
      taskDestroyed: 1,
    });
  });

  test('cancels two active PDF workers, disposes both, and never dequeues a third', async () => {
    const active = deferred<void>();
    const pendingText = deferred<{ items: unknown[] }>();
    const started: number[] = [];
    const cleaned = [0, 0, 0];
    const documentDestroyed = [0, 0, 0];
    const taskDestroyed = [0, 0, 0];
    let extracting = 0;
    const tasks = [0, 1, 2].map((index) => ({
      promise: Promise.resolve<PDFDocumentLike>({
        numPages: 1,
        getPage: async () => ({
          getTextContent: () => {
            extracting++;
            if (extracting === 2) active.resolve();
            return pendingText.promise;
          },
        }),
        cleanup: () => {
          cleaned[index]!++;
        },
        destroy: () => {
          documentDestroyed[index]!++;
        },
      }),
      destroy: () => {
        taskDestroyed[index]!++;
      },
    }));
    const controller = new LatestFileParseRun();
    const run = controller.begin();
    const resultPromise = runFileParseQueue(
      tasks,
      async (task, index, signal) => {
        started.push(index);
        return extractPDFTextFromLoadingTask(task, signal);
      },
      { run, yieldControl: async () => {} },
    );

    await active.promise;
    controller.cancel();
    const result = await resultPromise;

    expect(started).toEqual([0, 1]);
    expect(result.outcomes.slice(0, 2)).toEqual([
      {
        status: 'rejected',
        reason: expect.objectContaining({ name: 'AbortError' }),
      },
      {
        status: 'rejected',
        reason: expect.objectContaining({ name: 'AbortError' }),
      },
    ]);
    expect(result.outcomes[2]).toEqual({ status: 'cancelled' });
    expect(cleaned).toEqual([1, 1, 0]);
    expect(documentDestroyed).toEqual([1, 1, 0]);
    expect(taskDestroyed).toEqual([1, 1, 0]);
  });
});
