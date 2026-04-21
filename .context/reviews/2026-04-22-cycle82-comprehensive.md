# Cycle 82 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Single-pass deep review (all source files re-read)
**Scope:** Full repository -- apps/web/src/, packages/core/, packages/parser/, packages/rules/, packages/viz/, tools/

---

## Verification of Prior Cycle Fixes (C81)

All C81 findings verified against current source:

| Finding | Status | Evidence |
|---|---|---|
| C81-01 | **FIXED** | `store.svelte.ts:501` now captures `const snapshot = result;` after the null guard and uses `...snapshot` at line 569 instead of `...result!`. The reactive $state variable is no longer read after async gaps. |
| C81-02 | **FIXED** | All 10 bank adapters in `csv.ts` now scan `Math.min(30, lines.length)` rows for header detection (lines 290, 357, 423, 489, 554, 619, 685, 751, 816, 881), matching the generic parser. |
| C81-03 | **FIXED** | `analyzer.ts:110` now uses `categoryNodes ??` with nullish coalescing and passes `categoryNodes` from `analyzeMultipleFiles` to `parseAndCategorize` at line 284, avoiding the redundant `loadCategories()` call. |
| C81-04 | **FIXED** | `CategoryBreakdown.svelte:51-84` now includes dot-notation subcategory keys (e.g., `'dining.restaurant'`, `'utilities.apartment_mgmt'`) in `CATEGORY_COLORS`, with a comment referencing C81-04. |

---

## New Findings (This Cycle)

### C82-01: TransactionReview `$effect` sync reads `analysisStore.transactions` reactively inside derived chain

**Severity:** MEDIUM | **Confidence:** MEDIUM
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:127-142`

The `$effect` at line 127 reads `analysisStore.generation` and `analysisStore.transactions` to sync `editedTxs`. The `transactions` getter in `store.svelte.ts:443` accesses `result?.transactions ?? []` where `result` is a `$state`. If `result` changes between the `gen` check and the `txs` read (within the same synchronous effect tick this is impossible, but across Astro View Transition re-mounts it could be), the effect may copy stale data.

**Concrete scenario:** During Astro View Transition, the old component instance's effect may fire after `result` has been set to null by the new instance's `reset()` call, causing `editedTxs` to be set to `[]` when it should retain the user's edits. The `generation` guard partially mitigates this, but the two reads are not atomic.

**Suggested fix:** Read `analysisStore.result` once into a local variable, then derive both generation and transactions from the snapshot.

### C82-02: SavingsComparison `displayedSavings` animation can show stale value after rapid reoptimize

**Severity:** LOW | **Confidence:** HIGH
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:45-76`

The `$effect` at line 45 starts a `requestAnimationFrame` loop that reads `opt?.savingsVsSingleCard`. If the user edits categories and hits "apply" twice rapidly, two animation loops can overlap. The `cancelled` flag prevents the old loop from setting state, but the `startVal` for the second loop reads `displayedSavings` at the time the effect fires, which may be a mid-animation value from the first loop. This causes the animation to "jump" rather than smoothly transitioning from the previous target to the new target.

**Concrete scenario:** User clicks "apply" when savings is animating from 0 to 5000 (currently at 2500), then clicks "apply" again immediately. The second animation starts from 2500 instead of 5000, then animates to the new target, creating a visible "dip" in the number.

**Suggested fix:** Track the last *target* value separately from `displayedSavings`. When starting a new animation, always animate from the last target to the new target, not from the current displayed value.

### C82-03: `formatWon` normalizes `-0` to `+0` but `SavingsComparison` sign-prefix logic assumes signed zero

**Severity:** LOW | **Confidence:** HIGH
**File:** `apps/web/src/lib/formatters.ts:8` and `apps/web/src/components/dashboard/SavingsComparison.svelte:217`

`formatWon` at line 8 normalizes `-0` to `0` (`if (amount === 0) amount = 0`). However, at `SavingsComparison.svelte:217`, the sign prefix is determined by `displayedSavings > 0`. When `displayedSavings` is exactly 0 (from the animation settling), `formatWon(0)` returns `"0원"`. But during the animation, `displayedSavings` can be a small positive integer (e.g., 1) from rounding, causing `formatWon(1)` to return `"1원"` with a `+` prefix for a single frame before the animation completes. This creates a brief "+1원" flash.

**Concrete scenario:** When savings is exactly 0, the animation from 0 to 0 returns early (line 47-48). But when savings transitions from positive to 0 (e.g., after removing a card), the animation passes through small positive values, briefly showing "+1원" before settling on "0원".

**Suggested fix:** Add a threshold check: only show the `+` prefix when `displayedSavings >= 100` (100 won is the minimum meaningful amount in Korean banking).

### C82-04: `parseFile` in `index.ts` reads the file into an ArrayBuffer for CSV but then decodes it with TextDecoder, ignoring the ArrayBuffer for XLSX/PDF

**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/lib/parser/index.ts:17-68`

For CSV files, `parseFile` calls `file.arrayBuffer()` and then uses `TextDecoder` to decode. For XLSX and PDF files, it also calls `file.arrayBuffer()` and passes the buffer directly. This means every file is fully loaded into memory as an ArrayBuffer. For very large files (approaching the 10MB limit), this creates two copies in memory: the ArrayBuffer and the decoded string. The 10MB limit makes this safe in practice, but it's worth noting for future optimization.

**Concrete scenario:** A 10MB CSV file uses ~10MB for the ArrayBuffer + ~30MB for the decoded UTF-16 string (JavaScript strings are UTF-16), totaling ~40MB peak memory for a single file parse.

**Suggested fix:** Consider streaming the file for CSV parsing or using `file.text()` directly (which avoids the intermediate ArrayBuffer for CSV).

### C82-05: `VisibilityToggle` directly mutates DOM via `textContent` and `classList.toggle` outside Svelte's reactivity system

**Severity:** LOW | **Confidence:** HIGH (re-confirmation of C18-01/C76-04/C79-02)
**File:** `apps/web/src/components/ui/VisibilityToggle.svelte:70-71,90-108,119-125`

This is a re-confirmation of the long-standing finding. The component directly sets `textContent` and calls `classList.toggle` on elements queried by ID. While the `isConnected` guard (added in C21-01) prevents stale mutations, the pattern remains fragile: it bypasses Svelte's DOM diffing, can conflict with Astro View Transitions, and is hard to test. No new regression has been introduced, but the architectural risk persists.

---

## Prior Cycle Findings Verification (Sampled)

| Finding | Status | Notes |
|---|---|---|
| C80-01 (FileDropzone name+size dedup) | **FIXED** | Line 141: `existing.name === f.name && existing.size === f.size` |
| C80-02 (TransactionReview select disabled) | **FIXED** | Line 289: `disabled={reoptimizing}` |
| C80-03 (CSV header scan limit 30) | **FIXED** | All adapters now use `Math.min(30, lines.length)` |
| C78-02 (FALLBACK_CATEGORIES leading spaces) | **OPEN** | Still present at TransactionReview.svelte lines 36-64. Labels still have leading spaces for visual hierarchy. Search works via `includes()`, so functional impact is limited to rendering inconsistency in some browsers. |
| C72-03 (cachedCategoryLabels empty guard) | **FIXED** | store.svelte.ts:389: `if (nodes.length > 0) { cachedCategoryLabels = labels; }` |
| C70-01 (detectBank confidence cap) | **FIXED** | detect.ts:159: `confidence = Math.min(confidence, 0.5)` |

---

## No New High-Severity Findings

This cycle found no new HIGH severity issues. The codebase is in a mature state with all previously identified HIGH-severity issues fixed. The remaining open issues are LOW to MEDIUM severity and largely architectural (e.g., VisibilityToggle DOM mutation, hardcoded maps that can drift, O(n) scan patterns).

---

## Final Sweep: Commonly Missued Issue Check

| Category | Checked | Found |
|---|---|---|
| XSS / injection | All `innerHTML`, `textContent` | No XSS vectors found. All dynamic content is set via Svelte template bindings or `textContent`. |
| Prototype pollution | All `JSON.parse` results | No `__proto__` or `constructor` assignments found. |
| Uncaught promise rejections | All `.then()` chains | CardDetail.svelte:78-89 handles errors. FileDropzone handles errors. No uncaught rejections. |
| Memory leaks | All `requestAnimationFrame`, `setTimeout` | SavingsComparison cleans up via `cancelAnimationFrame`. FileDropzone cleans up `navigateTimeout`. No leaks found. |
| Off-by-one errors | All `slice()`, `indexOf()`, loop bounds | date-utils.ts regex groups are correctly bounded. No new off-by-one found. |
| Type unsafety | All `as` casts | `toCoreCardRuleSets` uses validated narrowing via `VALID_SOURCES`/`VALID_REWARD_TYPES` sets. No unsafe casts. |
