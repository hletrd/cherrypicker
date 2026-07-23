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

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isFiniteNonnegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isAlternative(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.cardId) &&
    isNonEmptyString(value.cardName) &&
    isSafeNonnegativeInteger(value.reward) &&
    isFiniteNonnegativeNumber(value.rate)
  );
}

function isAssignment(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.category) &&
    isNonEmptyString(value.categoryNameKo) &&
    isNonEmptyString(value.assignedCardId) &&
    isNonEmptyString(value.assignedCardName) &&
    isSafeNonnegativeInteger(value.spending) &&
    isSafeNonnegativeInteger(value.transactionCount) &&
    value.transactionCount > 0 &&
    isSafeNonnegativeInteger(value.reward) &&
    isFiniteNonnegativeNumber(value.rate) &&
    Array.isArray(value.alternatives) &&
    value.alternatives.every(isAlternative)
  );
}

function isCategoryReward(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.category) &&
    isNonEmptyString(value.categoryNameKo) &&
    isSafeNonnegativeInteger(value.spending) &&
    isSafeNonnegativeInteger(value.reward) &&
    isFiniteNonnegativeNumber(value.rate) &&
    isNonEmptyString(value.rewardType) &&
    typeof value.capReached === 'boolean' &&
    (
      value.capAmount === undefined ||
      isSafeNonnegativeInteger(value.capAmount)
    )
  );
}

function isCapInfo(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.category) &&
    (
      value.capType === 'monthly_category' ||
      value.capType === 'monthly_total' ||
      value.capType === 'per_transaction'
    ) &&
    isSafeNonnegativeInteger(value.capAmount) &&
    isSafeNonnegativeInteger(value.actualReward) &&
    isSafeNonnegativeInteger(value.appliedReward)
  );
}

function isCalculationIssue(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.cardId) &&
    isNonEmptyString(value.transactionId) &&
    isNonEmptyString(value.ruleId) &&
    isNonEmptyString(value.category) &&
    isNonEmptyString(value.reason) &&
    (value.detail === undefined || typeof value.detail === 'string')
  );
}

function areOptionalCalculationIssues(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every(isCalculationIssue))
  );
}

function isCardResult(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.cardId) &&
    isNonEmptyString(value.cardName) &&
    isSafeNonnegativeInteger(value.totalReward) &&
    isSafeNonnegativeInteger(value.totalSpending) &&
    isFiniteNonnegativeNumber(value.effectiveRate) &&
    Array.isArray(value.byCategory) &&
    value.byCategory.every(isCategoryReward) &&
    isNonEmptyString(value.performanceTier) &&
    Array.isArray(value.capsHit) &&
    value.capsHit.every(isCapInfo) &&
    areOptionalCalculationIssues(value.unsupportedRules)
  );
}

function isBestSingleCard(value: unknown): boolean {
  return (
    value === null ||
    (
      isRecord(value) &&
      isNonEmptyString(value.cardId) &&
      isNonEmptyString(value.cardName) &&
      isSafeNonnegativeInteger(value.totalReward)
    )
  );
}

function isOptimizationResult(value: unknown): value is OptimizationResult {
  return (
    isRecord(value) &&
    Array.isArray(value.assignments) &&
    value.assignments.every(isAssignment) &&
    isSafeNonnegativeInteger(value.totalReward) &&
    isSafeNonnegativeInteger(value.totalSpending) &&
    isSafeNonnegativeInteger(value.unassignedSpending) &&
    isSafeNonnegativeInteger(value.unassignedTransactionCount) &&
    isFiniteNonnegativeNumber(value.effectiveRate) &&
    isSafeInteger(value.savingsVsSingleCard) &&
    isBestSingleCard(value.bestSingleCard) &&
    Array.isArray(value.cardResults) &&
    value.cardResults.every(isCardResult) &&
    areOptionalCalculationIssues(value.unsupportedRules)
  );
}

export function decodeOptimizerWorkerResponse(
  value: unknown,
): OptimizerWorkerResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    throw new TypeError('Invalid optimizer worker response');
  }
  if (value.ok) {
    if (!isOptimizationResult(value.result)) {
      throw new TypeError('Invalid optimizer worker result');
    }
    return { ok: true, result: value.result };
  }
  if (typeof value.message !== 'string') {
    throw new TypeError('Invalid optimizer worker error');
  }
  return { ok: false, message: value.message };
}

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
