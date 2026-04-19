# Comprehensive Code Review — Cycle 9 (2026-04-19)

**Reviewer:** multi-angle (code quality, perf, security, debugger, architect, designer, test, verifier)
**Scope:** Full repository — all packages, apps, tools, e2e, tests
**Focus:** New findings beyond cycles 1–8; deep analysis of edge cases and cross-file interactions

---

## Verification of Cycle 8 Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| C8-02+C8-03: PDF Korean/short-date patterns in fallback and findDateCell | **FIXED** | `fallbackDatePattern` and `findDateCell` both include Korean and short-date regexes |
| C8-11: Reset `_loadPersistWarningKind` after consumption and in reset() | **FIXED** | `_loadPersistWarningKind = null` after consumption (line 237) and in reset() (line 359) |
| C8-01: NaN guard in SpendingSummary formatPeriod | **FIXED** | `Number.isNaN(smNum) || Number.isNaN(emNum)` guard at line 22 |
| C8-09: Category labels cached in store and passed through reoptimize | **FIXED** | `cachedCategoryLabels` and `getCategoryLabels()` in store; passed to `optimizeFromTransactions` |

All cycle 8 fixes verified as correctly implemented.

---

## New Findings

### C9-01: `toCoreCardRuleSets` cache uses reference equality that never hits for re-fetched rules

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/analyzer.ts:191-194`
- **Description:** The cache check `cachedRulesRef !== cardRules` compares by reference. When `getAllCardRules()` is called, it returns `data.issuers.flatMap(issuer => issuer.cards)`, which creates a new array every time. This means `cachedRulesRef` will never be the same reference as the newly fetched `cardRules`, so the cache is always invalidated and `toCoreCardRuleSets` re-runs every call. This is the same issue as D-61 but affects a different cache layer — the `toCoreCardRuleSets` transformation is O(n*m) where n=683 cards and m=average rewards per card. While still fast (~1ms), the cache was explicitly designed to avoid this re-computation but never actually works.
- **Failure scenario:** User calls `optimizeFromTransactions` (via reoptimize), which calls `getAllCardRules()` -> `loadCardsData()` -> resolves cached promise -> `flatMap` produces new array -> reference differs from `cachedRulesRef` -> entire `toCoreCardRuleSets` runs again. On every reoptimize, this transformation repeats unnecessarily.
- **Fix:** Cache the transformation result independently of the rules reference. For example, use a version counter or simply cache the result unconditionally since the underlying `cards.json` data never changes within a session:
  ```ts
  if (!cachedCoreRules) {
    cachedCoreRules = toCoreCardRuleSets(cardRules);
  }
  // Remove the reference check entirely — rules don't change within a session
  ```

### C9-02: `SavingsComparison.svelte` `savingsPct` can show misleading "+0%" badge

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:71-75,176-180`
- **Description:** `savingsPct` computes `opt.savingsVsSingleCard / opt.bestSingleCard.totalReward`. When `savingsVsSingleCard` is 0 (cherry-picking gives same reward as best single card), `savingsPct` is 0. The UI at line 176 shows `{#if savingsPct > 0}`, so the badge is hidden. However, when `savingsVsSingleCard` is a small positive number (e.g., 1 won) and `bestSingleCard.totalReward` is very large, `savingsPct` rounds to 0 via `Math.round(raw * 100)`, but the badge could show "+0%" due to floating-point imprecision if `raw * 100` is like 0.4999 and gets rounded to 0. More importantly, when `bestSingleCard.totalReward` is 0 but `totalReward` is also 0, the code at line 73 computes `0 / 0 = NaN`, which `Number.isFinite` catches and returns 0. The real issue is that when `savingsVsSingleCard` is 0 (identical optimization), the UI should explicitly show "동일" or hide the comparison section, rather than showing "+0%".
- **Failure scenario:** User's transactions all fall under a single card's categories. Cherry-picking gives the same reward as that single card. The "추가 절약" card shows "+0원" with no percentage badge (correct), but the bar comparison still shows both bars at 100% width which is visually redundant.
- **Fix:** When `savingsVsSingleCard` is 0, consider showing a different message like "카드 한 장과 동일해요" instead of the comparison UI. This is a UX enhancement, not a bug.

### C9-03: `detectBank` tie-breaking is undefined — first bank with equal score wins

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/detect.ts:114-137`
- **Description:** When two banks have the same `bestScore`, the first one in `BANK_SIGNATURES` order wins because the comparison at line 127 uses `>` (strict greater than). This means if a document mentions both "삼성카드" and "신한카드" exactly once each, `samsung` (index 4) wins over `shinhan` (index 5) purely due to array ordering. More problematically, if "신협" appears in a document that also mentions "우체국" once each, `cu` (index 21) with 1/1 = 1.0 confidence would beat `epost` (index 23) with 1/1 = 1.0 confidence based on array position. The tie-breaking should prefer the bank with more matched patterns (absolute score), or at minimum, use a deterministic tie-breaking rule that's documented.
- **Failure scenario:** A document contains "신협" and "우체국" each exactly once. Both get `bestScore=1` and `confidence=1.0`. The `cu` bank wins because it appears first in `BANK_SIGNATURES`. If the document is actually a 우체국 statement that mentions 신협 in a transaction description, the wrong bank is detected.
- **Fix:** When scores are tied, break ties by (1) preferring the bank with more total patterns (higher specificity), or (2) comparing the matched patterns against document structure (e.g., patterns found in header rows beat patterns found in data rows). At minimum, document the current tie-breaking behavior.

### C9-04: PDF fallback parser's `fallbackDatePattern` uses non-capturing group structure but `dateMatch[1]` relies on first capture group

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:312-331`
- **Description:** The `fallbackDatePattern` regex is `/(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d]))/`. The entire pattern is wrapped in a single capture group `(...)`, so `dateMatch[1]` always captures the full matched date. This works correctly. However, the `SHORT_MD_DATE_PATTERN` alternative `\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d])` uses a negative lookahead. The lookahead itself is not captured, so the captured text is just the `MM/DD` part, which is correct. This finding is NOT a bug — the regex works as intended. However, the regex is quite complex and hard to maintain. A refactoring to use named groups or multiple separate pattern tests (like the structured parser does) would be more maintainable.
- **Failure scenario:** No failure scenario — this is a maintainability concern, not a bug.
- **Fix:** Refactor to use separate pattern tests instead of a single mega-regex, similar to how `findDateCell` works. This would be more readable and easier to extend.

### C9-05: `TransactionReview.svelte` `applyEdits` doesn't handle `reoptimize` returning null optimization

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:334-351`
- **Description:** In `reoptimize()`, the optimization is only applied `if (result)` at line 340. If `result` is null (which happens if the store was reset between the user clicking "변경 적용" and the reoptimize completing), the method silently does nothing — it doesn't set `loading = false` via the `finally` block... actually, it does because `finally` always runs. But the real issue is that `error` is not set, and `hasEdits` in `TransactionReview.svelte` at line 167 is set to `false` regardless, because `applyEdits` calls `await analysisStore.reoptimize(editedTxs)` then `hasEdits = false`. If reoptimize silently fails (result is null), the user's edits are lost — `hasEdits` becomes false, the "변경 적용" button disappears, and the user has no indication that their edits were discarded.
- **Failure scenario:** User edits categories, clicks "변경 적용", and simultaneously the store is reset (e.g., by navigating away and back). `reoptimize` completes but `result` is null, so the optimization isn't applied. `applyEdits` sets `hasEdits = false` regardless. The user sees their category changes but the optimization hasn't been recalculated — the dashboard shows stale data.
- **Fix:** In `reoptimize()`, set an error when `result` is null: `if (!result) { error = '분석 결과가 없어요. 다시 분석해 보세요.'; return; }`. In `applyEdits`, check `analysisStore.error` after reoptimize and restore `hasEdits = true` if an error occurred.

### C9-06: `CategoryBreakdown.svelte` `categories` derivation uses floating-point percentage that can cause "other" threshold to shift

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:78-79`
- **Description:** The percentage is computed as `Math.round((a.spending / totalSpending) * 1000) / 10`, which rounds to one decimal place. The threshold is `< 2` (2%). Due to rounding, a category at exactly 1.95% rounds to 2.0% and is included in the main list, while a category at 1.94% rounds to 1.9% and goes to "other". This means the threshold is effectively `>= 1.95%` rather than `>= 2%`. This is a minor UX issue — the threshold behavior depends on floating-point rounding.
- **Failure scenario:** A category with spending that's exactly 1.95% of total is included in the main bar chart, while a category at 1.94% goes to "other". Visually, these are indistinguishable but are categorized differently.
- **Fix:** Compare the un-rounded value: `if ((a.spending / totalSpending) * 100 < 2)` instead of `if (pct < 2)`.

### C9-07: `OptimalCardMap.svelte` `maxRate` derivation can return Infinity when all rates are 0

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:18-19`
- **Description:** `maxRate` is computed as `Math.max(...assignments.map((a) => a.rate), 0.001)`. If `assignments` is empty, `Math.max(0.001)` returns 0.001, which is correct. However, if all assignments have `rate = 0` (no rewards for any category), `Math.max(0, 0, 0, ..., 0.001)` returns 0.001, which is also correct. The `0.001` fallback prevents division by zero in the bar width calculation at line 90. This is actually well-handled — not a bug. However, there's a subtle issue: `Math.max(...array)` can cause a stack overflow for very large arrays (assignments > ~100K entries). With typical usage this won't happen, but it's worth noting.
- **Failure scenario:** Extremely unlikely — would require >100K distinct category-card assignments.
- **Fix:** No fix needed for normal usage. If ever needed, replace `Math.max(...array)` with `array.reduce((a, b) => Math.max(a, b), 0)`.

### C9-08: `SavingsComparison.svelte` `singleBarWidth` can show 0% width for best single card

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:78-82`
- **Description:** `singleBarWidth` computes `opt.bestSingleCard.totalReward / opt.totalReward * 100`. When `totalReward` is 0 (no rewards at all — all transactions in uncategorized), the guard at line 79 returns 0. The visual bar for "카드 한 장" shows 0% width while "체리피킹" shows 100% width, even though both have 0 reward. This is misleading — both bars should be empty or the entire comparison section should be hidden when `totalReward` is 0.
- **Failure scenario:** User uploads a statement where all transactions are uncategorized. All cards produce 0 reward. The comparison shows "카드 한 장" with an empty bar and "체리피킹" with a full bar, implying cherry-picking is vastly better when it's actually identical (0 won each).
- **Fix:** Hide the comparison section when `totalReward` is 0, or show a message like "혜택이 없어요" instead of the bar chart.

### C9-09: `loadCategories` promise cache is never invalidated — stale data possible after background updates

- **Severity:** LOW
- **Confidence:** Low
- **File:** `apps/web/src/lib/cards.ts:159-173`
- **Description:** `categoriesPromise` is a module-level cache that persists for the entire session. Once loaded, the categories are never re-fetched. This is correct for the current use case (static JSON served from the same origin), but could become an issue if the app ever supports dynamic category updates. This is the same pattern as D-07/D-54.
- **Failure scenario:** No realistic failure scenario with the current static JSON setup.
- **Fix:** No fix needed. Same class as D-07/D-54.

### C9-10: `parseXLSX` decodes HTML content buffer twice when it's HTML-as-XLS

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/xlsx.ts:290-294`
- **Description:** When `isHTMLContent(buffer)` returns true, the buffer is decoded once in `isHTMLContent` (to check the first 512 bytes) and again at line 291 to get the full HTML string. Then at line 293, the HTML is re-encoded with `new TextEncoder().encode(html)` before passing to `XLSX.read`. This means: (1) the buffer is decoded twice for the HTML check, and (2) the HTML is re-encoded unnecessarily. The `isHTMLContent` function already decodes the first 512 bytes — this work is thrown away. The full decode at line 291 is necessary, but the re-encode at line 293 could be avoided by passing `{ type: 'string' }` to `XLSX.read` instead of re-encoding to a Uint8Array. This is the same finding as D-52 but provides a more specific optimization.
- **Failure scenario:** Performance is negligible for files under 10MB. No visible user impact.
- **Fix:** Pass `html` directly to `XLSX.read` with `{ type: 'string' }` instead of re-encoding.

### C9-11: `isValidTx` validation is too lenient — allows empty-string fields

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:139-149`
- **Description:** `isValidTx` checks `typeof tx.date === 'string'` etc., which passes for empty strings. A transaction with `{ id: "tx-0", date: "", merchant: "", amount: 0, category: "" }` would pass validation. This is unlikely in practice because the parser always sets these fields to non-empty values, but the sessionStorage round-trip could produce such entries if the JSON was manually tampered with. Empty-string dates would cause `formatPeriod` and `formatDateKo` to display "-" (which is handled), but an empty-string category would cause the optimizer to silently skip the transaction (since `tx.category` would be "" and no reward rule matches "").
- **Failure scenario:** A manually edited sessionStorage entry has `transactions: [{ id: "tx-0", date: "", merchant: "test", amount: 1000, category: "" }]`. The validation passes, the transaction is loaded, but the optimizer skips it because no rule matches the empty category.
- **Fix:** Add non-empty checks: `typeof tx.date === 'string' && tx.date.length > 0` etc. Alternatively, add a minimum length check for critical fields.

### C9-12: `analyzer.ts` `cachedCoreRules` is a module-level singleton — persists across store resets

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/analyzer.ts:43-44`
- **Description:** `cachedCoreRules` and `cachedRulesRef` are module-level variables that are never cleared, even when the store's `reset()` method is called. This means if the underlying `cards.json` were ever updated (e.g., a new build deployed), the stale cached rules would persist until the page is refreshed. In practice, `cards.json` is a static file that doesn't change within a session, so this is not a bug. However, it's inconsistent with the store's `reset()` clearing `cachedCategoryLabels`.
- **Failure scenario:** Developer deploys an update to cards.json while a user has the page open. The user's optimizer uses stale rules from the cache. This is a theoretical concern — in practice, the user would refresh the page for a new deployment.
- **Fix:** Add a `clearCaches()` function to the analyzer module and call it from `store.reset()`.

### C9-13: `SpendingSummary.svelte` `monthlyBreakdown` array access without bounds check

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:101-106`
- **Description:** The template at line 104 accesses `analysisStore.result.monthlyBreakdown[analysisStore.result.monthlyBreakdown.length - 2]?.spending`. The guard at line 101 checks `monthlyBreakdown.length > 1`, so `length - 2` should be >= 0. However, if `monthlyBreakdown` is modified between the guard check and the access (unlikely with Svelte's reactive model but theoretically possible with direct mutation), this could access `monthlyBreakdown[-1]` which returns `undefined`, and `?.spending` returns `undefined`, which `formatWon` handles (returns "0원"). More importantly, the `length > 1` check at line 101 ensures there are at least 2 entries, so `length - 2` is at least 0. The `?.` optional chaining is correct. However, the UI shows "전월실적" (previous month spending) based on `monthlyBreakdown[length-2]`, which is the second-to-last month in the array. This is correct if months are sorted chronologically, but `monthlyBreakdown` is built from a `Map` spread which preserves insertion order. The `months` array in `analyzeMultipleFiles` is sorted, and `monthlyBreakdown` is built from `[...monthlySpending.entries()]` which follows the insertion order of the `Map`. Since `monthlySpending` is populated by iterating `allTransactions` (sorted by date), the entries should be in chronological order. But this depends on the `Map` preserving insertion order, which is guaranteed in ES6+.
- **Failure scenario:** Not a realistic failure — the code is correct under ES6+ semantics.
- **Fix:** No fix needed. The code is correct but could be made more robust by explicitly sorting `monthlyBreakdown` by month before using it.

---

## Final Sweep — Commonly Missed Issues

1. **ReDoS potential in regex patterns**: The `fallbackDatePattern` in pdf.ts uses alternation with multiple patterns. None of the patterns have quadratic backtracking, so ReDoS is not a concern here.

2. **Prototype pollution in sessionStorage**: `loadFromStorage` uses `JSON.parse` which is safe against prototype pollution in modern browsers. The parsed result is validated before use.

3. **XSS via dynamic styles**: Several components use `style="background-color: {issuerColor}"` where `issuerColor` comes from `getIssuerColor()`. Since `getIssuerColor` returns from a hardcoded map with a fallback to `'#6b7280'`, there's no XSS risk. If user input ever flows into `issuerColor`, it would need sanitization.

4. **Memory leaks from event listeners**: `FileDropzone.svelte` correctly removes event listeners in the `onMount` cleanup function. `CardDetail.svelte` doesn't clean up the fetch promise on destroy (D-62), but this is already deferred.

5. **Currency handling**: All amounts are assumed to be KRW. The optimizer at reward.ts:188 correctly skips non-KRW transactions. This is well-handled.

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C9-01 | MEDIUM | High | `analyzer.ts:191-194` | `toCoreCardRuleSets` cache never hits — reference equality always fails for re-fetched rules |
| C9-02 | LOW | High | `SavingsComparison.svelte:71-75,176-180` | `savingsPct` is 0 when optimization is identical — redundant comparison UI |
| C9-03 | MEDIUM | Medium | `detect.ts:114-137` | Bank detection tie-breaking is undefined — first-in-array wins |
| C9-04 | LOW | High | `pdf.ts:312-331` | Fallback date regex is complex and hard to maintain |
| C9-05 | MEDIUM | High | `store.svelte.ts:334-351` | `reoptimize` silently discards edits when `result` is null |
| C9-06 | LOW | Medium | `CategoryBreakdown.svelte:78-79` | Percentage rounding can shift the "other" threshold |
| C9-07 | LOW | Medium | `OptimalCardMap.svelte:18-19` | `Math.max(...array)` stack overflow risk for very large arrays |
| C9-08 | LOW | High | `SavingsComparison.svelte:78-82` | Comparison bars misleading when both rewards are 0 |
| C9-09 | LOW | Low | `cards.ts:159-173` | Categories cache never invalidated — same as D-07/D-54 |
| C9-10 | LOW | High | `xlsx.ts:290-294` | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-11 | MEDIUM | Medium | `store.svelte.ts:139-149` | `isValidTx` allows empty-string fields — extends D-27 |
| C9-12 | LOW | Medium | `analyzer.ts:43-44` | Module-level cache persists across store resets |
| C9-13 | MEDIUM | High | `SpendingSummary.svelte:101-106` | `monthlyBreakdown` relies on Map insertion order being chronological |
