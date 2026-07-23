# Plan 114 — Cycle 9 Calculation Matching and Determinism

**Findings:** C9-001 (Medium/High), C9-005 (Medium/High)
**Status:** completed (archived)
**Deploy mode:** none

## Evidence

- `merchantAllowlistMatches()` normalizes an authored alias and then uses
  unrestricted `includes()`. The current supported `CU` rule therefore pays
  on unrelated Latin tokens containing `cu`, and the allowlist match bypasses
  category checks.
- The optimizer orders rows by amount, merchant, and date only. Reward-relevant
  ties retain input/file order and mutate cap state differently; the current
  two-card probe returns 900 or 500 won solely from transaction permutation.
- The existing merchant catalog test observes `unsupportedRules`, not the
  calculated reward, and therefore cannot detect supported false positives.

## Outcome

Merchant allowlists distinguish intended aliases from embedded Latin tokens,
and optimization is invariant to file/input permutation for every
reward-relevant transaction fact.

## Implementation

1. Replace unrestricted Latin-token matching with a shared normalized matcher:
   aliases whose leading or trailing edge is ASCII alphanumeric require the
   corresponding ASCII token boundary. Keep explicit substring behavior for
   Korean/descriptive aliases where it is required by current authored data.
2. Exercise every short Latin catalog alias against intended merchant variants
   and near-collision tokens. The negative oracle must assert zero reward, not
   merely an empty diagnostic list.
3. Define one deterministic transaction comparator over every immutable fact
   consumed by reward calculation: amount, normalized merchant, date,
   category/subcategory, payment/channel, fuel facts and provenance,
   installments, exclusion tags, currency, raw category, and memo.
4. Use ASCII/canonical comparison rather than locale-dependent order or
   upload-derived IDs. Equal reward facts may remain equivalent only when
   their exchange cannot change any financial or disclosure output.
5. Add permutation tests for category, subcategory, channel, payment type,
   fixed-per-day/max-use rules, category caps, and global caps.

## Acceptance

- [x] `CU` matches intended CU statement variants but not `SECURITY SERVICE`,
      `CULTURE CENTER`, or `CUBAN RESTAURANT`.
- [x] Short Latin catalog aliases have reward-output negative tests.
- [x] Permuting tied reward-relevant rows preserves the full financial
      optimization result and produces stable disclosures.
- [x] Existing Korean merchant aliases and catalog data remain valid.

## Execution note

No registered `ralph` skill exists in either available skill root. Prompt 3
will use a manual red-green loop: reproduce each failure, implement the
smallest shared boundary, run focused catalog/calculator/optimizer tests, then
run the full gate matrix. Commits remain fine-grained, semantic, gitmoji,
GPG-signed, verified, and limited to the no-deploy branch.

## Completion evidence

- Reward-output tests cover intended and colliding short Latin merchant
  aliases, and a canonical reward-fact comparator makes optimizer output
  invariant to input permutation.
- Focused core tests passed with 243 tests, and the final repository gate
  matrix passed, including 2,870 Vitest tests and 96 Playwright tests.
