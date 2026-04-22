# Cycle 6 Review (2026-04-22)

**Scope:** packages/core/src, apps/web/src, packages/viz/src, packages/parser/src
**Focus:** Bugs, edge cases, security issues (excluding refund-filtering — already thoroughly fixed)

---

## Files Reviewed

| Package | Files |
|---|---|
| core | calculator/{cashback,discount,points,reward,types}.ts, optimizer/{greedy,ilp,constraints}.ts, categorizer/matcher.ts, models/transaction.ts |
| web | lib/{analyzer,cards,formatters,store.svelte,store,api,build-stats,category-labels}.ts, lib/parser/{csv,date-utils,detect,index,types,xlsx,pdf}.ts, components/{dashboard,upload,ui,report,cards}/*.svelte |
| viz | report/generator.ts, terminal/{comparison,summary}.ts |
| parser | csv/{shared,index,hyundai,kb,samsung,shinhan,lotte,hana,woori,nh,ibk,bc,generic}.ts, detect.ts, types.ts, date-utils.ts, index.ts, pdf/*.ts, xlsx/*.ts |

---

## Verification of Prior Cycle Fixes

All prior fixes confirmed still in place:

| Finding | Status | Evidence |
|---|---|---|
| C5-01 performanceExclusions tx.amount > 0 | CONFIRMED | analyzer.ts:231 |
| C1-01 monthlySpending positive-only | CONFIRMED | analyzer.ts:329, store.svelte.ts:526 |
| C1-12 findRule sort stability | CONFIRMED | reward.ts:90-93 indexOf tiebreak |
| C1-21 Truncation + reoptimize | CONFIRMED | store.svelte.ts recalc monthlyBreakdown |
| C92-01/C94-01 formatSavingsValue | CONFIRMED | formatters.ts:224-227 |
| C89-02 rawPct threshold rounding | CONFIRMED | CategoryBreakdown.svelte:128 |
| C89-01 classList.toggle isConnected guard | CONFIRMED | VisibilityToggle.svelte:31 |
| C2-01 buildCategoryTable skips tx.amount<=0 | CONFIRMED | generator.ts:73 |
| C3-01/C4-01 includedCount for summary row | CONFIRMED | generator.ts:119, summary.ts:69 |

---

## New Findings

**None.** After a thorough review of all source files across core, web, viz, and parser packages, no new bugs, edge cases, or security issues were identified that meet the actionable threshold.

### Areas Reviewed Without New Findings

1. **Reward calculation (reward.ts):** `calculateRewards` correctly skips `tx.amount <= 0` (line 225) and non-KRW transactions (line 227). Global cap rollback logic (lines 323-324) correctly adjusts `ruleMonthUsed` when the global cap clips a reward. The `rewardTypeAccum` map correctly tracks dominant reward type per category. `applyMonthlyCap` and `calculatePercentageReward` are consistent — both use `Math.floor(amount * rate)` and cap clamping.

2. **Greedy optimizer (greedy.ts):** Transaction filter at line 285 correctly uses `tx.amount > 0 && Number.isFinite(tx.amount)`. The `scoreCardsForTransaction` push/pop pattern (lines 137-139) is safe — `calculateCardOutput` only reads the array. `buildCardResults` at line 239 sums `tx.amount` directly (optimizer only assigns positive transactions, confirmed at line 285).

3. **Analyzer (analyzer.ts):** `performanceExclusions` filter at lines 226-236 correctly uses `tx.amount > 0` and checks all three key forms (parent, subcategory leaf, dot-notation). `getLatestMonth` at line 257 correctly returns `null` for empty arrays. Multi-file merge at line 315 uses `localeCompare` for date sorting.

4. **Session storage persistence (store.svelte.ts):** Version migration system (lines 109-112) correctly runs migrations before validation. `loadFromStorage` validates optimization shape before accepting (lines 253-260). `isOptimizableTx` type guard (line 198) correctly checks all required fields. Persist warnings are correctly tracked and surfaced to the UI.

5. **Formatters (formatters.ts):** `formatWon` normalizes negative zero (line 8). `formatSavingsValue` correctly uses `Math.abs(value)` unconditionally with the sign determined by the label (line 226). `buildPageUrl` handles BASE_URL with or without trailing slash (line 240).

6. **Card data loading (cards.ts):** `chainAbortSignal` (line 177) correctly chains external signals to internal controllers. `loadCardsData` retry on undefined result (line 237) handles the AbortError cache invalidation race. `cardIndex` provides O(1) lookups with correct fallback (lines 319-341).

7. **CSV parsing (csv.ts in web & packages/parser):** BOM stripping at entry point (line 969). Bank adapter fallback chain with error collection (lines 979-993). Generic parser header detection requires 2+ keyword categories (line 179). `parseAmount` returns `null` for NaN (line 61) with `isValidAmount` type guard (line 75).

8. **Date parsing (date-utils.ts):** All branches validate month/day ranges. `inferYear` look-back heuristic handles year rollover. Web-side version logs warning for unparseable dates (line 140) — known tracked issue (C56-04) from 10+ cycles, not a new finding.

9. **HTML report (generator.ts):** `esc()` function (line 32) properly HTML-escapes all user-provided strings. `buildCategoryTable` correctly skips `tx.amount <= 0` (line 73). `includedCount` used for summary row (line 119).

10. **Svelte components:** All dashboard components correctly read from `analysisStore` reactive state. `CategoryBreakdown` uses rounded `pct` for < 2% threshold (line 128). `SavingsComparison` animation correctly handles reduced motion preference (line 57) and uses `formatSavingsValue` (line 242). `TransactionReview` correctly syncs with store generation (line 127) and handles category changes with fully-qualified IDs (line 176). `FileDropzone` validates file types and sizes (lines 118-121, 123-124).

---

## Still-Open Actionable Items (LOW, carried forward)

| Priority | ID | Finding | Effort | Impact |
|---|---|---|---|---|
| 1 | C1-N01 | formatIssuerNameKo 24-entry hardcoded map drifts from YAML | Medium | Correctness |
| 2 | C1-N02 | CATEGORY_COLORS 84-entry hardcoded map drifts from YAML | Medium | Correctness |
| 3 | C1-N04 | Web parser CSV helpers duplicated from server shared.ts | Large | Maintenance |
| 4 | C89-03 | formatters.ts m! non-null assertion after length check | Small | Type safety |

---

## Summary

Cycle 6 found no new actionable findings. The codebase has been thoroughly hardened across cycles 1-94 and 1-5, with all previously identified bugs fixed. The four LOW-priority carried-forward items (C1-N01, C1-N02, C1-N04, C89-03) remain open but are maintenance concerns rather than bugs or security issues.
