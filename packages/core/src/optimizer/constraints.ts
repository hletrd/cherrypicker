import type { CategorizedTransaction } from '../models/transaction.js';

export interface OptimizationConstraints {
  cards: { cardId: string; previousMonthSpending: number }[];
  categorySpending: Map<string, number>;  // category → total spending
}

export function buildConstraints(
  transactions: CategorizedTransaction[],
  cardPreviousSpending: Map<string, number>,
): OptimizationConstraints {
  // Aggregate total spending per category
  const categorySpending = new Map<string, number>();
  for (const tx of transactions) {
    const current = categorySpending.get(tx.category) ?? 0;
    categorySpending.set(tx.category, current + tx.amount);
  }

  // Build card entries from the provided previous-month spending map
  const cards: { cardId: string; previousMonthSpending: number }[] = [];
  for (const [cardId, previousMonthSpending] of cardPreviousSpending) {
    cards.push({ cardId, previousMonthSpending });
  }

  return { cards, categorySpending };
}
