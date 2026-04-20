# Comprehensive Code Review -- Cycle 49

**Date:** 2026-04-22
**Reviewer:** Single-agent comprehensive review (cycle 49 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-48 reviews and the aggregate. Ran `npm run typecheck` (0 errors across all 7 workspaces), `npx vitest run` (189 pass, 0 fail), `bun test packages/parser tools/scraper` (58 pass, 0 fail). ESLint is N/A -- no eslint.config.js at repo root (consistent with prior reviews). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-48 findings are confirmed fixed except as noted in the aggregate. No regressions detected.

---

## Previously Open Findings -- Re-verification

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present. No deferred items have been resolved since cycle 48.

---

## New Findings

### C49-01: `isSubstringSafeKeyword` is dead code in matcher.ts
**Severity:** LOW
**Confidence:** HIGH
**File:** `packages/core/src/categorizer/matcher.ts:21-23`
**Description:** The function `isSubstringSafeKeyword` is defined but never called. The filtering it would perform is done inline at module level via `SUBSTRING_SAFE_ENTRIES` (line 18-19), which pre-computes the filtered entries. The function serves no purpose and adds confusion.
**Fix:** Remove the dead function. It was superseded by the `SUBSTRING_SAFE_ENTRIES` pre-computation added for C33-01.
**Cross-reference:** Noted in cycle 48 review as "cosmetic dead code" but not formally filed.

### C49-02: `buildCategoryLabelMap` sets subcategory `node.id` without dot prefix, creating ambiguous entries
**Severity:** LOW
**Confidence:** MEDIUM
**File:** `apps/web/src/lib/category-labels.ts:11`
**Description:** `buildCategoryLabelMap` calls `labels.set(sub.id, sub.labelKo)` on line 11, which sets the bare subcategory ID (e.g., "cafe") as a key. It then sets the dot-notation key on line 17. However, if a subcategory ID happens to match a top-level category ID (unlikely but possible), the bare key on line 11 would shadow the top-level entry set on line 10. In practice, the current taxonomy does not have such collisions, but the ordering dependency is fragile -- line 11 overwrites whatever was set by line 10 for the same key.
**Fix:** Remove the `labels.set(sub.id, sub.labelKo)` call on line 11 since the dot-notation entry on line 17 is the one actually used by the optimizer (via `buildCategoryKey`). The bare subcategory ID entry is only used by `TransactionReview.svelte`'s `categoryMap` which builds its own map independently. If the bare entry is needed elsewhere, add a comment documenting the collision risk.
**Failure scenario:** A future taxonomy change adds a subcategory whose ID matches a top-level category (e.g., a top-level "cafe" and a subcategory "cafe" under "dining"). The label map would return the subcategory's label for the top-level key, silently producing wrong Korean text in the UI.

### C49-03: `CategoryBreakdown.svelte` maxPercentage initial value of 1 can produce overly wide bars
**Severity:** LOW
**Confidence:** HIGH
**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:129`
**Description:** When `categories` is empty (no analysis result), `maxPercentage` defaults to `1` (i.e., 1%). This is a repeat of C41-04/C42-03/C43-03 which was previously deferred. When the first category appears with a percentage like 45%, the derived calculation `categories.reduce((max, c) => Math.max(max, c.percentage), 1)` uses 1 as the initial value, which is fine since Math.max(1, 45) = 45. The issue is only aesthetic -- it does not cause incorrect data, just a brief visual inconsistency during the initial render before categories populate. Confirmed still present.
**Status:** Deferred (same as prior cycles -- LOW severity, cosmetic only)

### C49-04: `VisibilityToggle.svelte` directly mutates DOM elements from Svelte $effect
**Severity:** LOW
**Confidence:** HIGH
**File:** `apps/web/src/components/ui/VisibilityToggle.svelte:69-70,88-103`
**Description:** This is a repeat of C18-01. The `VisibilityToggle` component uses `$effect` to directly toggle CSS classes and set `textContent` on external DOM elements queried by ID. This is an anti-pattern in Svelte -- it breaks the reactive model by mutating the DOM outside Svelte's control. While it works correctly today, it is fragile and could break if Astro View Transitions change the DOM structure.
**Status:** Deferred (same as prior cycles -- LOW severity, would require architectural refactoring)

---

## Final Sweep -- Cross-File Interactions

1. **Negative-amount handling consistency (COMPLETE INVENTORY):**
   - Server-side PDF: `amount <= 0` at `pdf/index.ts:104` -- CORRECT
   - Web-side PDF structured parse: `amount <= 0` at `pdf.ts:248` -- CORRECT
   - Web-side PDF fallback scan: `amount > 0` at `pdf.ts:360` -- CORRECT
   - Web-side CSV: `amount <= 0` at `csv.ts:72` -- CORRECT
   - Web-side XLSX: `amount <= 0` at `xlsx.ts:399` -- CORRECT
   - All 10 server-side CSV adapters: `amount <= 0` -- CORRECT
   - Server-side CSV generic: `amount <= 0` at `generic.ts:122` -- CORRECT
   - Downstream filters: `reward.ts:218` (`amount <= 0`), `greedy.ts:275` (`amount > 0`) -- CORRECT
   - `isOptimizableTx` at `store.svelte.ts:174` uses `amount > 0` -- CORRECT

2. **`Math.abs(tx.amount)` inventory:**
   - `greedy.ts:229` uses `tx.amount` directly (not Math.abs) -- CORRECT per C33-06/C40-04
   - `reward.ts:218` skips `tx.amount <= 0` -- CORRECT

3. **Global cap rollback consistency:**
   - `reward.ts:316-317` correctly rolls back `ruleMonthUsed` when global cap clips a reward -- VERIFIED

4. **Date validation parity (server vs web):**
   - Server: `packages/parser/src/date-utils.ts` -- `parseDateStringToISO()`
   - Web: `apps/web/src/lib/parser/date-utils.ts` -- identical `parseDateStringToISO()`
   - Both validate month (1-12) and day (1-31) ranges -- CONSISTENT

5. **Bank signature duplication (C7-07, still open):**
   - `packages/parser/src/detect.ts` has `BANK_SIGNATURES` (24 banks)
   - `apps/web/src/lib/parser/csv.ts` has inline adapter detect patterns (10 banks)
   - `apps/web/src/lib/parser/xlsx.ts` has `BANK_COLUMN_CONFIGS` (24 banks)
   - Divergence risk remains LOW since web CSV adapters only cover 10 of 24 banks

6. **SessionStorage persistence:**
   - `store.svelte.ts:125-158` persist/load/clear functions handle quota exceeded, truncation, corruption
   - `isOptimizableTx` validates each transaction on load (line 165-177)
   - `_truncatedTxCount` tracked and surfaced to user -- CORRECT
   - `loadFromStorage` validates `cardResults` entries (line 208-218) -- CORRECT

7. **Performance tier handling:**
   - `reward.ts:183-199` correctly warns when no tier matches and performanceTiers exist
   - `analyzer.ts:193-211` correctly computes per-card exclusion-filtered previousMonthSpending
   - `store.svelte.ts:464-479` correctly preserves user's explicit previousMonthSpendingOption through reoptimize

8. **Reward calculation:**
   - `calculatePercentageReward` in `types.ts:46-67` uses `Math.floor(amount * rate)` -- correct for Won
   - `calculateFixedReward` in `reward.ts:141-176` correctly handles `won_per_day`, `mile_per_1500won`, `won_per_liter` units
   - Rate+fixedAmount mutual exclusivity enforced at schema level and runtime

9. **Cache invalidation:**
   - `cachedCoreRules` in `analyzer.ts:48` -- invalidated via `invalidateAnalyzerCaches()` on reset
   - `cachedCategoryLabels` in `store.svelte.ts:317` -- invalidated on reset
   - `cardsPromise`/`categoriesPromise` in `cards.ts:151-153` -- reset on AbortError, stale across redeployments (C21-04/C23-02/C25-02/C26-03, known deferred)

10. **Build-stats deduplication (C53-02 FIX VERIFIED):**
    - `apps/web/src/lib/build-stats.ts` -- shared `readCardStats()` function
    - `apps/web/src/pages/index.astro:6` -- imports and uses `readCardStats()`
    - `apps/web/src/layouts/Layout.astro:14` -- imports and uses `readCardStats()`
    - Fallback values (683, 24, 45) defined in ONE place -- CONSISTENT

11. **TransactionReview changeCategory (C53-01 FIX VERIFIED):**
    - `TransactionReview.svelte:112-134` -- `changeCategory` uses `{ ...tx, category: ... }` spread copy + `editedTxs[idx] = updated`
    - Svelte 5 proxy-based reactivity correctly detects index assignment on $state arrays

12. **CardDetail dark mode (C53-03 FIX VERIFIED):**
    - `CardDetail.svelte:217` -- performance tier header has `text-blue-700 dark:text-blue-300`
    - Sufficient contrast against `bg-blue-50 dark:bg-blue-900/50` in both modes

13. **category-labels.ts bare subcategory key (C49-02, NEW):**
    - `buildCategoryLabelMap` sets `labels.set(sub.id, sub.labelKo)` on line 11
    - Then sets `labels.set(\`${node.id}.${sub.id}\`, sub.labelKo)` on line 17
    - The bare key on line 11 could shadow a top-level category with the same ID (currently no collision)

---

## Code Quality Observations (No Action Required)

- All parsers consistently use `Math.round(parseFloat(...))` for amount parsing
- All parsers consistently filter `amount <= 0` transactions
- Store persistence handles edge cases (quota exceeded, corrupted data, truncated transactions)
- Svelte components use proper `$state`, `$derived`, `$effect` runes with cleanup
- AbortController pattern is consistently applied in cards.ts and CardDetail.svelte
- Korean i18n is consistent across all UI components
- Dark mode classes are present on all colored elements
- `isSubstringSafeKeyword` function in `matcher.ts:21-23` is defined but unused (dead code, C49-01)

---

## Gate Results

| Gate | Status |
|---|---|
| `npm run typecheck` | PASS (0 errors across all 7 workspaces) |
| `npx vitest run` | PASS (189 tests, 8 files, 0 failures) |
| `bun test packages/parser tools/scraper` | PASS (58 tests, 4 files, 0 failures) |
| `eslint` | N/A -- no eslint.config.js at repo root; linting not configured |

---

## Summary

2 new findings identified in this cycle (C49-01, C49-02), both LOW severity. C49-01 is dead code (cosmetic), C49-02 is a potential label map collision risk (currently no collision exists in the taxonomy). 2 previously noted items re-confirmed (C49-03 = C41-04 re-deferred, C49-04 = C18-01 re-deferred). All HIGH and MEDIUM severity findings from prior cycles remain resolved. The codebase is in a stable, well-maintained state.
