import {
  isAnalysisResultCoherent,
  type AnalysisResult,
  type CategorizedTx,
} from './analysis-result.js';
import { isOptimizableTx } from './tx-validation.js';
import {
  isYearMonth,
  sumMonthlySpending,
  type PreviousSpendingBasis,
} from './analysis-context.js';
import { isValidISODate } from '@cherrypicker/parser/browser';

export const STORAGE_KEY = 'cherrypicker:analysis';
export const STORAGE_VERSION = 4;
export const MAX_PERSIST_SIZE = 4 * 1024 * 1024;
export const MAX_PERSISTED_WARNINGS = 100;
export const MAX_WARNING_FILENAME_LENGTH = 160;
export const MAX_WARNING_FORMAT_LENGTH = 32;
export const MAX_WARNING_MESSAGE_LENGTH = 512;

export type PersistWarningKind =
  | 'truncated'
  | 'corrupted'
  | 'quota_exceeded'
  | 'error'
  | null;

export interface PersistResult {
  kind: PersistWarningKind;
  truncatedTxCount: number | null;
}

export interface SerializedAnalysis {
  serialized: string;
  result: PersistResult;
}

export interface DeserializedAnalysis {
  data: AnalysisResult | null;
  warningKind: PersistWarningKind;
  truncatedTxCount: number | null;
  shouldRemove: boolean;
}

type PersistedAnalysisResult = Pick<
  AnalysisResult,
  | 'success'
  | 'bank'
  | 'format'
  | 'statementPeriod'
  | 'transactionCount'
  | 'fullStatementPeriod'
  | 'totalTransactionCount'
  | 'optimization'
  | 'categoryBreakdown'
  | 'monthlyBreakdown'
  | 'transactions'
  | 'previousMonthSpendingOption'
  | 'cardIdsOption'
  | 'parseErrors'
  | 'previousSpendingBasis'
> & {
  _truncatedTxCount?: number;
  _v: number;
};

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

const MIGRATIONS: Readonly<
  Record<number, (data: Record<string, unknown>) => Record<string, unknown>>
> = {
  0: (data) => ({ ...data, _v: 1 }),
  1: (data) => ({
    ...data,
    parseErrors: Array.isArray(data.parseErrors) ? data.parseErrors : [],
    previousSpendingBasis:
      safeNonnegativeInteger(data.previousMonthSpendingOption)
        ? { kind: 'user-total', amount: data.previousMonthSpendingOption }
        : undefined,
    _v: 2,
  }),
  2: (data) => ({
    ...data,
    optimization: isPlainObject(data.optimization)
      ? {
          ...data.optimization,
          unassignedSpending: 0,
          unassignedTransactionCount: 0,
        }
      : data.optimization,
    _v: 3,
  }),
  // Version 4 adds a canonical category witness and exact assignment counts.
  // They cannot be reconstructed soundly from legacy aggregate assignments,
  // so deserialization deliberately fails closed after this marker migration.
  3: (data) => ({ ...data, _v: 4 }),
};

export function safeJSONParse(text: string): unknown {
  return JSON.parse(text, (key, value) => {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Forbidden key in JSON: ${key}`);
    }
    return value;
  }) as unknown;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function persistedProjection(data: AnalysisResult): PersistedAnalysisResult {
  return {
    success: data.success,
    bank: data.bank,
    format: data.format,
    statementPeriod: data.statementPeriod,
    transactionCount: data.transactionCount,
    fullStatementPeriod: data.fullStatementPeriod,
    totalTransactionCount: data.totalTransactionCount,
    optimization: data.optimization,
    categoryBreakdown: data.categoryBreakdown,
    monthlyBreakdown: data.monthlyBreakdown,
    transactions: data.transactions,
    parseErrors: boundedParseWarnings(data.parseErrors),
    previousSpendingBasis: data.previousSpendingBasis,
    previousMonthSpendingOption: data.previousMonthSpendingOption,
    cardIdsOption: data.cardIdsOption,
    _v: STORAGE_VERSION,
  };
}

export function serializeAnalysis(data: AnalysisResult): SerializedAnalysis {
  const persisted = persistedProjection(data);
  const serialized = JSON.stringify(persisted);
  if (new TextEncoder().encode(serialized).length <= MAX_PERSIST_SIZE) {
    return {
      serialized,
      result: { kind: null, truncatedTxCount: null },
    };
  }

  const truncatedTxCount = data.transactions?.length ?? 0;
  const withoutTransactions: PersistedAnalysisResult = {
    ...persisted,
    transactions: undefined,
    _truncatedTxCount: truncatedTxCount,
  };
  return {
    serialized: JSON.stringify(withoutTransactions),
    result: { kind: 'truncated', truncatedTxCount },
  };
}

function storedVersion(data: Record<string, unknown>): number | null {
  const value = data._v ?? 0;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > STORAGE_VERSION
  ) {
    return null;
  }
  return value;
}

function migrate(
  input: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  let migrated = input;
  for (let version = fromVersion; version < STORAGE_VERSION; version += 1) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      throw new Error(`Missing storage migration ${version} -> ${version + 1}`);
    }
    migrated = migration(migrated);
    if (migrated._v !== version + 1) {
      throw new Error(`Storage migration ${version} did not set version ${version + 1}`);
    }
  }
  if (migrated._v !== STORAGE_VERSION) {
    throw new Error('Storage migration did not reach the current version');
  }
  return migrated;
}

function validAssignment(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.assignedCardId === 'string' &&
    value.assignedCardId.length > 0 &&
    typeof value.assignedCardName === 'string' &&
    value.assignedCardName.length > 0 &&
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    typeof value.categoryNameKo === 'string' &&
    value.categoryNameKo.length > 0 &&
    safeNonnegativeInteger(value.spending) &&
    safeNonnegativeInteger(value.transactionCount) &&
    value.transactionCount > 0 &&
    safeNonnegativeInteger(value.reward) &&
    finiteNonnegativeNumber(value.rate) &&
    Array.isArray(value.alternatives) &&
    value.alternatives.every(validAlternative)
  );
}

function validCategorySpendingSummary(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    typeof value.categoryNameKo === 'string' &&
    value.categoryNameKo.length > 0 &&
    safeNonnegativeInteger(value.spending) &&
    value.spending > 0 &&
    safeNonnegativeInteger(value.transactionCount) &&
    value.transactionCount > 0
  );
}

function validAlternative(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.cardId === 'string' &&
    value.cardId.length > 0 &&
    typeof value.cardName === 'string' &&
    value.cardName.length > 0 &&
    safeNonnegativeInteger(value.reward) &&
    finiteNonnegativeNumber(value.rate)
  );
}

function validCategoryReward(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    typeof value.categoryNameKo === 'string' &&
    value.categoryNameKo.length > 0 &&
    safeNonnegativeInteger(value.spending) &&
    safeNonnegativeInteger(value.reward) &&
    finiteNonnegativeNumber(value.rate) &&
    typeof value.rewardType === 'string' &&
    value.rewardType.length > 0 &&
    typeof value.capReached === 'boolean' &&
    (value.capAmount === undefined || safeNonnegativeInteger(value.capAmount))
  );
}

function validCapInfo(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const isRuleScoped =
    value.capType === 'monthly_category' ||
    value.capType === 'per_transaction';
  const hasNoIdentity =
    value.ruleId === undefined && value.capGroup === undefined;
  const hasValidIdentity =
    typeof value.ruleId === 'string' &&
    value.ruleId.length > 0 &&
    typeof value.capGroup === 'string' &&
    value.capGroup.length > 0;
  const validIdentity = isRuleScoped
    ? hasNoIdentity || hasValidIdentity
    : (
        value.capType === 'monthly_total' &&
        hasNoIdentity
      );
  return (
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    validIdentity &&
    safeNonnegativeInteger(value.capAmount) &&
    safeNonnegativeInteger(value.actualReward) &&
    safeNonnegativeInteger(value.appliedReward) &&
    value.appliedReward <= value.actualReward
  );
}

function validCardResult(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.cardId === 'string' &&
    value.cardId.length > 0 &&
    typeof value.cardName === 'string' &&
    value.cardName.length > 0 &&
    safeNonnegativeInteger(value.totalReward) &&
    safeNonnegativeInteger(value.totalSpending) &&
    finiteNonnegativeNumber(value.effectiveRate) &&
    Array.isArray(value.byCategory) &&
    value.byCategory.every(validCategoryReward) &&
    typeof value.performanceTier === 'string' &&
    value.performanceTier.length > 0 &&
    Array.isArray(value.capsHit) &&
    value.capsHit.every(validCapInfo) &&
    validOptionalCalculationIssues(value.unsupportedRules)
  );
}

function validBestSingleCard(value: unknown): boolean {
  if (value === null) return true;
  if (!isPlainObject(value)) return false;
  return (
    typeof value.cardId === 'string' &&
    value.cardId.length > 0 &&
    typeof value.cardName === 'string' &&
    value.cardName.length > 0 &&
    safeNonnegativeInteger(value.totalReward)
  );
}

function validCalculationIssue(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.cardId === 'string' &&
    value.cardId.length > 0 &&
    typeof value.transactionId === 'string' &&
    value.transactionId.length > 0 &&
    typeof value.ruleId === 'string' &&
    value.ruleId.length > 0 &&
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    typeof value.reason === 'string' &&
    value.reason.length > 0 &&
    (value.detail === undefined || typeof value.detail === 'string')
  );
}

function validOptionalCalculationIssues(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every(validCalculationIssue))
  );
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteNonnegativeNumber(value: unknown): value is number {
  return finiteNumber(value) && value >= 0;
}

function safeNonnegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function safeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function validStatementPeriod(
  value: unknown,
): value is { start: string; end: string } {
  return (
    isPlainObject(value) &&
    typeof value.start === 'string' &&
    typeof value.end === 'string' &&
    isValidISODate(value.start) &&
    isValidISODate(value.end) &&
    value.start <= value.end
  );
}

function validPersistedParseWarning(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.fileName === 'string' &&
    value.fileName.length > 0 &&
    typeof value.format === 'string' &&
    value.format.length > 0 &&
    typeof value.message === 'string' &&
    value.message.length > 0 &&
    (
      value.line === undefined ||
      (
        typeof value.line === 'number' &&
        Number.isSafeInteger(value.line) &&
        value.line > 0
      )
    ) &&
    (
      value.count === undefined ||
      (
        typeof value.count === 'number' &&
        Number.isSafeInteger(value.count) &&
        value.count > 0
      )
    ) &&
    (
      (
        value.kind === undefined &&
        value.affectedFileCount === undefined
      ) ||
      (
        value.kind === 'summary' &&
        typeof value.affectedFileCount === 'number' &&
        Number.isSafeInteger(value.affectedFileCount) &&
        value.affectedFileCount >= 0
      )
    )
  );
}

function validCurrentPayloadShape(value: Record<string, unknown>): boolean {
  return (
    typeof value.success === 'boolean' &&
    (typeof value.bank === 'string' || value.bank === null) &&
    typeof value.format === 'string' &&
    safeNonnegativeInteger(value.transactionCount) &&
    Array.isArray(value.parseErrors) &&
    value.parseErrors.every(validPersistedParseWarning) &&
    Array.isArray(value.categoryBreakdown) &&
    value.categoryBreakdown.every(validCategorySpendingSummary) &&
    previousSpendingBasis(value.previousSpendingBasis) !== undefined &&
    (
      value.monthlyBreakdown === undefined ||
      Array.isArray(value.monthlyBreakdown)
    ) &&
    (
      value.cardIdsOption === undefined ||
      (
        Array.isArray(value.cardIdsOption) &&
        value.cardIdsOption.every(
          (cardId) => typeof cardId === 'string' && cardId.length > 0,
        )
      )
    )
  );
}

function truncateEnd(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const available = maxLength - 1;
  const prefixLength = Math.ceil(available / 2);
  return `${value.slice(0, prefixLength)}…${value.slice(
    value.length - (available - prefixLength),
  )}`;
}

function warningCount(value: number | undefined): number | undefined {
  return Number.isSafeInteger(value) && value !== undefined && value > 0
    ? value
    : undefined;
}

function affectedFileCount(value: number | undefined): number | undefined {
  return Number.isSafeInteger(value) && value !== undefined && value >= 0
    ? value
    : undefined;
}

function sanitizeParseWarning(
  warning: AnalysisResult['parseErrors'][number],
): AnalysisResult['parseErrors'][number] {
  const summary = warning.kind === 'summary';
  return {
    fileName: truncateMiddle(
      warning.fileName || 'unknown',
      MAX_WARNING_FILENAME_LENGTH,
    ),
    format: truncateEnd(
      warning.format || 'unknown',
      MAX_WARNING_FORMAT_LENGTH,
    ),
    line:
      Number.isSafeInteger(warning.line) &&
      warning.line !== undefined &&
      warning.line > 0
        ? warning.line
        : undefined,
    message: truncateEnd(
      warning.message || '알 수 없는 파싱 경고',
      MAX_WARNING_MESSAGE_LENGTH,
    ),
    count: warningCount(warning.count),
    kind: summary ? 'summary' : undefined,
    affectedFileCount: summary
      ? affectedFileCount(warning.affectedFileCount)
      : undefined,
  };
}

function affectedWarningCount(
  warning: AnalysisResult['parseErrors'][number],
): number {
  return warningCount(warning.count) ?? 1;
}

function addSafeCounts(total: number, count: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, total + count);
}

export function boundedParseWarnings(
  warnings: readonly AnalysisResult['parseErrors'][number][],
): AnalysisResult['parseErrors'] {
  if (warnings.length <= MAX_PERSISTED_WARNINGS) {
    return warnings.map(sanitizeParseWarning);
  }

  const retainedCount = MAX_PERSISTED_WARNINGS - 1;
  const retained = warnings.slice(0, retainedCount).map(sanitizeParseWarning);
  const exactAffectedFileCount = new Set(
    warnings
      .filter((warning) => warning.kind !== 'summary')
      .map((warning) => warning.fileName)
      .filter(Boolean),
  ).size;
  const omittedCount = warnings
    .slice(retainedCount)
    .reduce(
      (total, warning) =>
        addSafeCounts(total, affectedWarningCount(warning)),
      0,
    );

  retained.push({
    fileName: '나머지 파싱 경고',
    format: '요약',
    message: '저장 공간 보호를 위해 나머지 파싱 경고를 요약했어요.',
    count: omittedCount,
    kind: 'summary',
    affectedFileCount: exactAffectedFileCount,
  });
  return retained;
}

function parseWarning(
  value: unknown,
  fallbackFormat: string,
): AnalysisResult['parseErrors'][number] | null {
  if (!isPlainObject(value) || typeof value.message !== 'string') return null;
  return sanitizeParseWarning({
    fileName:
      typeof value.fileName === 'string' ? value.fileName : 'unknown',
    format: typeof value.format === 'string' ? value.format : fallbackFormat,
    line:
      typeof value.line === 'number' && Number.isSafeInteger(value.line)
        ? value.line
        : undefined,
    message: value.message,
    count:
      typeof value.count === 'number' && Number.isSafeInteger(value.count)
        ? value.count
        : undefined,
    kind: value.kind === 'summary' ? 'summary' : undefined,
    affectedFileCount:
      typeof value.affectedFileCount === 'number' &&
      Number.isSafeInteger(value.affectedFileCount)
        ? value.affectedFileCount
        : undefined,
  });
}

function previousSpendingBasis(
  value: unknown,
): PreviousSpendingBasis | undefined {
  if (!isPlainObject(value) || typeof value.kind !== 'string') return undefined;
  if (
    value.kind === 'user-total' &&
    typeof value.amount === 'number' &&
    Number.isSafeInteger(value.amount) &&
    value.amount >= 0
  ) {
    return { kind: 'user-total', amount: value.amount };
  }
  if (
    value.kind === 'statement-month' &&
    typeof value.month === 'string' &&
    isYearMonth(value.month)
  ) {
    return { kind: 'statement-month', month: value.month };
  }
  if (
    value.kind === 'missing-calendar-month' &&
    typeof value.month === 'string' &&
    isYearMonth(value.month) &&
    value.assumedAmount === 0
  ) {
    return {
      kind: 'missing-calendar-month',
      month: value.month,
      assumedAmount: 0,
    };
  }
  return undefined;
}

function invalidResult(): DeserializedAnalysis {
  return {
    data: null,
    warningKind: 'corrupted',
    truncatedTxCount: null,
    shouldRemove: true,
  };
}

export function deserializeAnalysis(raw: string): DeserializedAnalysis {
  let parsed: unknown;
  try {
    parsed = safeJSONParse(raw);
  } catch {
    return invalidResult();
  }
  if (!isPlainObject(parsed)) return invalidResult();

  const version = storedVersion(parsed);
  if (version === null) return invalidResult();
  if (
    version === STORAGE_VERSION &&
    !validCurrentPayloadShape(parsed)
  ) {
    return invalidResult();
  }
  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(parsed, version);
  } catch {
    return invalidResult();
  }
  if (!isPlainObject(migrated.optimization)) return invalidResult();

  const optimization = migrated.optimization;
  if (
    !Array.isArray(optimization.assignments) ||
    !optimization.assignments.every(validAssignment) ||
    !safeNonnegativeInteger(optimization.totalReward) ||
    !safeNonnegativeInteger(optimization.totalSpending) ||
    !safeNonnegativeInteger(optimization.unassignedSpending) ||
    !safeNonnegativeInteger(optimization.unassignedTransactionCount) ||
    !finiteNonnegativeNumber(optimization.effectiveRate) ||
    !safeInteger(optimization.savingsVsSingleCard) ||
    !validBestSingleCard(optimization.bestSingleCard) ||
    !Array.isArray(optimization.cardResults) ||
    !optimization.cardResults.every(validCardResult) ||
    !validOptionalCalculationIssues(optimization.unsupportedRules)
  ) {
    return invalidResult();
  }
  if (
    !Array.isArray(migrated.categoryBreakdown) ||
    !migrated.categoryBreakdown.every(validCategorySpendingSummary)
  ) {
    return invalidResult();
  }

  if (
    (
      migrated.transactionCount !== undefined &&
      !safeNonnegativeInteger(migrated.transactionCount)
    ) ||
    (
      migrated.totalTransactionCount !== undefined &&
      !safeNonnegativeInteger(migrated.totalTransactionCount)
    ) ||
    (
      migrated._truncatedTxCount !== undefined &&
      !safeNonnegativeInteger(migrated._truncatedTxCount)
    ) ||
    (
      migrated.previousMonthSpendingOption !== undefined &&
      !safeNonnegativeInteger(migrated.previousMonthSpendingOption)
    ) ||
    (
      migrated.statementPeriod !== undefined &&
      !validStatementPeriod(migrated.statementPeriod)
    ) ||
    (
      migrated.fullStatementPeriod !== undefined &&
      !validStatementPeriod(migrated.fullStatementPeriod)
    )
  ) {
    return invalidResult();
  }

  let warningKind: PersistWarningKind = null;
  let truncatedTxCount: number | null = null;
  let transactions: CategorizedTx[] | undefined;
  if (Array.isArray(migrated.transactions)) {
    if (migrated._truncatedTxCount !== undefined) {
      return invalidResult();
    }
    if (!migrated.transactions.every(isOptimizableTx)) {
      return invalidResult();
    }
    transactions = migrated.transactions as CategorizedTx[];
  } else if (migrated.transactions !== undefined) {
    return invalidResult();
  } else if (
    safeNonnegativeInteger(migrated._truncatedTxCount) &&
    migrated._truncatedTxCount > 0
  ) {
    warningKind = 'truncated';
    truncatedTxCount = migrated._truncatedTxCount;
  } else {
    return invalidResult();
  }

  let monthlyBreakdown: AnalysisResult['monthlyBreakdown'];
  if (Array.isArray(migrated.monthlyBreakdown)) {
    if (
      !migrated.monthlyBreakdown.every(
        (item) =>
          isPlainObject(item) &&
          typeof item.month === 'string' &&
          isYearMonth(item.month) &&
          safeNonnegativeInteger(item.spending) &&
          safeNonnegativeInteger(item.transactionCount),
      )
    ) {
      return invalidResult();
    }
    const validatedBreakdown = migrated.monthlyBreakdown as NonNullable<
      AnalysisResult['monthlyBreakdown']
    >;
    try {
      sumMonthlySpending(validatedBreakdown);
    } catch {
      return invalidResult();
    }
    monthlyBreakdown = validatedBreakdown;
  }

  const format = typeof migrated.format === 'string' ? migrated.format : 'unknown';
  const parseErrors = Array.isArray(migrated.parseErrors)
    ? boundedParseWarnings(
        migrated.parseErrors
          .map((warning) => parseWarning(warning, format))
          .filter(
            (
              warning,
            ): warning is AnalysisResult['parseErrors'][number] =>
              warning !== null,
          ),
      )
    : [];
  const restoredPreviousSpendingBasis = previousSpendingBasis(
    migrated.previousSpendingBasis,
  );
  if (restoredPreviousSpendingBasis === undefined) {
    return invalidResult();
  }

  const data: AnalysisResult = {
    success: Boolean(migrated.success),
    bank:
      typeof migrated.bank === 'string' || migrated.bank === null
        ? migrated.bank
        : null,
    format,
    statementPeriod: validStatementPeriod(migrated.statementPeriod)
      ? migrated.statementPeriod
      : undefined,
    transactionCount: safeNonnegativeInteger(migrated.transactionCount)
      ? migrated.transactionCount
      : 0,
    fullStatementPeriod: validStatementPeriod(migrated.fullStatementPeriod)
      ? migrated.fullStatementPeriod
      : undefined,
    totalTransactionCount: safeNonnegativeInteger(migrated.totalTransactionCount)
      ? migrated.totalTransactionCount
      : undefined,
    parseErrors,
    transactions,
    categoryBreakdown:
      migrated.categoryBreakdown as AnalysisResult['categoryBreakdown'],
    optimization: optimization as unknown as AnalysisResult['optimization'],
    monthlyBreakdown,
    previousMonthSpendingOption: safeNonnegativeInteger(
      migrated.previousMonthSpendingOption,
    )
      ? migrated.previousMonthSpendingOption
      : undefined,
    cardIdsOption: Array.isArray(migrated.cardIdsOption)
      ? migrated.cardIdsOption.filter(
          (cardId): cardId is string =>
            typeof cardId === 'string' && cardId.length > 0,
        )
      : undefined,
    previousSpendingBasis: restoredPreviousSpendingBasis,
  };
  if (
    !isAnalysisResultCoherent(
      data,
      truncatedTxCount === null
        ? undefined
        : { truncatedTransactionCount: truncatedTxCount },
    ) ||
    version < STORAGE_VERSION
  ) {
    return invalidResult();
  }

  return {
    data,
    warningKind,
    truncatedTxCount,
    shouldRemove: false,
  };
}
