import type {
  CardRuleSet,
  OptimizationConstraints,
  OptimizationResult,
} from '@cherrypicker/core';

export interface OptimizerWorkerRequest {
  constraints: OptimizationConstraints;
  cardRules: CardRuleSet[];
}

export type OptimizerWorkerResponse =
  | { ok: true; result: OptimizationResult }
  | { ok: false; message: string };

interface OptimizerWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<OptimizerWorkerRequest>) => void,
  ): void;
  postMessage(message: OptimizerWorkerResponse): void;
}

export function installOptimizerWorker(
  optimize: (
    constraints: OptimizationConstraints,
    cardRules: CardRuleSet[],
  ) => OptimizationResult,
): void {
  const scope = globalThis as unknown as OptimizerWorkerScope;
  scope.addEventListener('message', (event) => {
    try {
      scope.postMessage({
        ok: true,
        result: optimize(event.data.constraints, event.data.cardRules),
      });
    } catch (error) {
      scope.postMessage({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
