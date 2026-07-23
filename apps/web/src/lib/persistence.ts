import type { CategorizedTx } from './analyzer.js';
import type { AnalysisResult } from './store.svelte.js';
import { isOptimizableTx } from './tx-validation.js';
import {
  isYearMonth,
  type PreviousSpendingBasis,
} from './analysis-context.js';

export const STORAGE_KEY = 'cherrypicker:analysis';
export const STORAGE_VERSION = 2;
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
      finiteNumber(data.previousMonthSpendingOption) &&
      data.previousMonthSpendingOption >= 0
        ? { kind: 'user-total', amount: data.previousMonthSpendingOption }
        : undefined,
    _v: 2,
  }),
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
    transactionCount: 0,
    totalTransactionCount: 0,
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
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    typeof value.spending === 'number' &&
    Number.isFinite(value.spending) &&
    value.spending >= 0
  );
}

function validCardResult(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.cardId === 'string' &&
    value.cardId.length > 0 &&
    typeof value.totalReward === 'number' &&
    Number.isFinite(value.totalReward) &&
    value.totalReward >= 0 &&
    Array.isArray(value.byCategory)
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

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

function sanitizeParseWarning(
  warning: AnalysisResult['parseErrors'][number],
): AnalysisResult['parseErrors'][number] {
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
  const omittedCount = warnings
    .slice(retainedCount)
    .reduce(
      (total, warning) =>
        addSafeCounts(total, affectedWarningCount(warning)),
      0,
    );

  retained.push({
    fileName: '기타 업로드 파일',
    format: '요약',
    message: '저장 공간 보호를 위해 나머지 파싱 경고를 요약했어요.',
    count: omittedCount,
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
    !finiteNumber(optimization.totalReward) ||
    !finiteNumber(optimization.totalSpending) ||
    !finiteNumber(optimization.effectiveRate)
  ) {
    return invalidResult();
  }

  optimization.assignments = optimization.assignments.filter(validAssignment);
  if (Array.isArray(optimization.unsupportedRules)) {
    optimization.unsupportedRules =
      optimization.unsupportedRules.filter(validCalculationIssue);
  }
  if (Array.isArray(optimization.cardResults)) {
    const cardResults = optimization.cardResults.filter(validCardResult);
    optimization.cardResults = cardResults;
    for (const cardResult of cardResults) {
      if (
        isPlainObject(cardResult) &&
        Array.isArray(cardResult.unsupportedRules)
      ) {
        cardResult.unsupportedRules =
          cardResult.unsupportedRules.filter(validCalculationIssue);
      }
    }
  }

  let warningKind: PersistWarningKind = null;
  let truncatedTxCount: number | null = null;
  let transactions: CategorizedTx[] | undefined;
  if (Array.isArray(migrated.transactions)) {
    const validTransactions = migrated.transactions.filter(isOptimizableTx);
    transactions = validTransactions.length > 0 ? validTransactions : undefined;
    if (migrated.transactions.length > 0 && validTransactions.length === 0) {
      warningKind = 'corrupted';
    }
  } else if (
    finiteNumber(migrated._truncatedTxCount) &&
    migrated._truncatedTxCount >= 0
  ) {
    warningKind = 'truncated';
    truncatedTxCount = migrated._truncatedTxCount;
  }

  const monthlyBreakdown = Array.isArray(migrated.monthlyBreakdown)
    ? migrated.monthlyBreakdown.map((item) => {
        const entry = isPlainObject(item) ? item : {};
        return {
          month: typeof entry.month === 'string' ? entry.month : '',
          spending: finiteNumber(entry.spending) ? entry.spending : 0,
          transactionCount: finiteNumber(entry.transactionCount)
            ? entry.transactionCount
            : 0,
        };
      })
    : undefined;

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
  const data: AnalysisResult = {
    success: Boolean(migrated.success),
    bank:
      typeof migrated.bank === 'string' || migrated.bank === null
        ? migrated.bank
        : null,
    format,
    statementPeriod: isPlainObject(migrated.statementPeriod)
      ? (migrated.statementPeriod as { start: string; end: string })
      : undefined,
    transactionCount: finiteNumber(migrated.transactionCount)
      ? migrated.transactionCount
      : 0,
    fullStatementPeriod: isPlainObject(migrated.fullStatementPeriod)
      ? (migrated.fullStatementPeriod as { start: string; end: string })
      : undefined,
    totalTransactionCount: finiteNumber(migrated.totalTransactionCount)
      ? migrated.totalTransactionCount
      : undefined,
    parseErrors,
    transactions,
    optimization: optimization as unknown as AnalysisResult['optimization'],
    monthlyBreakdown,
    previousMonthSpendingOption: finiteNumber(
      migrated.previousMonthSpendingOption,
    )
      ? migrated.previousMonthSpendingOption
      : undefined,
    cardIdsOption: Array.isArray(migrated.cardIdsOption)
      ? migrated.cardIdsOption.filter(
          (cardId): cardId is string => typeof cardId === 'string',
        )
      : undefined,
    previousSpendingBasis: previousSpendingBasis(
      migrated.previousSpendingBasis,
    ),
  };

  return {
    data,
    warningKind,
    truncatedTxCount,
    shouldRemove: false,
  };
}
