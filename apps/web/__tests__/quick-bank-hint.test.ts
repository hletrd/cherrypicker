import { describe, expect, test } from 'bun:test';
import { LatestFirstItemHint } from '../src/lib/quick-bank-hint.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('LatestFirstItemHint', () => {
  test('only the current first item commits when A and B resolve in reverse order', async () => {
    const hints = new LatestFirstItemHint<object, string>();
    const a = {};
    const b = {};
    let first: object | undefined = a;
    const state: { committed: string | null } = { committed: null };
    const pendingA = deferred<string>();
    const pendingB = deferred<string>();

    const runA = hints.detect(a, () => pendingA.promise, () => first, (value) => {
      state.committed = value;
    });
    first = b;
    const runB = hints.detect(b, () => pendingB.promise, () => first, (value) => {
      state.committed = value;
    });

    pendingB.resolve('B');
    await runB;
    pendingA.resolve('A');
    await runA;
    expect(state.committed).toBe('B');
  });

  test('clear, remove, and destruction invalidate a pending result', async () => {
    for (const invalidate of ['clear', 'remove', 'destroy']) {
      const hints = new LatestFirstItemHint<object, string>();
      const item = {};
      let first: object | undefined = item;
      let commits = 0;
      const pending = deferred<string>();
      const run = hints.detect(item, () => pending.promise, () => first, () => {
        commits++;
      });

      first = undefined;
      hints.invalidate();
      pending.resolve(invalidate);
      await run;
      expect(commits).toBe(0);
    }
  });

  test('a rejection after replacement cannot clear the replacement hint', async () => {
    const hints = new LatestFirstItemHint<object, string>();
    const a = {};
    const b = {};
    let first: object | undefined = a;
    let committed: string | null = 'existing';
    const pendingA = deferred<string>();
    const pendingB = deferred<string>();

    const runA = hints.detect(a, () => pendingA.promise, () => first, (value) => {
      committed = value;
    });
    first = b;
    const runB = hints.detect(b, () => pendingB.promise, () => first, (value) => {
      committed = value;
    });
    pendingB.resolve('B');
    await runB;
    pendingA.reject(new Error('stale failure'));
    await runA;

    expect(committed).toBe('B');
  });
});
