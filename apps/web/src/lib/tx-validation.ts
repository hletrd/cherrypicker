import type { CategorizedTx } from './analyzer.js';
import {
  isValidFuelVolumeLiters,
  isValidISODate,
  PERFORMANCE_EXCLUSION_TAGS,
} from '@cherrypicker/parser/browser';

const PERFORMANCE_EXCLUSION_TAG_SET = new Set<string>(
  PERFORMANCE_EXCLUSION_TAGS,
);
const FACT_PROVENANCE_KEYS = new Set([
  'paymentType',
  'channel',
  'fuelVolumeLiters',
  'performanceExclusionTags',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidFactProvenance(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return Object.entries(value).every(
    ([key, source]) =>
      FACT_PROVENANCE_KEYS.has(key) &&
      (source === 'statement' || source === 'user'),
  );
}

function isValidPerformanceExclusionTags(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (tag) =>
        typeof tag === 'string' &&
        PERFORMANCE_EXCLUSION_TAG_SET.has(tag),
    )
  );
}

/** Validate that a transaction is suitable for display and optimization.
 *  Zero-amount entries (e.g., balance inquiries, declined transactions)
 *  are excluded because they don't contribute to optimization. Negative
 *  amounts (refunds/credits) are preserved — they are displayable even if
 *  not optimizable. */
export function isOptimizableTx(tx: unknown): tx is CategorizedTx {
  if (!isPlainRecord(tx)) return false;
  const obj = tx;
  return (
    typeof obj.id === 'string' && obj.id.length > 0 &&
    typeof obj.date === 'string' && isValidISODate(obj.date) &&
    typeof obj.merchant === 'string' &&
    typeof obj.amount === 'number' &&
    Number.isSafeInteger(obj.amount) &&
    obj.amount !== 0 &&
    typeof obj.category === 'string' && obj.category.length > 0 &&
    (
      obj.subcategory === undefined ||
      (typeof obj.subcategory === 'string' && obj.subcategory.length > 0)
    ) &&
    typeof obj.confidence === 'number' &&
    Number.isFinite(obj.confidence) &&
    obj.confidence >= 0 &&
    obj.confidence <= 1 &&
    (
      obj.installments === undefined ||
      (
        typeof obj.installments === 'number' &&
        Number.isSafeInteger(obj.installments) &&
        obj.installments > 0
      )
    ) &&
    (obj.rawCategory === undefined || typeof obj.rawCategory === 'string') &&
    (obj.memo === undefined || typeof obj.memo === 'string') &&
    (
      obj.paymentType === undefined ||
      obj.paymentType === 'domestic' ||
      obj.paymentType === 'overseas'
    ) &&
    (
      obj.channel === undefined ||
      obj.channel === 'online' ||
      obj.channel === 'offline'
    ) &&
    (
      obj.fuelVolumeLiters === undefined ||
      isValidFuelVolumeLiters(obj.fuelVolumeLiters)
    ) &&
    (
      obj.performanceExclusionTags === undefined ||
      isValidPerformanceExclusionTags(obj.performanceExclusionTags)
    ) &&
    (
      obj.factProvenance === undefined ||
      isValidFactProvenance(obj.factProvenance)
    )
  );
}
