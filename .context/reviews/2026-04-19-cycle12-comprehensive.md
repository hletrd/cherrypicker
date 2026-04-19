# Cycle 12 — Comprehensive Multi-Angle Code Review

**Date:** 2026-04-19
**Reviewer:** All specialist angles (code quality, performance, security, architecture, debugger, test, UI/UX, documentation)
**Scope:** Full repository — all packages/core, apps/web, packages/rules, tools

---

## Verification of Prior Cycle Findings

### Previously Fixed (Confirmed)

| Finding | Status | Evidence |
|---------|--------|----------|
| C11-12 | FIXED | `store.svelte.ts:352-365` now recalculates `monthlyBreakdown` from `editedTransactions` after reoptimize |
| C11-13 | FIXED | `categorizer.test.ts:249-306` now has 6 dedicated test cases for the merchant name length guard |
| C11-16 | FIXED | `SpendingSummary.svelte:101` now checks `monthlyBreakdown.length > 1` before showing previous-month spending |
| C11-17 | FIXED | `TransactionReview.svelte:160-175` now correctly uses `subcategoryToParent` map to set both `category` (parent) and `subcategory` (child) when a subcategory is selected |

### Previously Deferred (Still Deferred)

C11-01 through C11-11, C11-15, C11-18 through C11-20 — all LOW severity, unchanged.

---

## Code Quality Review

### C12-01: `loadCardsData` and `loadCategories` cache promises but never invalidate — stale data risk after failed fetch
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/cards.ts:144-157, 159-173`
- **Description:** `loadCardsData()` and `loadCategories()` cache the fetch promise in module-level variables (`cardsPromise`, `categoriesPromise`). On failure, the catch block sets the promise to `null`, which is correct. However, on a successful fetch, the promise is cached forever. If the user stays on the page for a long time and the `cards.json` data changes on the server (e.g., after a deploy), the cached data becomes stale. This is a minor concern because the app is a static site served from GitHub Pages and the data doesn't change within a session.
- **Concrete failure scenario:** User opens the app, cards.json is fetched and cached. A new card is added to the data via a separate deploy. The user's session continues using stale data until they hard-refresh.
- **Fix:** No action needed for a static site. The cache is appropriate for session-level persistence.

### C12-02: `cachedCoreRules` in analyzer.ts is never invalidated across sessions — memory leak in long-running dev server
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/analyzer.ts:47-48, 194-196`
- **Description:** `cachedCoreRules` is a module-level variable that caches the result of `toCoreCardRuleSets()`. This is correct for a single session. However, there's no `reset()` method that clears it. If the `analysisStore.reset()` is called (which clears `cachedCategoryLabels`), the `cachedCoreRules` in `analyzer.ts` remains. Since card rules come from static JSON that doesn't change within a session, this is acceptable.
- **Concrete failure scenario:** No functional impact. The cache is small and correct.
- **Fix:** No action needed.

---

## Performance Review

### C12-03: `inferYear` function is duplicated 3 times across parsers — code smell and potential inconsistency
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:29-37`, `apps/web/src/lib/parser/xlsx.ts:183-190`, `apps/web/src/lib/parser/pdf.ts:132-139`
- **Description:** The `inferYear` function is identically duplicated in three files. If a bug is found in the heuristic (e.g., the 90-day look-back is too aggressive), it must be fixed in three places. This is the same class as D-01 (code duplication across parsers) but specifically calls out the `inferYear` function as a particularly sensitive duplication — a date inference bug would silently corrupt transaction dates.
- **Concrete failure scenario:** A change to the look-back heuristic is made in one parser but not the others, causing inconsistent date inference across CSV, XLSX, and PDF.
- **Fix:** Extract `inferYear` to a shared module and import it in all three parsers.

### C12-04: `parseDateToISO` is also duplicated 3 times — same risk as C12-03
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:39-80`, `apps/web/src/lib/parser/xlsx.ts:192-239`, `apps/web/src/lib/parser/pdf.ts:141-178`
- **Description:** The date parsing logic is similarly duplicated. The CSV and PDF versions are nearly identical (string-based). The XLSX version adds Excel serial date number handling. The core string-based parsing (YYYY-MM-DD, YY-MM-DD, Korean dates) is the same across all three.
- **Concrete failure scenario:** A new date format (e.g., DD/MM/YYYY) is added to the CSV parser but not the PDF parser, causing inconsistent parsing.
- **Fix:** Extract the common string-based date parsing to a shared module.

---

## Security Review

### C12-05: `parseFile` reads the entire file into memory with `file.arrayBuffer()` — no size validation before parsing
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/index.ts:19, 43, 48`
- **Description:** `parseFile` calls `file.arrayBuffer()` without checking the file size. While `FileDropzone.svelte` validates file sizes before upload (10MB per file, 50MB total), the `parseFile` function itself doesn't enforce any limit. If called directly (e.g., from a future API or test), a large file could exhaust memory. This is defense-in-depth — the current UI flow validates sizes.
- **Concrete failure scenario:** A developer adds a new entry point that calls `parseFile` directly without size validation, and a user uploads a 2GB file.
- **Fix:** Add an optional `maxSize` parameter to `parseFile` and validate before reading the buffer.

### C12-06: No CSP headers — same as C11-07, still unfixed
- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/astro.config.ts`
- **Description:** Content-Security-Policy headers are still not configured. This is a defense-in-depth improvement. Carried forward from C11-07.
- **Fix:** Add CSP headers in Astro config or deployment proxy.

---

## Architecture Review

### C12-07: `CardRuleSet` type is defined in three places with slight differences — potential type drift
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/cards.ts:3-41`, `packages/rules/src/types.ts`, `packages/core/src/calculator/types.ts`
- **Description:** The `CardRuleSet` type exists in the web app (`cards.ts`), the rules package (`types.ts`), and is implicitly used in the core package through `@cherrypicker/rules`. The web version has `source: string` while the core version expects `source: 'manual' | 'llm-scrape' | 'web'`. The `toCoreCardRuleSets` adapter bridges this gap, but if a new field is added to one definition and not the others, the adapter would silently drop it.
- **Concrete failure scenario:** A new `rewards[].conditions.excludeRegion` field is added to the rules package schema but not to the web's `CardRuleSet` type. The adapter would silently strip the field.
- **Fix:** Consider re-exporting the canonical type from `@cherrypicker/rules` in the web app, or add a runtime type-check in the adapter.

---

## Debugger Review

### C12-08: `isValidTx` allows `amount: 0` which is semantically questionable for a spending transaction
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:139-149`
- **Description:** `isValidTx` checks `typeof tx.amount === 'number'` but does not check for positive values. A transaction with `amount: 0` would pass validation. While `amount: 0` is technically valid (it could represent a zero-amount authorization), it would be filtered out by the optimizer's `tx.amount > 0` check in `greedy.ts:220`. So a zero-amount transaction would be persisted but never optimized — it would appear in the TransactionReview list but not in the dashboard results.
- **Concrete failure scenario:** A bank statement includes a zero-amount "check" transaction. It passes `isValidTx`, appears in TransactionReview, but is invisible in the optimization results. The user might be confused why a transaction exists but doesn't contribute to spending totals.
- **Fix:** Consider filtering zero-amount transactions during validation or adding a visual indicator in TransactionReview.

### C12-09: `calculateRewards` bucket mutation — bucket object is retrieved from Map and mutated in-place, then set back
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/calculator/reward.ts:193-289`
- **Description:** The `bucket` object is obtained via `categoryRewards.get(categoryKey) ?? { ... }` and then mutated in-place (lines 205, 248, 275-277). It's then set back via `categoryRewards.set(categoryKey, bucket)`. When the bucket already exists in the Map, the `set` is redundant because the object reference is the same. When it's a new bucket (cache miss), the bucket must be `set`. This is correct but the pattern of "get, mutate, set" for a Map that holds object references is confusing — it implies the set is always needed when in fact it's only needed on the first access.
- **Concrete failure scenario:** A developer reads the code, assumes the `set` is always needed, and adds a similar pattern elsewhere but forgets the `set` on the first access, causing a silent data loss.
- **Fix:** Add a comment clarifying that the `set` is only needed for the cache-miss case (new bucket), or restructure to separate the two paths.

---

## Test Engineer Review

### C12-10: Missing integration test for multi-file upload with different months
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/__tests__/`
- **Description:** `analyzeMultipleFiles` handles multi-file uploads where different files cover different months. The key behaviors are: (1) merging all transactions, (2) filtering to latest month for optimization, (3) using previous month's spending as performance tier input. There is no test that verifies these multi-file behaviors. The existing `analyzer-adapter.test.ts` only tests the type adapter function.
- **Concrete failure scenario:** A bug in `analyzeMultipleFiles` that uses the wrong month's spending for the performance tier calculation would go undetected.
- **Fix:** Add an integration test that: uploads two CSV files covering different months, verifies the optimization uses the latest month, and verifies the previous month's spending is correctly passed.

### C12-11: Missing test for `reoptimize` with subcategory changes
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/__tests__/`
- **Description:** The fix for C11-17 changed how subcategory selection works in TransactionReview. When a user selects a subcategory, both `tx.category` (parent) and `tx.subcategory` (child) are now set correctly. However, there's no test verifying that the optimizer correctly handles transactions with subcategories in the `reoptimize` path.
- **Concrete failure scenario:** A user changes a transaction from "uncategorized" to "cafe" (subcategory of "dining"), applies changes, and the optimizer treats it as a top-level "cafe" category instead of "dining.cafe", producing incorrect reward calculations.
- **Fix:** Add a test that verifies subcategory-aware reoptimize produces correct optimization results.

---

## UI/UX Designer Review

### C12-12: FileDropzone success state shows "대시보드로 이동할게요" but uses `window.location.href` — full page reload
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:211`
- **Description:** After a successful analysis, the user is redirected to the dashboard via `window.location.href = import.meta.env.BASE_URL + 'dashboard'`. This causes a full page reload. Since this is an Astro static site with `output: 'static'`, there's no client-side router available by default. The full reload is functional but slower than client-side navigation (1-2s delay). This is a known deferred item (D-47/C5-04).
- **Concrete failure scenario:** No functional impact. The user sees a brief white flash during the navigation.
- **Fix:** Consider Astro View Transitions for smoother navigation.

### C12-13: TransactionReview search is case-sensitive for Korean text — inconsistent with English case-insensitivity
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:150-151`
- **Description:** The search filter uses `tx.merchant.toLowerCase().includes(q)` which converts both the merchant name and query to lowercase. For Korean text, `toLowerCase()` has no effect (Korean characters don't have case), so the search is effectively exact-match for Korean. For English text, it's case-insensitive. This is correct behavior — Korean text doesn't need case normalization — but the code style suggests the developer expected case-insensitivity for all text.
- **Concrete failure scenario:** No functional impact. Korean search works correctly (Korean doesn't have case). English search is case-insensitive as expected.
- **Fix:** No action needed.

---

## Final Sweep — Commonly Missed Issues

### C12-14: `xlsx.ts` `parseAmount` returns raw float from numeric path — no rounding for Won amounts
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/xlsx.ts:241-243`
- **Description:** When the XLSX cell value is a number, `parseAmount` returns it directly: `return Number.isFinite(raw) ? raw : null`. Korean Won amounts should always be integers. If an XLSX file has a cell formatted as a number with a decimal value (e.g., 1500.7 from a currency conversion or formula), it would be stored as 1500.7 in the transaction. This would then cause incorrect reward calculations (e.g., 1500.7 * 0.015 = 22.5105 instead of 1500 * 0.015 = 22.5). The CSV parser uses `parseInt` which truncates to integer. This is the same class as C11-19/D-67 but with a clearer concrete impact.
- **Concrete failure scenario:** An XLSX file with a formula like `=SUM(A1:A10)/1.1` produces a decimal amount. The reward calculation produces a non-integer result, which cascades through the optimizer and produces misleading reward totals.
- **Fix:** Add `Math.round(raw)` in the XLSX numeric path: `return Number.isFinite(raw) ? Math.round(raw) : null;`

### C12-15: `reward.ts` default `rewardType: 'none'` — already fixed from C11-10
- **Severity:** N/A (fixed)
- **Confidence:** N/A
- **File:** `packages/core/src/calculator/reward.ts:201`
- **Description:** Verified that the default `rewardType` for no-rule categories is now `'none'` instead of `'discount'`. C11-10 is resolved.

### C12-16: `isValidTx` doesn't check `amount` for `Number.isFinite` — still unfixed from C11-20
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:146`
- **Description:** `isValidTx` checks `typeof tx.amount === 'number'` but not `Number.isFinite(tx.amount)`. A transaction with `amount: NaN` or `amount: Infinity` would pass validation. This is the same as C11-20.
- **Concrete failure scenario:** After sessionStorage corruption, a transaction with `amount: NaN` is restored and displayed as "0원" (because `formatWon` handles NaN via `!Number.isFinite` check) but is included in the optimizer which skips it silently (due to `tx.amount > 0` filter). The user sees a transaction that appears to have 0 amount but exists in the list.
- **Fix:** Add `Number.isFinite(tx.amount)` to the validation check in `isValidTx`.

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C12-01 | LOW | High | `cards.ts:144-157` | Promise caching never invalidates for stale data (acceptable for static site) |
| C12-02 | LOW | Medium | `analyzer.ts:47-48` | `cachedCoreRules` never invalidated (acceptable — rules are static) |
| C12-03 | LOW | High | `csv.ts:29`, `xlsx.ts:183`, `pdf.ts:132` | `inferYear` duplicated 3 times — date inference inconsistency risk |
| C12-04 | LOW | High | `csv.ts:39`, `xlsx.ts:192`, `pdf.ts:141` | `parseDateToISO` duplicated 3 times — same risk as C12-03 |
| C12-05 | LOW | Medium | `parser/index.ts:19,43,48` | No size validation in `parseFile` before reading buffer |
| C12-06 | MEDIUM | Medium | `astro.config.ts` | No CSP headers (same as C11-07, still unfixed) |
| C12-07 | LOW | High | `cards.ts`, `rules/types.ts` | `CardRuleSet` type drift across packages |
| C12-08 | LOW | Medium | `store.svelte.ts:146` | `isValidTx` allows `amount: 0` — semantically questionable |
| C12-09 | LOW | High | `reward.ts:193-289` | Bucket get-mutate-set pattern confusing (redundant set on cache hit) |
| C12-10 | MEDIUM | High | `apps/web/__tests__/` | Missing integration test for multi-file upload with different months |
| C12-11 | MEDIUM | High | `apps/web/__tests__/` | Missing test for reoptimize with subcategory changes |
| C12-12 | LOW | High | `FileDropzone.svelte:211` | Full page reload after success (extends D-47/C5-04) |
| C12-13 | LOW | Medium | `TransactionReview.svelte:150` | Korean search is case-exact (correct but possibly unexpected) |
| C12-14 | MEDIUM | High | `xlsx.ts:241-243` | XLSX parseAmount returns raw float — no rounding for Won amounts |
| C12-15 | N/A | N/A | `reward.ts:201` | C11-10 default `rewardType` — confirmed fixed |
| C12-16 | LOW | Medium | `store.svelte.ts:146` | `isValidTx` doesn't check `Number.isFinite` (same as C11-20) |

---

## Actionable High-Priority Findings

1. **C12-14** (MEDIUM): XLSX `parseAmount` returns raw float — add `Math.round()` for Won amounts
2. **C12-10** (MEDIUM): Add integration test for multi-file upload with different months
3. **C12-11** (MEDIUM): Add test for reoptimize with subcategory changes
4. **C12-06** (MEDIUM, carried from C11-07): Add Content-Security-Policy headers
