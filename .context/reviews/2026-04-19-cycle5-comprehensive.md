# Comprehensive Code Review — Cycle 5 (2026-04-19)

**Reviewer:** multi-angle (code quality, perf, security, debugger, architect, designer, test, verifier)
**Scope:** Full repository — all packages, apps, tools, e2e, tests
**Focus:** New findings beyond cycles 1-4; verification of cycle 4 fixes

---

## Verification of Cycle 4 Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| C4-01: SavingsComparison division by zero | **FIXED** | `Number.isFinite(raw)` guard on line 73 |
| C4-02: loadCategories() called twice | **FIXED** | `prebuiltCategoryLabels` param added at line 130, passed from `analyzeMultipleFiles` at line 270 |
| C4-03: monthlyBreakdown O(n*m) | **FIXED** | `monthlyTxCount` single-pass map at lines 244-248 |
| C4-04: CategoryBreakdown a11y | **FIXED** | `role="button"`, `tabindex="0"`, `onkeydown` for Enter/Space at lines 144-151 |
| C4-05: categoryLabels mutation after buildConstraints | **FIXED** | `categoryLabels` passed into `buildConstraints` at line 186 |
| C4-08: editedTxs over-broad re-sync | **FIXED** | Generation counter used in $effect at line 125 |
| C4-10: E2E stale dist/ | **FIXED** | Stale detection with mtime comparison at lines 26-34 |
| C4-11: No findCategory fuzzy regression test | **FIXED** | Test added at `categorizer.test.ts:97-128` |
| C4-12: parseInt NaN in FileDropzone | **FIXED** | Replaced with `Number()` + `Number.isFinite` at line 200 |
| C4-15: toCoreCardRuleSets not cached | **FIXED** | `cachedCoreRules`/`cachedRulesRef` caching at lines 43-44, 191-195 |

**Cycle 4 fixes still open (LOW, deferred):** C4-06, C4-07, C4-09, C4-13, C4-14

---

## New Findings

### C5-01: `reoptimize()` doesn't increment `generation` — inconsistent change detection

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:241-255`
- **Description:** The `analyze()` method increments `generation` (line 231), but `reoptimize()` does NOT increment `generation` (lines 241-255). The `generation` counter is used by TransactionReview's `$effect` (line 125) to decide when to re-sync `editedTxs`. While the current behavior is intentional — we don't want to overwrite user edits after reoptimization — it creates an inconsistency: any future component that relies on `generation` to detect result changes will miss reoptimize events. For example, if a component watches `generation` to invalidate a derived cache or trigger an animation, it will be subtly broken after reoptimization.
- **Failure scenario:** A new dashboard component is added that uses `$effect(() => { const gen = analysisStore.generation; ... })` to detect when the optimization result changes. After a user edits categories and clicks "apply", `reoptimize` runs and updates `result`, but `generation` stays the same. The component never re-runs its effect and shows stale data.
- **Fix:** Increment `generation` in `reoptimize()` as well. In TransactionReview's `$effect`, compare the generation against a local `lastSyncedGen` variable to avoid overwriting in-progress edits:
  ```ts
  let lastSyncedGen = -1;
  $effect(() => {
    const gen = analysisStore.generation;
    if (gen !== lastSyncedGen) {
      lastSyncedGen = gen;
      const txs = analysisStore.transactions;
      if (txs.length > 0) {
        editedTxs = txs.map(tx => ({ ...tx }));
        hasEdits = false;
      }
    }
  });
  ```
  Actually, the current TransactionReview effect already correctly gates on `gen` via the `analysisStore.generation` read. The real fix is simpler: just add `generation++` to `reoptimize()`. The TransactionReview effect will fire, but since `editedTxs` was just submitted by the user via `applyEdits()`, the re-sync will set `editedTxs` to the same data that was just submitted, which is harmless. The `hasEdits = false` line is also correct since the edits were just applied.

### C5-02: `loadFromStorage` doesn't restore `transactions` — empty TransactionReview after page reload

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:91-94, 96-113`
- **Description:** The `PersistedAnalysisResult` type explicitly excludes `transactions` from the persisted shape (line 91-94). When the page is reloaded, `loadFromStorage()` restores the optimization result but not the transaction list. The `transactions` getter returns `result?.transactions ?? []` (line 212-214), which yields an empty array. The TransactionReview component shows "거래 상세 내역은 현재 브라우저 세션 메모리에만 보관되고" (line 303), but this creates a confusing UX: the dashboard shows full optimization results (savings, card assignments) while the transaction review section is completely empty. The user may not understand why the optimization results are visible but the transactions aren't.
- **Failure scenario:** User uploads a statement, sees full dashboard results, closes the tab. Reopens the tab later. The dashboard shows savings numbers and card assignments, but TransactionReview shows "거래 상세 내역은 현재 브라우저 세션 메모리에만 보관되고" with an empty list. The user can't review or re-categorize individual transactions, making the "apply changes" flow unusable.
- **Fix:** Persist `transactions` in sessionStorage (they are just arrays of plain objects, typically under 100KB for a monthly statement). Add `transactions` to the `PersistedAnalysisResult` type and the persist/load functions. Alternatively, show a more prominent notice that the transaction list was lost and the user should re-upload.

### C5-03: OptimalCardMap table rows not keyboard accessible

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:91-125`
- **Description:** Similar to the C4-04 finding (which was fixed for CategoryBreakdown), the `<tr>` elements in OptimalCardMap have `onclick` handlers (line 93) but lack `tabindex="0"`, `role="button"`, and `onkeydown` handlers for Enter/Space. Keyboard-only users cannot expand the alternatives row. Screen readers don't identify the rows as interactive.
- **Failure scenario:** A keyboard user tabs through the dashboard and reaches the OptimalCardMap table. They can tab into the sort buttons (line 63-69) but cannot activate any row to see alternatives.
- **Fix:** Add `tabindex="0"`, `role="button"`, `aria-expanded`, and `onkeydown` for Enter/Space to the `<tr>` elements, matching the pattern used in CategoryBreakdown after the C4-04 fix.

### C5-04: FileDropzone success navigation uses full page reload

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:205-207`
- **Description:** After successful upload, the navigation to the dashboard uses `window.location.href = import.meta.env.BASE_URL + 'dashboard'`, which triggers a full page reload. This loses all JavaScript state (including the in-memory `analysisStore`) and relies entirely on sessionStorage to restore the result. While sessionStorage works, the full reload is slower than Astro's client-side navigation (view transitions). The `<a>` elements in the empty-state sections (e.g., line 217-221, 238-244) correctly use `<a href=...>` which would use Astro's client-side routing.
- **Failure scenario:** After a 3-second analysis, the user waits an additional 1-2 seconds for the full page reload. If sessionStorage quota was exceeded (possible for large analyses), the data is lost entirely.
- **Fix:** Use Astro's `navigate()` function from `astro:transitions` or a simple `<a>` click simulation instead of `window.location.href`.

### C5-05: CategoryBreakdown hardcoded colors missing taxonomy categories (extends C4-09)

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:7-49`
- **Description:** The `CATEGORY_COLORS` map is missing `traditional_market` which IS in the taxonomy (visible in the categorizer test at `categorizer.test.ts:44` which lists `supermarket` but `traditional_market` is in the YAML). Any spending in `traditional_market` would render with the `uncategorized` gray fallback, making it indistinguishable from truly uncategorized items. This extends C4-09 (which was deferred as LOW) with a concrete example of a missing category.
- **Failure scenario:** A user with traditional market spending sees it grouped under the same gray color as uncategorized items in the category breakdown chart.
- **Fix:** Either add the missing entries, or (preferred) generate colors dynamically from a palette based on category index, so new categories automatically get a distinct color.

### C5-06: FileDropzone duplicate file detection by name only

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:129`
- **Description:** The duplicate check `!uploadedFiles.some(existing => existing.name === f.name)` compares only filenames, not file content or size. Two different CSV files with the same name (e.g., `statement.csv` from two different banks) would be treated as duplicates, and the second file would be silently dropped.
- **Failure scenario:** User has two bank statements both named `statement.csv` in different folders. They drag both into the drop zone. The second file is silently ignored, and the user only gets analysis for one bank.
- **Fix:** Add file size to the duplicate check: `!uploadedFiles.some(existing => existing.name === f.name && existing.size === f.size)`. Or show a confirmation dialog when a duplicate name is detected.

### C5-07: SessionStorage quota exceeded — no user feedback

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/store.svelte.ts:96-113`
- **Description:** The `persistToStorage` function catches all errors silently (line 112: `catch { /* quota exceeded or SSR */ }`). If the analysis result is too large for sessionStorage (~5MB limit per origin), the data is not saved, and the user has no indication that their data wasn't persisted. Combined with C5-02 (transactions not persisted), this means large analyses are particularly vulnerable — the optimization result might not be saved either.
- **Failure scenario:** A user uploads 12 months of statements with 500+ transactions per month. The JSON payload exceeds 5MB. `sessionStorage.setItem` throws a `QuotaExceededError`. The error is silently caught. The user closes the tab, and all data is lost with no warning.
- **Fix:** Check for quota errors specifically and set a warning flag in the store (e.g., `persistFailed: true`). Show a toast or banner warning the user that their data couldn't be saved and they should re-upload.

### C5-08: `inferYear` in CSV parser uses `new Date()` — testability concern

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/csv.ts:30-36`
- **Description:** The `inferYear` helper uses `new Date()` to determine the current date. This means unit tests that depend on short-date parsing could produce different results depending on when they're run (e.g., a test written in January would produce different inferred years than when run in December). While this is a testability concern rather than a runtime bug, it makes the parser behavior non-deterministic in tests.
- **Failure scenario:** A test with a short date like "1/15" expects year 2026, but if run on 2026-01-01, the `inferYear` heuristic would use 2025 (since January 15 is not 3 months in the future from January 1). This could cause test flakiness.
- **Fix:** Accept an optional `now` parameter (defaulting to `Date.now()`) for testability, or use dependency injection for the current date.

### C5-09: `reoptimize` re-assigns `result` without incrementing `generation` — Svelte 5 reactivity edge case

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:247`
- **Description:** In `reoptimize()`, line 247 does `result = { ...result, transactions: editedTransactions, optimization }`. This reassignment creates a new object reference, which triggers Svelte 5's `$state` reactivity. Any derived value that depends on `result` will recompute. However, `generation` is NOT incremented (unlike in `analyze()` at line 231). The TransactionReview `$effect` reads both `analysisStore.generation` and `analysisStore.transactions`, but since `generation` didn't change, the effect may or may not re-fire depending on Svelte's effect scheduling. In practice, since `transactions` also changed (it's derived from `result`), the effect will fire. But this creates a subtle dependency on Svelte's internal effect scheduling that could break in a future Svelte version.
- **Failure scenario:** A future Svelte 5 update changes effect scheduling such that an effect that reads `generation` but `generation` hasn't changed is skipped entirely, even if other reactive dependencies changed. The `editedTxs` wouldn't be re-synced after reoptimization.
- **Fix:** Increment `generation` in `reoptimize()` for consistency. The TransactionReview effect already uses generation as a gate, and the re-sync behavior after reoptimization is harmless (it sets `editedTxs` to the same data).

---

## Summary of New Findings

| ID | Severity | Confidence | Category | Description |
|----|----------|------------|----------|-------------|
| C5-01 | MEDIUM | High | architect | `reoptimize()` doesn't increment `generation` — inconsistent change detection |
| C5-02 | MEDIUM | High | debugger/UX | `loadFromStorage` doesn't restore `transactions` — empty TransactionReview after reload |
| C5-03 | LOW | High | a11y | OptimalCardMap table rows not keyboard accessible |
| C5-04 | LOW | High | perf/UX | FileDropzone success navigation uses full page reload |
| C5-05 | LOW | High | code-quality | CategoryBreakdown colors missing `traditional_market` (extends C4-09) |
| C5-06 | LOW | Medium | UX | FileDropzone duplicate detection by name only |
| C5-07 | LOW | High | UX | SessionStorage quota exceeded — no user feedback |
| C5-08 | LOW | Medium | test | `inferYear` uses `new Date()` — non-deterministic in tests |
| C5-09 | LOW | Medium | debugger | `reoptimize` re-assigns `result` without incrementing `generation` — reactivity edge case |

---

## Prioritized Action Items

### HIGH (should fix this cycle)
1. C5-01: Add `generation++` to `reoptimize()` in store.svelte.ts
2. C5-02: Persist `transactions` in sessionStorage or show prominent notice

### MEDIUM (plan for next cycles)
3. C5-03: Add keyboard accessibility to OptimalCardMap rows (same pattern as C4-04 fix)
4. C5-07: Add user feedback when sessionStorage quota is exceeded
5. C5-09: Increment `generation` in `reoptimize()` for reactivity consistency (overlaps with C5-01)

### LOW (defer or accept)
- C5-04, C5-05, C5-06, C5-08

---

## Deferred items carried forward from Cycle 4

The following LOW-severity items from cycle 4 remain deferred and are not re-listed with new IDs:
- C4-06: Annual savings projection misleading
- C4-07: localStorage vs sessionStorage inconsistency for dismissed warning
- C4-09: Hardcoded CATEGORY_COLORS not sourced from taxonomy
- C4-13: Small-percentage bars nearly invisible
- C4-14: Stale fallback values in Layout footer
