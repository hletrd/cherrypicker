import type {
  CapSuppressionCause,
  CardRuleSet,
  OptimizationConstraints,
  OptimizationResult,
  PortfolioCapLoss,
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

function addSafeNonnegativeIntegers(
  left: number,
  right: number,
): number | null {
  const sum = left + right;
  return Number.isSafeInteger(sum) ? sum : null;
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
  if (!isRecord(value)) return false;
  const isRuleScoped =
    value.capType === 'monthly_category' ||
    value.capType === 'per_transaction';
  const validIdentity = isRuleScoped
    ? (
        isNonEmptyString(value.ruleId) &&
        isNonEmptyString(value.capGroup)
      )
    : (
        value.capType === 'monthly_total' &&
        value.ruleId === undefined &&
        value.capGroup === undefined
      );
  return (
    isNonEmptyString(value.category) &&
    validIdentity &&
    isSafeNonnegativeInteger(value.capAmount) &&
    isSafeNonnegativeInteger(value.actualReward) &&
    isSafeNonnegativeInteger(value.appliedReward) &&
    value.appliedReward <= value.actualReward
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

function capSuppressionDelta(
  value: unknown,
): number | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.ruleId) ||
    !isNonEmptyString(value.capGroup) ||
    (
      value.capType !== 'monthly_category' &&
      value.capType !== 'monthly_total' &&
      value.capType !== 'per_transaction'
    ) ||
    !isSafeNonnegativeInteger(value.capAmount) ||
    !isSafeNonnegativeInteger(value.rewardBeforeCap) ||
    !isSafeNonnegativeInteger(value.rewardAfterCap) ||
    value.rewardBeforeCap <= value.rewardAfterCap ||
    value.rewardAfterCap > value.capAmount
  ) {
    return null;
  }

  const delta = value.rewardBeforeCap - value.rewardAfterCap;
  return Number.isSafeInteger(delta) && delta > 0 ? delta : null;
}

function isCapSuppressionCause(
  value: unknown,
): value is CapSuppressionCause {
  return capSuppressionDelta(value) !== null;
}

function hasValidSelectedCardIdentity(
  value: Record<string, unknown>,
): boolean {
  return (
    (
      value.selectedCardId === null &&
      value.selectedCardName === null &&
      value.selectedReward === 0
    ) ||
    (
      isNonEmptyString(value.selectedCardId) &&
      isNonEmptyString(value.selectedCardName) &&
      isSafeNonnegativeInteger(value.selectedReward) &&
      value.selectedReward > 0
    )
  );
}

function isPortfolioCapLoss(
  value: unknown,
): value is PortfolioCapLoss {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.transactionId) ||
    !isSafeNonnegativeInteger(value.transactionOccurrence) ||
    !isNonEmptyString(value.category) ||
    !isNonEmptyString(value.counterfactualCardId) ||
    !isNonEmptyString(value.counterfactualCardName) ||
    !isSafeNonnegativeInteger(value.counterfactualReward) ||
    !isSafeNonnegativeInteger(value.selectedReward) ||
    !isSafeNonnegativeInteger(value.grossSuppressedReward) ||
    value.grossSuppressedReward <= 0 ||
    value.grossSuppressedReward > value.counterfactualReward ||
    !isSafeNonnegativeInteger(value.replacementReward) ||
    !isSafeNonnegativeInteger(value.netLostReward) ||
    value.netLostReward <= 0 ||
    !hasValidSelectedCardIdentity(value) ||
    !Array.isArray(value.causes) ||
    value.causes.length === 0 ||
    !value.causes.every(isCapSuppressionCause)
  ) {
    return false;
  }

  let causeDeltaTotal = 0;
  const causeIdentities = new Set<string>();
  for (const cause of value.causes) {
    const causeIdentity = JSON.stringify([
      cause.ruleId,
      cause.capGroup,
      cause.capType,
    ]);
    if (causeIdentities.has(causeIdentity)) return false;
    causeIdentities.add(causeIdentity);
    const delta = capSuppressionDelta(cause);
    if (delta === null) return false;
    const nextTotal = addSafeNonnegativeIntegers(
      causeDeltaTotal,
      delta,
    );
    if (nextTotal === null) return false;
    causeDeltaTotal = nextTotal;
  }

  const reconciledGross = addSafeNonnegativeIntegers(
    value.replacementReward,
    value.netLostReward,
  );
  const reconciledCounterfactual = addSafeNonnegativeIntegers(
    value.selectedReward,
    value.netLostReward,
  );
  return (
    causeDeltaTotal === value.grossSuppressedReward &&
    reconciledGross === value.grossSuppressedReward &&
    reconciledCounterfactual === value.counterfactualReward
  );
}

function arePortfolioCapLosses(
  value: unknown,
): value is PortfolioCapLoss[] | undefined {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;

  const transactionIdentities = new Set<string>();
  for (const loss of value) {
    const transactionIdentity = isRecord(loss)
      ? JSON.stringify([
          loss.transactionId,
          loss.category,
          loss.transactionOccurrence,
        ])
      : '';
    if (
      !isPortfolioCapLoss(loss) ||
      transactionIdentities.has(transactionIdentity)
    ) {
      return false;
    }
    transactionIdentities.add(transactionIdentity);
  }
  return true;
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
    areOptionalCalculationIssues(value.unsupportedRules) &&
    arePortfolioCapLosses(value.portfolioCapLosses)
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
