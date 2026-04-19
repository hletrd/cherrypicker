import type { CategorizedTransaction } from '../models/transaction.js';

export interface OptimizationConstraints {
  cards: { cardId: string; previousMonthSpending: number }[];
  transactions: CategorizedTransaction[];
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

  // Build card entries from the provided previous-month spending map.
  const cards: { cardId: string; previousMonthSpending: number }[] = [];
  for (const [cardId, previousMonthSpending] of cardPreviousSpending) {
    cards.push({ cardId, previousMonthSpending });
  }

  return { cards, transactions: preservedTransactions, categoryLabels };
}
