import { describe, expect, test } from 'bun:test';
import type {
  CardRuleSet,
  OptimizationConstraints,
  OptimizationResult,
  PortfolioCapLoss,
} from '@cherrypicker/core';
import {
  optimizeWithWorker,
  type OptimizerWorkerLike,
} from '../src/lib/optimizer/worker-runner.js';
import type {
  OptimizerWorkerRequest,
} from '../src/lib/optimizer/worker-protocol.js';

class FakeOptimizerWorker implements OptimizerWorkerLike {
  messages: OptimizerWorkerRequest[] = [];
  terminations = 0;
  messageListeners = new Set<(event: MessageEvent<unknown>) => void>();
  errorListeners = new Set<(event: ErrorEvent) => void>();
  messageErrorListeners = new Set<(event: MessageEvent<unknown>) => void>();

  postMessage(message: OptimizerWorkerRequest): void {
    this.messages.push(message);
  }

  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | ((event: MessageEvent<unknown>) => void)
      | ((event: ErrorEvent) => void)
      | ((event: MessageEvent<unknown>) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.add(
        listener as (event: MessageEvent<unknown>) => void,
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
      | ((event: MessageEvent<unknown>) => void)
      | ((event: ErrorEvent) => void)
      | ((event: MessageEvent<unknown>) => void),
  ): void {
    if (type === 'message') {
      this.messageListeners.delete(
        listener as (event: MessageEvent<unknown>) => void,
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

  respond(response: unknown): void {
    for (const listener of this.messageListeners) {
      listener({ data: response } as MessageEvent<unknown>);
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
  portfolioCapLosses: [],
};

const portfolioCapLoss: PortfolioCapLoss = {
  transactionId: 'tx-capped',
  transactionOccurrence: 0,
  category: 'dining',
  counterfactualCardId: 'capped-card',
  counterfactualCardName: '한도 카드',
  selectedCardId: 'fallback-card',
  selectedCardName: '대체 카드',
  counterfactualReward: 5_000,
  selectedReward: 2_000,
  grossSuppressedReward: 5_000,
  replacementReward: 2_000,
  netLostReward: 3_000,
  causes: [
    {
      ruleId: 'dining-benefit',
      capGroup: 'dining-benefit',
      capType: 'monthly_category',
      capAmount: 5_000,
      rewardBeforeCap: 5_000,
      rewardAfterCap: 0,
    },
  ],
};

function portfolioLossWith(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...portfolioCapLoss,
    ...overrides,
  };
}

function optimizationResultWithPortfolioLosses(
  losses: unknown[],
): Record<string, unknown> {
  return {
    ...optimizationResult,
    portfolioCapLosses: losses,
  };
}

function optimizationResultWithCap(
  cap: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...optimizationResult,
    cardResults: [
      {
        cardId: 'card-1',
        cardName: '카드 1',
        totalReward: 100,
        totalSpending: 1_000,
        effectiveRate: 0.1,
        byCategory: [],
        performanceTier: 'tier0',
        capsHit: [cap],
      },
    ],
  };
}

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

  test('decodes the ordinary error arm and tears down its worker', async () => {
    const worker = new FakeOptimizerWorker();
    const optimizing = optimizeWithWorker(
      constraints,
      [],
      undefined,
      () => worker,
    );

    worker.respond({ ok: false, message: '계산 실패' });

    const failure = await optimizing.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(failure).toMatchObject({ message: '계산 실패' });
    expect(worker.terminations).toBe(1);
    expect(worker.messageListeners.size).toBe(0);
    expect(worker.errorListeners.size).toBe(0);
    expect(worker.messageErrorListeners.size).toBe(0);
  });

  test('accepts identity-bearing rule-scoped cap telemetry', async () => {
    const worker = new FakeOptimizerWorker();
    const result = optimizationResultWithCap({
      category: 'dining',
      capType: 'monthly_category',
      capAmount: 100,
      actualReward: 100,
      appliedReward: 100,
      ruleId: 'reward-1',
      capGroup: 'reward-group',
    });
    const optimizing = optimizeWithWorker(
      constraints,
      [],
      undefined,
      () => worker,
    );

    worker.respond({ ok: true, result });

    expect(
      (await optimizing).cardResults[0]?.capsHit[0],
    ).toMatchObject({
      ruleId: 'reward-1',
      capGroup: 'reward-group',
    });
    expect(worker.terminations).toBe(1);
  });

  test('accepts reconciled portfolio cap loss telemetry', async () => {
    const worker = new FakeOptimizerWorker();
    const losses: PortfolioCapLoss[] = [
      portfolioCapLoss,
      {
        ...portfolioCapLoss,
        transactionOccurrence: 1,
        selectedCardId: null,
        selectedCardName: null,
        counterfactualReward: 5_000,
        selectedReward: 0,
        grossSuppressedReward: 5_000,
        replacementReward: 0,
        netLostReward: 5_000,
      },
    ];
    const result = optimizationResultWithPortfolioLosses(losses);
    const optimizing = optimizeWithWorker(
      constraints,
      [],
      undefined,
      () => worker,
    );

    worker.respond({ ok: true, result });

    expect((await optimizing).portfolioCapLosses).toEqual(losses);
    expect(worker.terminations).toBe(1);
  });

  test('accepts explicit unknown telemetry from an unrepresentable calculation', async () => {
    const worker = new FakeOptimizerWorker();
    const result = {
      ...optimizationResult,
      portfolioCapLosses: undefined,
    };
    const optimizing = optimizeWithWorker(
      constraints,
      [],
      undefined,
      () => worker,
    );

    worker.respond({ ok: true, result });

    expect((await optimizing).portfolioCapLosses).toBeUndefined();
    expect(worker.terminations).toBe(1);
  });

  test.each([
    ['null payload', null],
    ['undefined payload', undefined],
    ['missing discriminant', {}],
    ['invalid discriminant', { ok: 'true' }],
    ['missing success result', { ok: true }],
    ['null success result', { ok: true, result: null }],
    [
      'malformed success result',
      {
        ok: true,
        result: {
          ...optimizationResult,
          assignments: {},
        },
      },
    ],
    [
      'malformed nested card result',
      {
        ok: true,
        result: {
          ...optimizationResult,
          cardResults: [{}],
        },
      },
    ],
    [
      'non-finite success total',
      {
        ok: true,
        result: {
          ...optimizationResult,
          totalReward: Number.NaN,
        },
      },
    ],
    [
      'non-array portfolio cap loss telemetry',
      {
        ok: true,
        result: {
          ...optimizationResult,
          portfolioCapLosses: {},
        },
      },
    ],
    [
      'portfolio loss with a fractional transaction occurrence',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({ transactionOccurrence: 0.5 }),
        ]),
      },
    ],
    [
      'portfolio loss with mismatched selected card identity',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            selectedCardName: null,
          }),
        ]),
      },
    ],
    [
      'portfolio loss with selected reward but no selected card',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            selectedCardId: null,
            selectedCardName: null,
          }),
        ]),
      },
    ],
    [
      'portfolio loss without a suppression cause',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({ causes: [] }),
        ]),
      },
    ],
    [
      'portfolio loss with an unknown cap stage',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            causes: [{
              ...portfolioCapLoss.causes[0],
              capType: 'annual_total',
            }],
          }),
        ]),
      },
    ],
    [
      'portfolio loss with a non-positive cause delta',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            causes: [{
              ...portfolioCapLoss.causes[0],
              rewardAfterCap: 5_000,
            }],
          }),
        ]),
      },
    ],
    [
      'portfolio loss whose cause deltas do not equal gross suppression',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            causes: [{
              ...portfolioCapLoss.causes[0],
              rewardBeforeCap: 4_999,
            }],
          }),
        ]),
      },
    ],
    [
      'portfolio loss with a duplicate cap-cause identity',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            causes: [
              {
                ...portfolioCapLoss.causes[0],
                rewardBeforeCap: 2_500,
                rewardAfterCap: 0,
              },
              {
                ...portfolioCapLoss.causes[0],
                rewardBeforeCap: 2_500,
                rewardAfterCap: 0,
              },
            ],
          }),
        ]),
      },
    ],
    [
      'portfolio loss with a post-cap reward above the cap amount',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            causes: [{
              ...portfolioCapLoss.causes[0],
              capAmount: 99,
              rewardBeforeCap: 5_100,
              rewardAfterCap: 100,
            }],
          }),
        ]),
      },
    ],
    [
      'portfolio loss whose replacement and net do not reconcile to gross',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({ replacementReward: 1_999 }),
        ]),
      },
    ],
    [
      'portfolio loss with gross suppression above its counterfactual reward',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            grossSuppressedReward: 6_000,
            replacementReward: 3_000,
            causes: [{
              ...portfolioCapLoss.causes[0],
              capAmount: 0,
              rewardBeforeCap: 6_000,
              rewardAfterCap: 0,
            }],
          }),
        ]),
      },
    ],
    [
      'portfolio loss whose selected and net do not reconcile to counterfactual',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({ counterfactualReward: 4_999 }),
        ]),
      },
    ],
    [
      'portfolio loss whose cause sum overflows safe integers',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioLossWith({
            selectedCardId: null,
            selectedCardName: null,
            counterfactualReward: 1,
            selectedReward: 0,
            grossSuppressedReward: Number.MAX_SAFE_INTEGER,
            replacementReward: Number.MAX_SAFE_INTEGER - 1,
            netLostReward: 1,
            causes: [
              {
                ...portfolioCapLoss.causes[0],
                rewardBeforeCap: Number.MAX_SAFE_INTEGER,
                rewardAfterCap: 0,
              },
              {
                ...portfolioCapLoss.causes[0],
                ruleId: 'other-benefit',
                capGroup: 'other-benefit',
                rewardBeforeCap: 1,
                rewardAfterCap: 0,
              },
            ],
          }),
        ]),
      },
    ],
    [
      'duplicate portfolio losses for one transaction',
      {
        ok: true,
        result: optimizationResultWithPortfolioLosses([
          portfolioCapLoss,
          portfolioCapLoss,
        ]),
      },
    ],
    [
      'rule-scoped cap without identity',
      {
        ok: true,
        result: optimizationResultWithCap({
          category: 'dining',
          capType: 'monthly_category',
          capAmount: 100,
          actualReward: 100,
          appliedReward: 100,
        }),
      },
    ],
    [
      'rule-scoped cap with only one identity',
      {
        ok: true,
        result: optimizationResultWithCap({
          category: 'dining',
          capType: 'per_transaction',
          capAmount: 100,
          actualReward: 120,
          appliedReward: 100,
          ruleId: 'reward-1',
        }),
      },
    ],
    [
      'card-wide cap carrying rule identity',
      {
        ok: true,
        result: optimizationResultWithCap({
          category: 'dining',
          capType: 'monthly_total',
          capAmount: 100,
          actualReward: 100,
          appliedReward: 100,
          ruleId: 'reward-1',
          capGroup: 'reward-group',
        }),
      },
    ],
    [
      'cap with applied reward above actual reward',
      {
        ok: true,
        result: optimizationResultWithCap({
          category: 'dining',
          capType: 'monthly_category',
          capAmount: 100,
          actualReward: 99,
          appliedReward: 100,
          ruleId: 'reward-1',
          capGroup: 'reward-group',
        }),
      },
    ],
    ['missing error message', { ok: false }],
    ['non-string error message', { ok: false, message: 7 }],
  ])(
    'rejects a malformed ordinary worker message exactly once: %s',
    async (_name, payload) => {
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

      worker.respond(payload);
      worker.respond({ ok: true, result: optimizationResult });
      controller.abort();

      const outcome = await optimizing;
      expect(outcome).toMatchObject({
        kind: 'rejected',
        reason: {
          message: '최적화 작업자 응답 형식이 올바르지 않아요.',
        },
      });
      expect(resolutions).toBe(0);
      expect(rejections).toBe(1);
      expect(worker.terminations).toBe(1);
      expect(worker.messageListeners.size).toBe(0);
      expect(worker.errorListeners.size).toBe(0);
      expect(worker.messageErrorListeners.size).toBe(0);
    },
  );
});
