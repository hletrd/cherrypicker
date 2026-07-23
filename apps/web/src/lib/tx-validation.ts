import type { CategorizedTx } from './analyzer.js';
import { isValidFuelVolumeLiters } from '@cherrypicker/parser/browser';

/** Validate that a transaction is suitable for display and optimization.
 *  Zero-amount entries (e.g., balance inquiries, declined transactions)
 *  are excluded because they don't contribute to optimization. Negative
 *  amounts (refunds/credits) are preserved — they are displayable even if
 *  not optimizable. */
export function isOptimizableTx(tx: unknown): tx is CategorizedTx {
  if (!tx || typeof tx !== 'object') return false;
  const obj = tx as Record<string, unknown>;
  return (
    typeof obj.id === 'string' && obj.id.length > 0 &&
    typeof obj.date === 'string' && obj.date.length > 0 &&
    typeof obj.merchant === 'string' &&
    typeof obj.amount === 'number' &&
    Number.isSafeInteger(obj.amount) &&
    obj.amount !== 0 &&
    typeof obj.category === 'string' && obj.category.length > 0 &&
    (
      obj.fuelVolumeLiters === undefined ||
      isValidFuelVolumeLiters(obj.fuelVolumeLiters)
    )
  );
}
