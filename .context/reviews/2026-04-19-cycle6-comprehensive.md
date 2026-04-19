# Comprehensive Code Review — Cycle 6 (2026-04-19)

**Reviewer:** multi-angle (code quality, perf, security, debugger, architect, designer, test, verifier)
**Scope:** Full repository — all packages, apps, tools, e2e, tests
**Focus:** New findings beyond cycles 1-5; verification of cycle 5 fixes

---

## Verification of Cycle 5 Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| C5-01/C5-09: `reoptimize()` not incrementing `generation` | **FIXED** | `generation++` added at line 282 in `store.svelte.ts` |
| C5-02: `loadFromStorage` doesn't restore `transactions` | **FIXED** | `transactions` added to `PersistedAnalysisResult` type (line 93), persisted (line 113), loaded with validation (lines 127-160), and MAX_PERSIST_SIZE with tx omission fallback (lines 98-122) |
| C5-03: OptimalCardMap keyboard a11y | **FIXED** | `role="button"`, `tabindex="0"`, `aria-expanded`, `onkeydown` for Enter/Space at lines 92-98 |

**Cycle 5 findings still open (LOW, deferred):** C5-04, C5-05, C5-06, C5-07, C5-08

---

## New Findings

### C6-01: `cardBreakdown` rate calculation uses first assignment's rate instead of weighted average

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:33-40`
- **Description:** When multiple assignments share the same card, `cardBreakdown` accumulates `spending` and `reward` correctly but initializes `rate` from only the first assignment's rate (line 38: `rate: a.rate`). After accumulation, line 44 recalculates `rate: entry.spending > 0 ? entry.reward / entry.spending : 0`, which IS correct. However, the initial value at line 38 is misleading during the loop — it's overwritten at line 42-45 but only if the `else` branch (first encounter) is taken. On subsequent encounters (line 30-31), only `spending` and `reward` are accumulated; `rate` stays at the stale initial value from the first assignment until the `.map()` at line 42. This works correctly in practice because the `.map()` at line 42 always recomputes. However, if a future developer moves or removes the `.map()`, the rate would be wrong. More importantly, the `rate` field on the `CardBreakdown` interface is redundant with the derived rate and could be a source of bugs.
- **Failure scenario:** A developer sees `rate: a.rate` on line 38 and assumes the rate is meant to be the first assignment's rate. They remove the `.map()` at line 42 thinking it's redundant. Now all cards with multiple category assignments show only the rate from their first category instead of the effective weighted rate.
- **Fix:** Remove the `rate` field from the `CardBreakdown` interface and the initial `rate: a.rate` at line 38. Compute it only in the `.map()` at line 42. This makes it clear the rate is always derived, never stored.

### C6-02: `persistToStorage` silently truncates transactions on oversize without any indicator

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:96-125`
- **Description:** When the serialized payload exceeds `MAX_PERSIST_SIZE` (4MB), the code omits `transactions` and saves the rest (lines 118-119). This is correct behavior — without it, the entire save would fail. However, there's no indicator anywhere in the store or UI that transactions were not persisted. After a page reload, `loadFromStorage` will restore the optimization result but `transactions` will be `undefined`, and the TransactionReview component will show the "거래 상세 내역은 현재 브라우저 세션 메모리에만 보관되고" notice. The user has no way to know that their data was partially saved — the dashboard shows savings numbers but the transaction list is empty. This extends C5-07 (quota exceeded with no feedback) with a more specific failure mode.
- **Failure scenario:** User uploads a large statement (500+ transactions). The serialized payload exceeds 4MB. `persistToStorage` saves without transactions. User navigates to another page and comes back. The dashboard shows optimization results, but TransactionReview shows the "data not persisted" notice. User is confused because they didn't close the tab — they just navigated away briefly.
- **Fix:** Add a `persistWarning` field to the store that is set when transactions are omitted or when the save fails entirely. Show a banner on the dashboard when `persistWarning` is true, similar to the existing data-loss warning in SpendingSummary.

### C6-03: `SavingsComparison` count-up animation doesn't clean up on re-render

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:53-68`
- **Description:** The `$effect` that drives the count-up animation (lines 53-68) creates a `requestAnimationFrame` loop and returns a cleanup function that cancels it. This is correct Svelte 5 effect cleanup behavior. However, when `opt?.savingsVsSingleCard` changes (e.g., after `reoptimize`), the effect re-runs and starts a NEW animation from 0, even though the displayed value might have already been close to the new target. This creates a jarring visual: the counter drops to 0 then animates back up. For small changes (e.g., user recategorized one transaction), the counter should smoothly animate to the new value instead of resetting.
- **Failure scenario:** User sees "추가 절약 15,000원" after analysis. They change one transaction's category and click "변경 적용". The counter drops to 0 then animates back up to "14,500원" over 800ms, which looks like a glitch rather than a smooth update.
- **Fix:** Track the previous target value and start the animation from the current `displayedSavings` instead of 0. Use the cleanup function to capture the current displayed value:
  ```ts
  let prevSavings = 0;
  $effect(() => {
    const target = opt?.savingsVsSingleCard ?? 0;
    if (target === 0) { displayedSavings = 0; prevSavings = 0; return; }
    const startVal = prevSavings;
    // ... animate from startVal to target
    prevSavings = target;
  });
  ```

### C6-04: `findRule` subcategory blocking is too aggressive — wildcard category `*` bypasses it

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/calculator/reward.ts:81`
- **Description:** The subcategory blocking rule (line 81: `if (tx.subcategory && !rule.subcategory && rule.category !== '*') return false;`) correctly exempts wildcard (`*`) rules. However, this means a wildcard rule like `{ category: '*', rate: 0.5% }` would match a transaction with `category: 'dining', subcategory: 'cafe'` even when there's a specific `cafe` rule that should take precedence. The `ruleSpecificity` function (lines 53-61) gives wildcard rules score 0 (no category, no subcategory), while specific rules get score 100+. So the specific rule should win in the sort. But if the specific rule has a lower rate (e.g., cafe 1% vs wildcard 0.5%), the specific rule still correctly wins because `findRule` returns the most specific rule, not the highest rate. This is actually correct behavior — the wildcard is a fallback. However, the subcategory blocking logic creates a subtle asymmetry: a broad `dining` rule (score 100) is blocked for subcategorized `cafe` transactions, but a wildcard rule (score 0) is NOT blocked. This means `cafe` transactions can get a wildcard rate when there's no specific `cafe` rule, but they CANNOT get a `dining` rate. This is intentional for Korean card terms (where "dining" usually excludes cafe), but the asymmetry is undocumented and could surprise developers.
- **Failure scenario:** A card has rules for `dining` (5%) and wildcard (0.5%) but no `cafe` rule. A `cafe` transaction gets 0.5% (wildcard) instead of 5% (dining). This is correct for Korean card terms but might be wrong for cards where "dining" includes cafe.
- **Fix:** Add a code comment at line 81 explaining the wildcard exemption rationale. No logic change needed — this is a documentation issue.

### C6-05: `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction — O(2n) instead of incremental

- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:84-110`
- **Description:** For each transaction, `scoreCardsForTransaction` computes the marginal reward by calling `calculateCardOutput` once for the "before" state (line 96) and once for the "after" state (line 97). Since `calculateCardOutput` iterates over ALL previously assigned transactions for that card, this is O(k) per call where k is the number of previously assigned transactions. For n transactions and m cards, the total time is O(n * m * k_avg), where k_avg grows linearly. This is the same as D-09 (already deferred as LOW). However, the new observation is that the `before` call is always the same as the `after` call from the previous transaction's assignment — the "before" state of card C for transaction t+1 is exactly the "after" state of card C when transaction t was evaluated (if t was assigned to C). Caching the last `calculateCardOutput` result per card would halve the number of `calculateCardOutput` calls. But this optimization is complex because the greedy algorithm assigns each transaction to the best card, invalidating the cache for that specific card only.
- **Failure scenario:** With 500 transactions and 10 cards, `calculateCardOutput` is called 10,000 times (2 * 500 * 10). Each call iterates over all previously assigned transactions. The total work is O(n^2 * m). For typical use cases (< 200 transactions, < 10 cards), this is < 400ms and acceptable.
- **Fix:** Low priority. If performance becomes an issue for large statement sets, cache the previous `calculateCardOutput` result per card and invalidate only when a new transaction is assigned to that card.

### C6-06: `parseXLSX` decodes entire buffer as UTF-8 for HTML detection even for binary XLSX

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/xlsx.ts:272-273, 290-291`
- **Description:** `isHTMLContent` (line 272) decodes the first 512 bytes of the buffer as UTF-8. If the file is a binary XLSX (which starts with a ZIP header `PK\x03\x04`), this decode is wasted work. Additionally, for actual HTML-as-XLS files, the full buffer is decoded again at line 291 (`new TextDecoder('utf-8').decode(buffer)`). For large XLSX files (5-10MB), this double-decode is noticeable.
- **Failure scenario:** User uploads a 10MB binary XLSX file. `isHTMLContent` decodes 512 bytes as UTF-8 (fast, acceptable). Then `XLSX.read` processes the binary data. No double-decode occurs for binary files — only the 512-byte check is wasted. For HTML-as-XLS files, the full buffer is decoded twice (once in `isHTMLContent`, once at line 291), which is redundant.
- **Fix:** Cache the decoded HTML string from `isHTMLContent` and pass it to the HTML normalization path, avoiding the second decode. Alternatively, check the ZIP magic bytes first (`PK\x03\x04`) and skip HTML detection entirely for binary XLSX files.

### C6-07: `TransactionReview` AI categorizer doesn't clear subcategory when changing category

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:99-104`
- **Description:** The manual `changeCategory` function (line 149-157) correctly clears `tx.subcategory = undefined` after changing the category (line 153). However, the AI categorizer (lines 97-107) sets `tx.category = result.category` (line 102) and `tx.confidence = result.confidence` (line 103) but does NOT clear `tx.subcategory`. If the previous category was `dining` with subcategory `cafe`, and the AI changes the category to `transportation`, the subcategory remains `cafe`, which is semantically incorrect and would cause the optimizer to find a matching rule for `transportation.cafe` — a category that likely doesn't exist, resulting in no reward.
- **Failure scenario:** User has a transaction categorized as `dining/cafe`. The AI categorizer reclassifies it as `transportation`. The subcategory remains `cafe`. The optimizer looks for a rule matching `transportation.cafe` and finds none, assigning 0 reward for this transaction.
- **Fix:** Add `tx.subcategory = undefined;` after `tx.category = result.category;` on line 102, matching the pattern in `changeCategory`.

### C6-08: `cardBreakdown` in SavingsComparison includes cards with 0 spending

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:24-46`
- **Description:** The `cardBreakdown` derived value iterates over `assignments` and accumulates spending/reward per card. Since `assignments` only contains categories that were assigned to cards, every entry has `spending > 0`. However, the `cardResults` from the optimization might include cards with 0 assigned transactions (they're filtered out in `buildCardResults` at `greedy.ts:179`). So in practice, `cardBreakdown` is correct — it only includes cards that have at least one assignment. But the `uniqueCards` count (line 12-13) counts unique card IDs from assignments, which is also correct. This is a non-issue in the current implementation, but noting for completeness that if `cardResults` were ever used instead of `assignments`, cards with 0 spending would appear.
- **Failure scenario:** No failure in current code. This is a documentation note for future maintainers.
- **Fix:** No fix needed. Add a code comment clarifying that `cardBreakdown` derives from `assignments` (not `cardResults`) to ensure only cards with actual spending are shown.

### C6-09: `loadCategories` fetch doesn't deduplicate concurrent calls

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/cards.ts:159-173`
- **Description:** `loadCategories` uses a `categoriesPromise` cache (line 138) to deduplicate concurrent calls, similar to `loadCardsData`. However, if the fetch fails, the catch block sets `categoriesPromise = null` (line 168), allowing retries. If two components call `loadCategories` simultaneously while a previous fetch is in-flight, they both get the same promise (correct). But if the fetch fails and two components call it simultaneously immediately after the failure, the first call sets `categoriesPromise` and the second call gets the same promise (correct). However, if the first call's fetch has already failed and set `categoriesPromise = null`, and two calls happen before either sets the new promise, they could both start independent fetches. In practice, JavaScript's single-threaded execution makes this extremely unlikely — the microtask queue ensures only one fetch starts at a time. This is the same class as D-07 (already deferred as LOW).
- **Failure scenario:** Theoretically, if `loadCategories` is called from two `onMount` callbacks in the same microtask, and the previous fetch just failed, two fetches could start. Both would succeed and set `categoriesPromise` to the same resolved value. No data corruption, just a wasted request.
- **Fix:** No fix needed for the current architecture. If request deduplication becomes critical, use a proper caching library.

### C6-10: `inferYear` duplicated between `csv.ts` and `xlsx.ts` — behavioral divergence risk

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:29-37`, `apps/web/src/lib/parser/xlsx.ts:183-190`
- **Description:** The `inferYear` function is duplicated between `csv.ts` and `xlsx.ts`. The implementations are identical, but they could diverge over time if one is updated without the other. This is the same finding as D-35 (deferred as LOW from cycle 3). The duplication is acknowledged but the risk of divergence increases as the codebase evolves. For example, if a bug is found in one copy and fixed but not the other, the CSV and XLSX parsers would produce different dates for the same input.
- **Failure scenario:** A bug is found in `inferYear` in `csv.ts` and fixed, but the same bug in `xlsx.ts` is not. CSV uploads produce correct dates for short-date formats, but XLSX uploads produce incorrect dates.
- **Fix:** Extract `inferYear` and `parseDateToISO` to a shared `date-utils.ts` file in the parser directory, importing from both `csv.ts` and `xlsx.ts`. This was the exit criterion in D-35.

### C6-11: `SavingsComparison` effective rate display assumes decimal form (0.015) not percentage form (1.5)

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:161`
- **Description:** Line 161 displays `{(opt.effectiveRate * 100).toFixed(2)}%`, which multiplies by 100. This is correct if `effectiveRate` is in decimal form (0.015 → "1.50%"). The `greedyOptimize` function computes `effectiveRate: totalSpending > 0 ? totalReward / totalSpending : 0` (line 254), which is indeed in decimal form. So the display is correct. However, there's an inconsistency: `formatRate()` in `formatters.ts` also multiplies by 100 (line 15), but `SavingsComparison` doesn't use `formatRate` for this field — it does the math inline. If `formatRate` were used, it would produce "1.5%" instead of "1.50%" (one decimal vs two). The inline approach gives more precision (2 decimal places), which is better for this field. But the inconsistency means a future developer might switch to `formatRate` and lose precision.
- **Failure scenario:** Developer sees inline `* 100` calculation and refactors to use `formatRate(opt.effectiveRate)`, which produces "1.5%" instead of "1.50%". The precision loss makes the effective rate display less precise.
- **Fix:** Add a `formatRatePrecise(rate)` helper to `formatters.ts` that formats with 2 decimal places, and use it consistently. Or add a code comment noting the intentional 2-decimal precision.

---

## Summary of New Findings

| ID | Severity | Confidence | Category | Description |
|----|----------|------------|----------|-------------|
| C6-01 | MEDIUM | High | code-quality | `cardBreakdown` stores stale initial `rate` before recalculation — fragile pattern |
| C6-02 | MEDIUM | High | UX | `persistToStorage` silently truncates transactions on oversize — no indicator |
| C6-03 | LOW | High | UX/perf | Count-up animation resets to 0 on re-render instead of smooth transition |
| C6-04 | LOW | Medium | docs | `findRule` wildcard exemption from subcategory blocking is undocumented |
| C6-05 | LOW | High | perf | `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction |
| C6-06 | LOW | High | perf | XLSX HTML detection decodes buffer twice for HTML-as-XLS files |
| C6-07 | MEDIUM | High | bug | AI categorizer doesn't clear subcategory when changing category |
| C6-08 | LOW | Medium | docs | `cardBreakdown` derivation source should be documented |
| C6-09 | LOW | Medium | perf | `loadCategories` fetch deduplication gap (same as D-07) |
| C6-10 | LOW | High | DRY | `inferYear` duplicated across csv.ts and xlsx.ts — divergence risk (extends D-35) |
| C6-11 | LOW | High | consistency | `SavingsComparison` inline rate formatting vs `formatRate()` — precision mismatch |

---

## Prioritized Action Items

### HIGH (should fix this cycle)
1. C6-07: Add `tx.subcategory = undefined;` to AI categorizer result application (1-line fix)
2. C6-01: Remove redundant `rate` field from `CardBreakdown` interface initialization
3. C6-02: Add `persistWarning` indicator when transactions are truncated from sessionStorage save

### MEDIUM (plan for next cycles)
4. C6-03: Smooth count-up animation transition on re-render
5. C6-11: Add `formatRatePrecise` helper or document inline rate formatting intent

### LOW (defer or accept)
- C6-04, C6-05, C6-06, C6-08, C6-09, C6-10

---

## Deferred items carried forward from Cycle 5

The following LOW-severity items from cycle 5 remain deferred and are not re-listed with new IDs:
- C5-04: FileDropzone success navigation uses full page reload
- C5-05: CategoryBreakdown hardcoded colors missing `traditional_market`
- C5-06: FileDropzone duplicate file detection by name only
- C5-07: SessionStorage quota exceeded — no user feedback
- C5-08: `inferYear` uses `new Date()` — non-deterministic in tests

All deferred items from cycles 1-4 (D-01 through D-44) remain unchanged.
