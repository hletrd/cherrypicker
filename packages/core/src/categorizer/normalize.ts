/**
 * Normalize merchant text at every matching boundary.
 *
 * NFKC folds compatibility forms (for example, full-width Latin characters),
 * whitespace folding keeps statement and authored variants comparable, and
 * lowercasing makes Latin merchant allowlists case-insensitive.
 */
export function normalizeMerchantText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
