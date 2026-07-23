import type { CategorizedTransaction } from '@cherrypicker/core';

export interface SpendingCategorySummary {
  categoryId: string;
  labelKo: string;
  total: number;
  count: number;
}

export interface SpendingAggregation {
  categories: SpendingCategorySummary[];
  grandTotal: number;
  includedCount: number;
}

const UNSAFE_AMOUNT_MESSAGE =
  '거래 금액 합계가 안전한 정수 범위를 벗어났어요. 원본 거래 금액을 확인해 주세요.';

function checkedAdd(left: number, right: number): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new RangeError(UNSAFE_AMOUNT_MESSAGE);
  }
  return sum;
}

/**
 * Build the positive-spending view shared by every public visualization.
 *
 * Every amount and aggregate is validated before a caller can emit a table or
 * report, so an unsafe sum cannot be formatted as exact Won.
 */
export function aggregatePositiveSpending(
  transactions: readonly CategorizedTransaction[],
  categoryLabels: ReadonlyMap<string, string>,
): SpendingAggregation {
  const byCategory = new Map<string, SpendingCategorySummary>();
  let grandTotal = 0;
  let includedCount = 0;

  for (const transaction of transactions) {
    if (!Number.isSafeInteger(transaction.amount)) {
      throw new RangeError(UNSAFE_AMOUNT_MESSAGE);
    }
    if (transaction.amount <= 0) continue;

    includedCount = checkedAdd(includedCount, 1);
    const categoryId = transaction.subcategory
      ? `${transaction.category}.${transaction.subcategory}`
      : transaction.category;
    const existing = byCategory.get(categoryId);
    if (existing) {
      existing.total = checkedAdd(existing.total, transaction.amount);
      existing.count = checkedAdd(existing.count, 1);
    } else {
      byCategory.set(categoryId, {
        categoryId,
        labelKo:
          categoryLabels.get(categoryId) ??
          categoryLabels.get(transaction.category) ??
          categoryId,
        total: transaction.amount,
        count: 1,
      });
    }
    grandTotal = checkedAdd(grandTotal, transaction.amount);
  }

  return {
    categories: [...byCategory.values()],
    grandTotal,
    includedCount,
  };
}
