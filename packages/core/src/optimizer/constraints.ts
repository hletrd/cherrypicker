import type { CategorizedTransaction } from '../models/transaction.js';

export interface OptimizationConstraints {
  cards: { cardId: string; previousMonthSpending: number }[];
  transactions: CategorizedTransaction[];
  categorySpending: Map<string, number>;  // reporting-only category → total spending
  categoryLabels?: Map<string, string>;   // Optional: category ID → Korean label
}

export function buildConstraints(
  transactions: CategorizedTransaction[],
  cardPreviousSpending: Map<string, number>,
  categoryLabels?: Map<string, string>,
): OptimizationConstraints {
  // Keep the original transactions intact so the optimizer can preserve
  // merchant/subcategory/online facts when it scores assignments.
  const preservedTransactions = [...transactions];

  // Category totals remain useful for reporting and UI summaries only.
  const categorySpending = new Map<string, number>();
  for (const tx of preservedTransactions) {
    const current = categorySpending.get(tx.category) ?? 0;
    categorySpending.set(tx.category, current + tx.amount);
  }

  // Build card entries from the provided previous-month spending map.
  const cards: { cardId: string; previousMonthSpending: number }[] = [];
  for (const [cardId, previousMonthSpending] of cardPreviousSpending) {
    cards.push({ cardId, previousMonthSpending });
  }

  return { cards, transactions: preservedTransactions, categorySpending, categoryLabels };
}
