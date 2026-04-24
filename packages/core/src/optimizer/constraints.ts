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
  // The greedy optimizer only reads from the transactions array (never mutates),
  // so a shallow copy is unnecessary. If a future optimizer needs to mutate,
  // the copy can be restored at that point (C9-06).
  const preservedTransactions = transactions;

  // Build card entries from the provided previous-month spending map.
  const cards: { cardId: string; previousMonthSpending: number }[] = [];
  for (const [cardId, previousMonthSpending] of cardPreviousSpending) {
    cards.push({ cardId, previousMonthSpending });
  }

  return { cards, transactions: preservedTransactions, categoryLabels };
}
