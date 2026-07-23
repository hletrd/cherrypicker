import { describe, expect, test } from 'bun:test';
import type {
  CardRuleSet,
  OptimizationConstraints,
  OptimizationResult,
} from '@cherrypicker/core';
import {
  optimizeWithWorker,
  type OptimizerWorkerLike,
} from '../src/lib/optimizer/worker-runner.js';
import type {
  OptimizerWorkerRequest,
  OptimizerWorkerResponse,
} from '../src/lib/optimizer/worker-protocol.js';

class FakeOptimizerWorker implements OptimizerWorkerLike {
  messages: OptimizerWorkerRequest[] = [];
  terminations = 0;
  messageListeners = new Set<
    (event: MessageEvent<OptimizerWorkerResponse>) => void
  >();
  errorListeners = new Set<(event: ErrorEvent) => void>();
  messageErrorListeners = new Set<(event: MessageEvent<unknown>) => void>();

  postMessage(message: OptimizerWorkerRequest): void {
    this.messages.push(message);
  }

  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | ((event: MessageEvent<OptimizerWorkerResponse>) => void)
      | ((event: ErrorEvent) => void)
      | ((event: MessageEvent<unknown>) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.add(
        listener as (event: MessageEvent<OptimizerWorkerResponse>) => void,
      );
    } else if (type === 'error') {
      this.errorListeners.add(listener as (event: ErrorEvent) => void);
    } else {
      this.messageErrorListeners.add(
        listener as (event: MessageEvent<unknown>) => void,
      );
    }
  }

  removeEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | ((event: MessageEvent<OptimizerWorkerResponse>) => void)
      | ((event: ErrorEvent) => void)
      | ((event: MessageEvent<unknown>) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.delete(
        listener as (event: MessageEvent<OptimizerWorkerResponse>) => void,
      );
    } else if (type === 'error') {
      this.errorListeners.delete(listener as (event: ErrorEvent) => void);
    } else {
      this.messageErrorListeners.delete(
        listener as (event: MessageEvent<unknown>) => void,
      );
    }
  }

  terminate(): void {
    this.terminations++;
  }

  respond(response: OptimizerWorkerResponse): void {
    for (const listener of this.messageListeners) {
      listener({ data: response } as MessageEvent<OptimizerWorkerResponse>);
    }
  }

  emitMessageError(): void {
    for (const listener of this.messageErrorListeners) {
      listener({
        data: { privatePayload: 'must not escape into the error' },
      } as MessageEvent<unknown>);
    }
  }
}

const constraints: OptimizationConstraints = {
  cards: [],
  transactions: [],
  categoryLabels: new Map(),
};

const optimizationResult: OptimizationResult = {
  assignments: [],
  totalReward: 0,
  totalSpending: 0,
  unassignedSpending: 0,
  unassignedTransactionCount: 0,
  effectiveRate: 0,
  savingsVsSingleCard: 0,
  bestSingleCard: null,
  cardResults: [],
};

describe('browser optimizer worker ownership', () => {
  test('aborting one 683-card caller terminates only its work while the live caller succeeds', async () => {
    const cancelledWorker = new FakeOptimizerWorker();
    const liveWorker = new FakeOptimizerWorker();
    const rules = Array.from(
      { length: 683 },
      (_, index) => ({
        card: { id: `card-${index}` },
      }) as CardRuleSet,
    );
    const controller = new AbortController();

    const cancelled = optimizeWithWorker(
      constraints,
      rules,
      controller.signal,
      () => cancelledWorker,
    );
    const live = optimizeWithWorker(
      constraints,
      rules,
      undefined,
      () => liveWorker,
    );

    controller.abort();
    const cancellation = await cancelled.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(cancellation).toMatchObject({ name: 'AbortError' });
    expect(cancelledWorker.terminations).toBe(1);
    expect(cancelledWorker.messageListeners.size).toBe(0);
    expect(cancelledWorker.errorListeners.size).toBe(0);
    expect(cancelledWorker.messageErrorListeners.size).toBe(0);
    expect(cancelledWorker.messages[0]?.cardRules).toHaveLength(683);

    // A late result from the terminated worker has no listener and cannot
    // settle or contaminate the independently owned live optimization.
    cancelledWorker.respond({ ok: true, result: optimizationResult });
    liveWorker.respond({ ok: true, result: optimizationResult });
    expect(await live).toBe(optimizationResult);
    expect(liveWorker.terminations).toBe(1);
    expect(liveWorker.messageListeners.size).toBe(0);
    expect(liveWorker.errorListeners.size).toBe(0);
    expect(liveWorker.messageErrorListeners.size).toBe(0);
    expect(liveWorker.messages[0]?.cardRules).toHaveLength(683);
  });

  test('messageerror rejects once and removes every terminal listener', async () => {
    const worker = new FakeOptimizerWorker();
    const controller = new AbortController();
    let resolutions = 0;
    let rejections = 0;
    const optimizing = optimizeWithWorker(
      constraints,
      [],
      controller.signal,
      () => worker,
    ).then(
      (value) => {
        resolutions++;
        return { kind: 'resolved' as const, value };
      },
      (reason: unknown) => {
        rejections++;
        return { kind: 'rejected' as const, reason };
      },
    );

    worker.emitMessageError();
    worker.respond({ ok: true, result: optimizationResult });
    controller.abort();

    const outcome = await optimizing;
    expect(outcome).toMatchObject({
      kind: 'rejected',
      reason: { message: '최적화 작업자 응답을 읽을 수 없어요.' },
    });
    expect(resolutions).toBe(0);
    expect(rejections).toBe(1);
    expect(worker.terminations).toBe(1);
    expect(worker.messageListeners.size).toBe(0);
    expect(worker.errorListeners.size).toBe(0);
    expect(worker.messageErrorListeners.size).toBe(0);
  });
});
