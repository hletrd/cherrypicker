# Cycle 50 Comprehensive Review

**Date:** 2026-04-21
**Reviewer:** General-purpose agent (full re-read of all source files, gate verification, cross-file interaction analysis)

---

## Methodology

Full re-read of all source files in `packages/core/`, `packages/parser/`, `packages/rules/`, `packages/viz/`, `apps/web/`, and `tools/`. Cross-file interaction analysis. Verification of all prior open findings from cycles 1-49.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-49 findings are confirmed fixed except as noted in the aggregate.

---

## New Findings

### C50-01: `maxPercentage` initial value of 1 in CategoryBreakdown can distort bar widths for small datasets

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:129`
- **Description:** When `categories` is non-empty, `maxPercentage` is derived from `categories.reduce((max, c) => Math.max(max, c.percentage), 1)`. The initial value of `1` (meaning 1%) means that when all categories have percentages below 1%, bars are sized relative to 1% rather than the actual max. This makes bars appear artificially large in very small datasets. The initial value should be the actual maximum or 0 (with a guard against division-by-zero), not a hardcoded 1.
- **Failure scenario:** A dataset with only tiny categories (all < 1%) shows bars that fill 100% width because the max is clamped to 1%.
- **Fix:** Change initial value from `1` to `0` and add `|| 1` guard in the bar width calculation: `const maxPct = maxPercentage || 1;`.
- **Note:** This is the same issue as C41-04/C42-03/C43-03/C49-03 which was previously reported but remains open.

### C50-02: `savingsPct` shows `Infinity` badge text that could confuse screen readers

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:108-109, 231-235`
- **Description:** When `savingsPct === Infinity`, the template renders a badge with text "최적 조합만 혜택". The comment says this branch is "currently unreachable" (C28-04). While the badge text is reasonable, the `savingsPct` value being `Infinity` means that if any future code path reads `savingsPct` as a number (e.g., for ARIA live region announcements), it would announce "Infinity percent" which is not meaningful. The badge should use a string sentinel like `'infinite'` instead of the numeric `Infinity` value.
- **Failure scenario:** A screen reader or assistive technology consuming `savingsPct` as a numeric value would get `Infinity`, which has no meaningful interpretation for users.
- **Fix:** Replace `return Infinity` with `return 'infinite' as unknown as number` (or better, type `savingsPct` as `number | 'infinite'` and handle both in the template).

### C50-03: `getCardById` O(n) scan could be replaced with Map index

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/lib/cards.ts:280-307`
- **Description:** `getCardById` iterates through all issuers and their cards linearly. With 10 issuers and ~683 cards, this is O(n) per call. The function is called once per `CardDetail` mount and once per card in `CardGrid`. At current scale this is fast enough (< 1ms), but building a `Map<string, CardRuleSet>` during `loadCardsData()` would make this O(1).
- **Note:** This is the same issue as D-111. Re-confirmed as still present.

### C50-04: CSV `parseAmount` returns `null` for zero input but `isValidAmount` skips zero anyway

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/lib/parser/csv.ts:38-49, 62-74`
- **Description:** `parseAmount("0")` returns `0` (not null), then `isValidAmount(0, ...)` returns false because `amount <= 0`. This is correct behavior but the two-step pattern is confusing: the `null` return from `parseAmount` is documented as "unparseable" but `0` is a parseable value that gets rejected by the next step. The code comments explain this well (C37-02) but the conceptual split between "unparseable" (null) and "not optimizable" (<=0) could benefit from a brief type alias or wrapper type to make the distinction explicit in the API.
- **Fix:** No code change needed — the comments already document this well. Noting as a code quality observation, not a bug.

### C50-05: `cardBreakdown` in SavingsComparison re-derives from assignments instead of using `cardResults`

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:24-45`
- **Description:** `cardBreakdown` is derived by aggregating `assignments` (spending + reward per card), but the same data is already available in `analysisStore.cardResults` (which is computed by `buildCardResults` in the optimizer). The re-derivation produces the same values for `spending` and `reward` but computes `rate` as `reward / spending` which matches `effectiveRate` in `cardResults`. This is redundant computation, not a bug.
- **Fix:** Replace the `cardBreakdown` derivation with a simple mapping from `analysisStore.cardResults`. This would also ensure consistency if `cardResults` computation ever changes.
- **Note:** Previously flagged as D-53 (documentation concern). The redundancy is more significant than noted there — it's not just a documentation gap but actual duplicated computation.

### C50-06: `formatWon` does not handle negative amounts with correct Korean grammar

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/lib/formatters.ts:5-10`
- **Description:** `formatWon(-5000)` produces "-5,000원" which is grammatically correct in Korean for financial statements but visually different from how Korean banking apps typically display negative amounts (they usually use parentheses: "(5,000원)"). The `parseAmount` functions in the parsers handle parenthesized input, but `formatWon` does not produce parenthesized output.
- **Failure scenario:** A negative savings value (cherry-picking is worse than single card) displays as "-5,000원" instead of the more natural "(5,000원)".
- **Fix:** This is a UX preference, not a bug. If desired, add a `formatWonNegative` variant or an option to `formatWon`.

### C50-07: XLSX `parseXLSX` returns first sheet with transactions but ignores potentially better sheets

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/lib/parser/xlsx.ts:282-293`
- **Description:** When iterating sheets, the parser returns the first sheet that yields transactions (`return result` at line 288). If a multi-sheet workbook has a summary sheet with few transactions and a detail sheet with many, the summary sheet could be returned first. This is unlikely for Korean credit card XLSX exports (typically single-sheet), but the early return prevents checking remaining sheets.
- **Fix:** Track the best result (most transactions) across all sheets instead of early-returning. This is a robustness improvement, not a current bug.

### C50-08: `VisibilityToggle` $effect directly mutates DOM — still open

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/ui/VisibilityToggle.svelte`
- **Description:** This was flagged as C18-01 and remains open. The $effect in VisibilityToggle directly mutates the DOM instead of using Svelte's reactive bindings. This can cause hydration mismatches in SSR contexts.
- **Note:** Re-confirming as still open per the aggregate.

---

## Final Sweep: Commonly Missed Issues

1. **No new security issues found.** The CSP fix from a recent cycle is intact. No secrets in source. No unsafe eval patterns.
2. **No new race conditions found.** The AbortController pattern in cards.ts handles cancellation correctly.
3. **No new data-loss risks.** The sessionStorage truncation handles the quota-exceeded case correctly.
4. **All NaN guards are in place.** `parseAmount` returns `null` for NaN across all parsers. `isOptimizableTx` checks `Number.isFinite`.
5. **Date validation is consistent.** `parseDateStringToISO` validates month/day ranges across all formats.
6. **No new dead code.** The `isSubstringSafeKeyword` removal (C49-01) was confirmed — the function is dead code superseded by `SUBSTRING_SAFE_ENTRIES`.

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C50-01 | LOW | HIGH | `CategoryBreakdown.svelte:129` | `maxPercentage` initial value 1 distorts small-dataset bars (same as C41-04/C42-03/C43-03/C49-03) |
| C50-02 | LOW | MEDIUM | `SavingsComparison.svelte:108` | `savingsPct` returns numeric `Infinity` instead of string sentinel |
| C50-03 | LOW | HIGH | `cards.ts:280-307` | `getCardById` O(n) linear scan (same as D-111) |
| C50-04 | LOW | MEDIUM | `csv.ts:38-74` | `parseAmount`/`isValidAmount` split is conceptually confusing but well-documented |
| C50-05 | LOW | HIGH | `SavingsComparison.svelte:24-45` | `cardBreakdown` re-derives from assignments instead of using `cardResults` |
| C50-06 | LOW | HIGH | `formatters.ts:5-10` | `formatWon` uses minus sign for negatives instead of Korean banking convention |
| C50-07 | LOW | MEDIUM | `xlsx.ts:282-293` | XLSX parser returns first sheet with transactions, not the best |
| C50-08 | LOW | HIGH | `VisibilityToggle.svelte` | $effect directly mutates DOM (same as C18-01, still open) |
