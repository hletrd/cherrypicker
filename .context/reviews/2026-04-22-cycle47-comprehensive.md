# Comprehensive Code Review -- Cycle 47

**Date:** 2026-04-22
**Reviewer:** Single-agent comprehensive review (cycle 47 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-46 reviews and the aggregate. Ran `npm run typecheck` (0 errors across all workspaces), `vitest` (189 pass, 0 fail), `bun test` (58 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-46 findings are confirmed fixed except as noted in the aggregate. No regressions detected.

---

## Verification of Prior Deferred Fixes (Still Relevant)

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present. No new deferred items have been resolved since cycle 46.

---

## New Findings

No new findings identified in this cycle. The codebase is in a stable state with all previously identified HIGH and MEDIUM severity issues resolved. Remaining open items are LOW severity and have been properly deferred with documented rationale.

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
   - `apps/web/src/lib/parser/pdf.ts` imports `detectBank` from `./detect.js` which re-exports from web-side detect.ts
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

---

## Code Quality Observations (No Action Required)

- All parsers consistently use `Math.round(parseFloat(...))` for amount parsing
- All parsers consistently filter `amount <= 0` transactions
- Store persistence handles edge cases (quota exceeded, corrupted data, truncated transactions)
- Svelte components use proper `$state`, `$derived`, `$effect` runes with cleanup
- AbortController pattern is consistently applied in cards.ts and CardDetail.svelte
- Korean i18n is consistent across all UI components
- Dark mode classes are present on all colored elements

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

The codebase remains in a stable, well-maintained state. No new issues were found. All HIGH and MEDIUM severity findings from prior cycles have been resolved. The remaining open items are all LOW severity and properly documented in the deferred items list.
