import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FILE_PARSE_CONCURRENCY,
  LatestFileParseRun,
  runFileParseQueue,
} from '../src/lib/file-parse-queue.js';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Timed out waiting for queue state');
}

describe('file parse queue', () => {
  test('uses the named two-file cap and preserves input outcome order', async () => {
    expect(FILE_PARSE_CONCURRENCY).toBe(2);

    const delays = [20, 2, 12, 1, 5];
    let active = 0;
    let maximumActive = 0;
    const completedInRuntimeOrder: number[] = [];
    const progress: number[] = [];
    const released: number[] = [];
    let yields = 0;
    const run = new LatestFileParseRun().begin();

    const result = await runFileParseQueue(
      delays,
      async (delay, index) => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, delay));
        active--;
        completedInRuntimeOrder.push(index);
        return `result-${index}`;
      },
      {
        run,
        onProgress: ({ completed }) => progress.push(completed),
        release: (_item, index) => {
          released.push(index);
        },
        yieldControl: async () => {
          yields++;
          await Promise.resolve();
        },
      },
    );

    expect(maximumActive).toBe(2);
    expect(completedInRuntimeOrder).not.toEqual([0, 1, 2, 3, 4]);
    expect(result.outcomes).toEqual([
      { status: 'fulfilled', value: 'result-0' },
      { status: 'fulfilled', value: 'result-1' },
      { status: 'fulfilled', value: 'result-2' },
      { status: 'fulfilled', value: 'result-3' },
      { status: 'fulfilled', value: 'result-4' },
    ]);
    expect(progress).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(released)).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(yields).toBe(5);
    expect(result.completed).toBe(5);
    expect(result.cancelled).toBe(false);
    expect(result.stale).toBe(false);
  });

  test('records a rejection at its input index and continues later work', async () => {
    const started: number[] = [];
    const expectedError = new Error('broken statement');
    const run = new LatestFileParseRun().begin();

    const result = await runFileParseQueue(
      ['first', 'broken', 'last'],
      async (item, index) => {
        started.push(index);
        if (item === 'broken') throw expectedError;
        return item.toUpperCase();
      },
      { run, yieldControl: async () => {} },
    );

    expect(started.sort()).toEqual([0, 1, 2]);
    expect(result.outcomes).toEqual([
      { status: 'fulfilled', value: 'FIRST' },
      { status: 'rejected', reason: expectedError },
      { status: 'fulfilled', value: 'LAST' },
    ]);
  });

  test('releases and yields before a lane dequeues its next item', async () => {
    const secondWorker = deferred();
    const firstRelease = deferred();
    const firstYield = deferred();
    const started: number[] = [];
    const run = new LatestFileParseRun().begin();

    const resultPromise = runFileParseQueue(
      [0, 1, 2],
      async (_item, index) => {
        started.push(index);
        if (index === 1) await secondWorker.promise;
        return index;
      },
      {
        run,
        release: async (_item, index) => {
          if (index === 0) await firstRelease.promise;
        },
        yieldControl: async () => {
          if (started.includes(0) && !started.includes(2)) {
            await firstYield.promise;
          }
        },
      },
    );

    await until(() => started.length === 2);
    expect(started).toEqual([0, 1]);
    firstRelease.resolve();
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    firstYield.resolve();
    await until(() => started.includes(2));
    secondWorker.resolve();

    const result = await resultPromise;
    expect(result.outcomes.every(({ status }) => status === 'fulfilled')).toBe(
      true,
    );
  });

  test('cancels between items and suppresses stale progress', async () => {
    const activeWorkers = [deferred(), deferred()];
    const started: number[] = [];
    const progress: number[] = [];
    const controller = new LatestFileParseRun();
    const run = controller.begin();

    const resultPromise = runFileParseQueue(
      [0, 1, 2, 3],
      async (_item, index) => {
        started.push(index);
        await activeWorkers[index]!.promise;
        return index;
      },
      {
        run,
        onProgress: ({ completed }) => progress.push(completed),
        yieldControl: async () => {},
      },
    );

    await until(() => started.length === 2);
    controller.cancel();
    activeWorkers[0]!.resolve();
    activeWorkers[1]!.resolve();

    const result = await resultPromise;
    expect(started).toEqual([0, 1]);
    expect(result.outcomes).toEqual([
      { status: 'fulfilled', value: 0 },
      { status: 'fulfilled', value: 1 },
      { status: 'cancelled' },
      { status: 'cancelled' },
    ]);
    expect(progress).toEqual([0]);
    expect(result.completed).toBe(2);
    expect(result.cancelled).toBe(true);
    expect(result.stale).toBe(true);
  });

  test('passes cancellation to active workers', async () => {
    const started: number[] = [];
    const controller = new LatestFileParseRun();
    const run = controller.begin();
    const resultPromise = runFileParseQueue(
      [0, 1, 2],
      async (_item, index, signal) => {
        started.push(index);
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('cancelled', 'AbortError')),
            { once: true },
          );
        });
        return index;
      },
      { run, yieldControl: async () => {} },
    );

    await until(() => started.length === 2);
    controller.cancel();
    const result = await resultPromise;
    expect(started).toEqual([0, 1]);
    expect(result.outcomes.slice(0, 2)).toEqual([
      { status: 'rejected', reason: expect.objectContaining({ name: 'AbortError' }) },
      { status: 'rejected', reason: expect.objectContaining({ name: 'AbortError' }) },
    ]);
    expect(result.outcomes[2]).toEqual({ status: 'cancelled' });
    expect(result.cancelled).toBe(true);
  });

  test('allows only the latest generation to commit late results', async () => {
    const firstWorker = deferred<string>();
    const controller = new LatestFileParseRun();
    const firstRun = controller.begin();
    const applied: string[] = [];

    const firstResultPromise = runFileParseQueue(
      ['old'],
      async () => firstWorker.promise,
      { run: firstRun, yieldControl: async () => {} },
    );

    const secondRun = controller.begin();
    const secondResult = await runFileParseQueue(
      ['new'],
      async (value) => value,
      { run: secondRun, yieldControl: async () => {} },
    );
    expect(
      secondRun.commit(() => {
        const outcome = secondResult.outcomes[0]!;
        if (outcome.status === 'fulfilled') applied.push(outcome.value);
      }),
    ).toBe(true);

    firstWorker.resolve('old');
    const firstResult = await firstResultPromise;
    expect(
      firstRun.commit(() => {
        const outcome = firstResult.outcomes[0]!;
        if (outcome.status === 'fulfilled') applied.push(outcome.value);
      }),
    ).toBe(false);
    expect(applied).toEqual(['new']);
  });

  test('is wired through analyzer, store, and visible upload progress', async () => {
    const [analyzer, store, dropzone] = await Promise.all([
      readFile(resolve(webRoot, 'src/lib/analyzer.ts'), 'utf8'),
      readFile(resolve(webRoot, 'src/lib/store.svelte.ts'), 'utf8'),
      readFile(
        resolve(webRoot, 'src/components/upload/FileDropzone.svelte'),
        'utf8',
      ),
    ]);

    expect(analyzer).toContain('runFileParseQueue(');
    expect(analyzer).not.toMatch(/Promise\.all\(\s*files\.map/);
    expect(store).toContain('OperationEpoch');
    expect(store).toContain('execution.run.isCurrent()');
    expect(analyzer).toContain('async (file, index, signal)');
    expect(dropzone).toContain('LatestFileParseRun');
    expect(dropzone).toContain(
      'analysisProgress.completed}/{analysisProgress.total',
    );
  });
});
