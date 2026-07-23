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

export interface CompiledNormalizedMerchantTerm {
  readonly text: string;
  readonly requiresLeadingAsciiBoundary: boolean;
  readonly requiresTrailingAsciiBoundary: boolean;
}

function isAsciiWordCharacterCode(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 97 && code <= 122)
  );
}

export function compileNormalizedMerchantTerm(
  normalizedText: string,
): CompiledNormalizedMerchantTerm {
  if (normalizedText.length === 0) {
    return Object.freeze({
      text: normalizedText,
      requiresLeadingAsciiBoundary: false,
      requiresTrailingAsciiBoundary: false,
    });
  }
  return Object.freeze({
    text: normalizedText,
    requiresLeadingAsciiBoundary: isAsciiWordCharacterCode(
      normalizedText.charCodeAt(0),
    ),
    requiresTrailingAsciiBoundary: isAsciiWordCharacterCode(
      normalizedText.charCodeAt(normalizedText.length - 1),
    ),
  });
}

function compiledTermMatchesFromIndex(
  normalizedMerchant: string,
  compiledTerm: CompiledNormalizedMerchantTerm,
  initialMatchIndex: number,
): boolean {
  const { text } = compiledTerm;
  let matchIndex = initialMatchIndex;
  while (matchIndex !== -1) {
    const precedingIsAsciiWord =
      matchIndex > 0 &&
      isAsciiWordCharacterCode(
        normalizedMerchant.charCodeAt(matchIndex - 1),
      );
    const followingIndex = matchIndex + text.length;
    const followingIsAsciiWord =
      followingIndex < normalizedMerchant.length &&
      isAsciiWordCharacterCode(
        normalizedMerchant.charCodeAt(followingIndex),
      );
    if (
      (
        !compiledTerm.requiresLeadingAsciiBoundary ||
        !precedingIsAsciiWord
      ) &&
      (
        !compiledTerm.requiresTrailingAsciiBoundary ||
        !followingIsAsciiWord
      )
    ) {
      return true;
    }
    matchIndex = normalizedMerchant.indexOf(text, matchIndex + 1);
  }
  return false;
}

export function compiledNormalizedMerchantTermMatches(
  normalizedMerchant: string,
  compiledTerm: CompiledNormalizedMerchantTerm,
): boolean {
  if (
    normalizedMerchant.length === 0 ||
    compiledTerm.text.length === 0
  ) {
    return false;
  }
  const matchIndex = normalizedMerchant.indexOf(compiledTerm.text);
  return matchIndex !== -1 &&
    compiledTermMatchesFromIndex(
      normalizedMerchant,
      compiledTerm,
      matchIndex,
    );
}

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

  const matchIndex = normalizedMerchant.indexOf(normalizedTerm);
  if (matchIndex === -1) return false;
  return compiledTermMatchesFromIndex(
    normalizedMerchant,
    compileNormalizedMerchantTerm(normalizedTerm),
    matchIndex,
  );
}
