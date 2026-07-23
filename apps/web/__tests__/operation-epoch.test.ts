import { describe, expect, test } from 'bun:test';
import { OperationEpoch } from '../src/lib/operation-epoch.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('OperationEpoch', () => {
  test('only the newest operation can commit', () => {
    const owner = new OperationEpoch();
    const first = owner.begin();
    expect(first.isCurrent()).toBe(true);
    const second = owner.begin();
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  test('reset/cancel invalidates the current operation', () => {
    const owner = new OperationEpoch();
    const operation = owner.begin();
    owner.invalidate();
    expect(operation.isCurrent()).toBe(false);
  });

  test('a newer analyze owner blocks an older reoptimization continuation', async () => {
    const owner = new OperationEpoch();
    const commits: string[] = [];
    const reoptimization = deferred<string>();
    const oldOperation = owner.begin();
    const oldContinuation = reoptimization.promise.then((value) => {
      if (oldOperation.isCurrent()) commits.push(value);
    });

    const analyzeOperation = owner.begin();
    if (analyzeOperation.isCurrent()) commits.push('analyze-b');
    reoptimization.resolve('reoptimize-a');
    await oldContinuation;

    expect(commits).toEqual(['analyze-b']);
  });

  test('cancel and reset both block a deferred continuation', async () => {
    for (const invalidate of ['cancel', 'reset']) {
      const owner = new OperationEpoch();
      const dependency = deferred<void>();
      const commits: string[] = [];
      const operation = owner.begin();
      const continuation = dependency.promise.then(() => {
        if (operation.isCurrent()) commits.push(invalidate);
      });

      owner.invalidate();
      dependency.resolve();
      await continuation;
      expect(commits).toEqual([]);
    }
  });

  test('reverse-order reoptimizations commit only the newest result', async () => {
    const owner = new OperationEpoch();
    const first = deferred<string>();
    const second = deferred<string>();
    const commits: string[] = [];
    const firstOperation = owner.begin();
    const firstContinuation = first.promise.then((value) => {
      if (firstOperation.isCurrent()) commits.push(value);
    });
    const secondOperation = owner.begin();
    const secondContinuation = second.promise.then((value) => {
      if (secondOperation.isCurrent()) commits.push(value);
    });

    second.resolve('second');
    await secondContinuation;
    first.resolve('first');
    await firstContinuation;

    expect(commits).toEqual(['second']);
  });
});
