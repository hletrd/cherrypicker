# Debugger Review — Cycle 3 (2026-04-19)

**Reviewer:** debugger
**Scope:** Latent bug surface, failure modes, regressions

---

## Findings

### C3-D01: `loadFromStorage` does not validate `monthlyBreakdown` shape

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:140`
- **Description:** When loading from sessionStorage, the `monthlyBreakdown` field is passed through without any structural validation. If the stored data is corrupted (e.g. `monthlyBreakdown` is a string instead of an array), the component that renders it (`SpendingSummary.svelte` line 97-101) will access `.length` on a non-array value, throwing a runtime error.
- **Failure scenario:** Corrupted sessionStorage entry (e.g. manual developer tools edit) sets `monthlyBreakdown` to `"corrupted"`. On page load, `SpendingSummary` renders and `analysisStore.result.monthlyBreakdown.length > 1` throws TypeError.
- **Fix:** Add a type guard for `monthlyBreakdown`: `Array.isArray(parsed.monthlyBreakdown) ? parsed.monthlyBreakdown : undefined`.

### C3-D02: `scoreCardsForTransaction` produces wrong reward when `calculateRewards` returns 0 due to cap

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `packages/core/src/optimizer/greedy.ts:84-110`
- **Description:** The marginal reward calculation `after - before` can produce 0 for a transaction even when the card has a matching rule, if the card's monthly cap was already hit. This means the optimizer will assign 0 marginal reward to all remaining cards for that category, and may assign the transaction to a card that also gives 0 reward (just because it's first in the sorted list). The transaction then shows up in the results with `reward: 0` and `rate: 0`, which is correct from a reward perspective but misleading — the user might think the optimizer is broken because a transaction got assigned to a card with 0 reward.
- **Failure scenario:** A card with a 10,000 Won monthly cap already has 10,000 Won in rewards. The next transaction in the same category gets `reward: 0` from this card. All other cards also give 0 for this category. The optimizer assigns the transaction to the first card in the sorted list, which happens to be the one with the already-hit cap. The user sees a category assigned to a card with 0% reward.
- **Fix:** When all cards give 0 marginal reward for a transaction, consider assigning it to the card that would have the highest uncapped reward (best theoretical rate), or at minimum annotate the assignment to indicate "cap reached."

### C3-D03: `analyzeMultipleFiles` previous-month spending calculation is wrong for single-file uploads

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:214-218`
- **Description:** When only one month's data is uploaded, `previousMonth` is `null` and the code falls back to `options?.previousMonthSpending ?? monthlySpending.get(latestMonth)!`. This means if the user does NOT provide a `previousMonthSpending` value, the current month's total spending is used as the previous month's spending estimate. However, the `performanceExclusions` filtering that was implemented in `optimizeFromTransactions` (lines 150-163) is bypassed here — the raw total spending (without exclusion filtering) is used as the `previousMonthSpending` option, which then gets applied uniformly to all cards in `optimizeFromTransactions` (line 153).
- **Failure scenario:** User uploads a single month's statement with 500,000 Won total spending but 50,000 Won in excluded categories. The previousMonthSpending should be 450,000 for most cards, but instead it's 500,000 because the exclusion filtering only happens inside `optimizeFromTransactions` when `options.previousMonthSpending` is undefined. Since this code path SETS `options.previousMonthSpending`, the exclusion filtering is skipped.
- **Fix:** When computing the fallback `previousMonthSpending` for single-file uploads, do NOT set it as an explicit option. Instead, pass `undefined` and let `optimizeFromTransactions` compute per-card spending with exclusions. Alternatively, compute the exclusion-adjusted spending here.

### C3-D04: E2E test `ui-ux-review.spec.js` uses `require('fs').writeFileSync` for temp file

- **Severity:** LOW
- **Confidence:** High
- **File:** `e2e/ui-ux-review.spec.js:194-197`
- **Description:** (Already noted as C2-T06.) The temp file `/tmp/test-invalid.txt` is created but never cleaned up. Additionally, writing to `/tmp` may fail on some CI environments where the filesystem is read-only or sandboxed.
- **Fix:** Use `os.tmpdir()` and clean up in `afterEach`.

### C3-D05: `inferYear` in csv.ts and xlsx.ts could produce wrong year near midnight on Dec 31

- **Severity:** LOW
- **Confidence:** Low
- **File:** `apps/web/src/lib/parser/csv.ts:29-37`, `apps/web/src/lib/parser/xlsx.ts:183-190`
- **Description:** The `inferYear` function uses `new Date()` to get the current year and compares the candidate date against "now + 90 days." If a user uploads a December statement at exactly midnight on January 1st, the function might assign the wrong year. The 90-day window is generous enough that this is unlikely in practice.
- **Failure scenario:** At 00:01 on January 1st, a user uploads a statement with dates in December. `inferYear(12, 15)` computes `new Date(2026, 11, 15)` which is NOT more than 90 days in the future from Jan 1, so it correctly returns 2026. This is actually correct. The only edge case would be dates in January/February of the new year, which would also be handled correctly by the 90-day heuristic.
- **Fix:** No fix needed for this — the heuristic is correct for the stated purpose. Logging for awareness only.

### C3-D06: `reoptimize` in store.svelte.ts can set result to stale state

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:229-243`
- **Description:** When `reoptimize` is called, it updates `result` with `{ ...result, transactions: editedTxs, optimization }`. However, if `result` is `null` (e.g. the store was reset between the time the user started editing and clicked "apply"), the `if (result)` guard prevents the update, but the `loading` and `error` states are still managed. More critically, if the user navigates away from the dashboard and back, `result` may have been loaded from sessionStorage with different data than `editedTxs` was based on. The spread `{ ...result, transactions: editedTxs }` would combine the new sessionStorage data with the old edited transactions.
- **Failure scenario:** User uploads file, edits categories, navigates to results page, navigates back to dashboard. The store reloads from sessionStorage (with original categories), but `editedTxs` still has the user's edits. If the user clicks "apply", the old edits are applied to the new store state.
- **Fix:** Track a version/generation ID on the store result and the edited transactions. Only apply edits if the versions match.
