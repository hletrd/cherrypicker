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

const ASCII_WORD_CHARACTER = /[a-z0-9]/;

/**
 * Match an already-normalized merchant string against an already-normalized
 * authored term.
 *
 * Korean and descriptive terms retain substring matching. Terms whose edge
 * characters are ASCII letters or digits must start/end at ASCII token
 * boundaries, preventing short aliases such as CU, KT, and SKT from matching
 * inside unrelated Latin words.
 */
export function normalizedMerchantTermMatches(
  normalizedMerchant: string,
  normalizedTerm: string,
): boolean {
  if (normalizedMerchant.length === 0 || normalizedTerm.length === 0) {
    return false;
  }

  const requiresLeadingBoundary = ASCII_WORD_CHARACTER.test(normalizedTerm[0]!);
  const requiresTrailingBoundary = ASCII_WORD_CHARACTER.test(
    normalizedTerm[normalizedTerm.length - 1]!,
  );
  let matchIndex = normalizedMerchant.indexOf(normalizedTerm);

  while (matchIndex !== -1) {
    const precedingCharacter = normalizedMerchant[matchIndex - 1];
    const followingCharacter =
      normalizedMerchant[matchIndex + normalizedTerm.length];
    const hasLeadingBoundary =
      !requiresLeadingBoundary ||
      precedingCharacter === undefined ||
      !ASCII_WORD_CHARACTER.test(precedingCharacter);
    const hasTrailingBoundary =
      !requiresTrailingBoundary ||
      followingCharacter === undefined ||
      !ASCII_WORD_CHARACTER.test(followingCharacter);

    if (hasLeadingBoundary && hasTrailingBoundary) return true;
    matchIndex = normalizedMerchant.indexOf(normalizedTerm, matchIndex + 1);
  }

  return false;
}
