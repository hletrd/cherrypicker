# Comprehensive Code Review -- Cycle 51

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 51)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-50 reviews and the aggregate. Ran `bun test` (266 pass, 0 fail), `bun run lint` (0 errors), `bun run typecheck` (0 errors), and `bun run build` (success). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Prior "still-open" findings verification (C7R-M01, C7R-L01, C7R-L02, C7R-L03)
2. Category aggregation correctness in spending summary vs optimization
3. `formatDateKo`/`formatDateShort` NaN safety (C7R-L03)
4. Cross-file consistency between server-side and web-side parsers
5. SessionStorage validation and state management edge cases
6. Optimizer correctness (greedy marginal scoring, cap interactions)
7. `formatWon`/`formatRate` consistency across all implementations
8. PDF parsing edge cases and error handling
9. Web-side CSV adapter error collection vs server-side
10. New patterns introduced since last comprehensive review

---

## Verification of Prior "Still-Open" Findings

### C7R-M01: Category aggregation bug -- RESOLVED (was a false positive)

- **Prior claim:** "The `byCategory` Map is keyed by `tx.category` (parent ID), but the `categoryKey` includes the subcategory. The label is resolved from `categoryKey` rather than the parent key."
- **Current code:** `packages/viz/src/terminal/summary.ts:31-32` -- `byCategory` is keyed by `categoryKey` (which includes the subcategory via dot notation, e.g., `"dining.cafe"`). The label resolution at line 39 correctly falls through: `categoryLabels?.get(categoryKey) ?? categoryLabels?.get(tx.category) ?? CATEGORY_NAMES_KO[categoryKey] ?? CATEGORY_NAMES_KO[tx.category] ?? categoryKey`.
- **Analysis:** The Map IS keyed by `categoryKey` (not `tx.category`), so each subcategory gets its own row. The label correctly resolves to the subcategory's Korean name when available, falling back to the parent category name. There is NO merging of subcategories into a single row with the wrong label. The prior finding's description of the bug was incorrect -- it claimed the Map was keyed by `tx.category` but the code clearly uses `categoryKey`.
- **Same pattern in `packages/viz/src/report/generator.ts:70`**: Also keyed by `categoryKey`. Same correct behavior.
- **Status:** This finding was a **false positive from cycle 7**. The code has always been correct. Marking as RESOLVED/INVALID.

### C7R-L01: Unused `bank` parameter in web-side `tryStructuredParse` -- STILL OPEN

- **Current code:** `apps/web/src/lib/parser/pdf.ts:236` -- `_bank: BankId | null` (already prefixed with underscore).
- **Status:** The parameter is already prefixed with `_` which is the standard convention for intentionally unused parameters. This is NOT a real issue. The underscore prefix was apparently added at some point. Marking as RESOLVED.

### C7R-L02: Lint gate failure -- `bun:test` type declaration errors -- RESOLVED

- **Current code:** `bun run lint` and `bun run typecheck` both pass with 0 errors across all workspaces including `@cherrypicker/web`.
- **Status:** This has been fixed (likely by adding `@types/bun` or updating the svelte-check config). Both test files pass lint and typecheck.

### C7R-L03: `formatDateKo`/`formatDateShort` use `parseInt` without NaN guard -- STILL OPEN

- **Current code:** `apps/web/src/lib/formatters.ts:153-156` and `164-168`:
  ```
  const mNum = parseInt(m!, 10);
  const dNum = parseInt(d!, 10);
  if (Number.isNaN(mNum) || Number.isNaN(dNum)) return '-';
  ```
- **Analysis:** The NaN guard IS present. Both `formatDateKo` and `formatDateShort` already have `if (Number.isNaN(mNum) || Number.isNaN(dNum)) return '-';` checks on lines 155 and 169 respectively. This was apparently fixed at some point.
- **Status:** RESOLVED. The NaN guards are already in place.

---

## Deferred Findings Status (Carried Forward)

| Finding | Status | Notes |
|---|---|---|
| D-106 | STILL DEFERRED | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | STILL DEFERRED | `packages/parser/src/csv/index.ts:60-63` catch doesn't collect errors |
| D-110 | STILL DEFERRED | Non-latest month edits have no visible optimization effect |
| C4-06 | STILL DEFERRED | Annual savings projection label unchanged |
| C4-07 | STILL DEFERRED | localStorage vs sessionStorage inconsistency in SpendingSummary |
| C4-09 | STILL DEFERRED | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown |
| C4-10 | STILL DEFERRED | E2E test stale dist/ dependency |
| C4-11 | STILL DEFERRED | No regression test for findCategory fuzzy match |
| C4-13 | STILL DEFERRED | Small-percentage bars nearly invisible |
| C4-14 | STILL DEFERRED | Stale fallback values in Layout footer |

---

## Final Sweep -- Cross-File Interactions

1. **All `formatWon` implementations (4 locations):** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

2. **All `formatRate` implementations (5 locations):** All have `Number.isFinite` guard. Consistent.

3. **`parseDateToISO` implementations (6 locations):** All have month/day range validation. Consistent across server-side CSV, server-side PDF, server-side XLSX, web-side CSV, web-side PDF, web-side XLSX.

4. **`parseAmount` implementations:** All server-side and web-side PDF parsers return 0 on NaN (not NaN). Web-side CSV returns NaN on failure and uses `isValidAmount()` helper. Server-side CSV generic returns `null` on failure. XLSX parsers return `null` on failure. All patterns are internally consistent within their call sites.

5. **`inferYear` implementations (5 locations):** All use the same 90-day look-back heuristic. Consistent.

6. **Global cap rollback logic** in `reward.ts:316-317`: Verified correct.

7. **SessionStorage validation**: `isValidTx` has both `Number.isFinite(tx.amount)` and `tx.amount > 0`. Correctly protects against NaN.

8. **Optimizer greedy scoring**: `scoreCardsForTransaction` correctly calculates marginal reward via before/after delta. No issues.

9. **Web-side CSV adapter error collection**: `apps/web/src/lib/parser/csv.ts` does NOT collect signature-detection adapter failures into the result (lines 974-984 catch but only `console.warn`). The server-side `packages/parser/src/csv/index.ts:60-63` DOES collect them via `signatureFailures`. This is the D-107 finding (partially addressed). The web-side is missing the error collection that the server-side has.

10. **SpendingSummary localStorage vs sessionStorage**: Line 10 reads from `localStorage` while the rest of the app uses `sessionStorage`. This is the C4-07 deferred finding.

---

## New Findings

**None.** All previously identified issues are either fixed, resolved (were false positives), or actively deferred with documented rationale. The codebase is stable with 266 passing tests, 0 lint errors, 0 type errors, and a successful build.

---

## Correction of Prior Findings

| Prior Finding | Correction |
|---|---|
| C7R-M01 | **FALSE POSITIVE** -- The `byCategory` Map has always been keyed by `categoryKey` (not `tx.category`), so subcategories are correctly separated into their own rows. The label resolution is also correct. |
| C7R-L01 | **RESOLVED** -- The `_bank` parameter already has the underscore prefix convention for intentionally unused parameters. |
| C7R-L02 | **RESOLVED** -- Lint/typecheck gates now pass for all workspaces including the web app test files. |
| C7R-L03 | **RESOLVED** -- Both `formatDateKo` and `formatDateShort` already have `Number.isNaN` guards. |

---

## Summary

No new findings this cycle. Three prior "still-open" findings (C7R-L01, C7R-L02, C7R-L03) are confirmed resolved, and one (C7R-M01) is identified as a false positive from cycle 7. The codebase continues to be stable with all gates green. All remaining deferred items are low-severity and have documented rationale.
