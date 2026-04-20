# Comprehensive Code Review -- Cycle 48

**Date:** 2026-04-21
**Reviewer:** Single-agent comprehensive review (cycle 48 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-47 reviews and the aggregate. Ran `npm run typecheck` (0 errors across all 7 workspaces), `npx vitest run` (189 pass, 0 fail), `bun test packages/parser tools/scraper` (58 pass, 0 fail). ESLint is N/A -- no eslint.config.js at repo root (consistent with prior reviews). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-47 findings are confirmed fixed except as noted in the aggregate. No regressions detected.

---

## Previously Open Findings Now Confirmed FIXED (This Cycle)

| Finding | Status | Evidence |
|---|---|---|
| C53-01 | **FIXED** | `TransactionReview.svelte:131` now uses spread-copy `{ ...tx, ... }` + index assignment `editedTxs[idx] = updated`. The C53-01 review suggested `editedTxs.map()` but the actual fix uses `editedTxs[idx] = updated` which is both correct (spread creates new object) and more performant (avoids O(n) array copy per edit, per comment citing C22-05/C39-02). Svelte 5's proxy-based reactivity detects index mutations. |
| C53-02 | **FIXED** | Both `index.astro:6` and `Layout.astro:14` now use the shared `readCardStats()` function from `apps/web/src/lib/build-stats.ts`. The fallback values are defined in one place. |
| C53-03 | **FIXED** | `CardDetail.svelte:217` now has `dark:text-blue-300` on the performance tier header row, providing sufficient contrast against the dark-mode `bg-blue-900/50` background. |
| D-106 | **FIXED** | `apps/web/src/lib/parser/pdf.ts:270-276` no longer uses bare `catch {}`. The catch block now captures `err` and logs `console.warn('[cherrypicker] Structured PDF table parse failed, falling back to line scan:', ...)` for diagnostics, matching the behavior described as the exit criterion for D-106. |

---

## Verification of Prior "Still-Open" Deferred Findings

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present except as noted above. No new deferred items have been resolved since cycle 47.

---

## New Findings

No new findings identified in this cycle. The codebase is in a stable state with all HIGH and MEDIUM severity issues resolved. Remaining open items are LOW severity and have been properly deferred with documented rationale.

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
   - `isOptimizableTx` at `store.svelte.ts:168` uses `amount > 0` -- CORRECT

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
   - Divergence risk remains LOW since web CSV adapters only cover 10 of 24 banks, but this is a known deferred item

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
   - `calculatePercentageReward` in `types.ts:46-67` uses `Math.floor(amount * rate)` -- correct for Won (integer currency)
   - `calculateFixedReward` in `reward.ts:141-176` correctly handles `won_per_day`, `mile_per_1500won`, `won_per_liter` units
   - Rate+fixedAmount mutual exclusivity enforced at schema level (`rewardTierRateSchema.refine` in `schema.ts:21-24`) and runtime (`reward.ts:259-269`)

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
    - Consistent with `runAICategorization` fix from C52-02

12. **CardDetail dark mode (C53-03 FIX VERIFIED):**
    - `CardDetail.svelte:217` -- performance tier header has `text-blue-700 dark:text-blue-300`
    - Sufficient contrast against `bg-blue-50 dark:bg-blue-900/50` in both modes

---

## Code Quality Observations (No Action Required)

- All parsers consistently use `Math.round(parseFloat(...))` for amount parsing
- All parsers consistently filter `amount <= 0` transactions
- Store persistence handles edge cases (quota exceeded, corrupted data, truncated transactions)
- Svelte components use proper `$state`, `$derived`, `$effect` runes with cleanup
- AbortController pattern is consistently applied in cards.ts and CardDetail.svelte
- Korean i18n is consistent across all UI components
- Dark mode classes are present on all colored elements
- `isSubstringSafeKeyword` function in `matcher.ts:21-23` is defined but unused (dead code). The filtering is done inline at module level via `SUBSTRING_SAFE_ENTRIES`. Extremely minor -- not filing as a separate finding since it's cosmetic dead code.

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

No new findings identified in this cycle. 4 previously open findings are now confirmed FIXED (C53-01, C53-02, C53-03, D-106). The codebase remains in a stable, well-maintained state. All HIGH and MEDIUM severity findings from prior cycles have been resolved. The remaining open items are all LOW severity and properly documented in the deferred items list.
