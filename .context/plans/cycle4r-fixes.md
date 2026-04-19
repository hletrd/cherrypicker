# Cycle 4 Re-review Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle4-comprehensive.md` (re-review section)

---

## Task 1: Add `printSpendingSummary` call to CLI report command

- **Finding:** C4R-M01
- **Severity:** MEDIUM (missing functionality)
- **Confidence:** High
- **Files:** `tools/cli/src/commands/report.ts:143`
- **Description:** The CLI `runReport` function calls `printOptimizationResult(result)` but never calls `printSpendingSummary`, which was enhanced in cycle 50 to accept `categoryLabels`. Terminal output is missing the spending-by-category summary table that the HTML report includes.
- **Fix:**
  1. Import `printSpendingSummary` from `@cherrypicker/viz` in `report.ts`.
  2. Add `printSpendingSummary(categorized, categoryLabels);` before the `printOptimizationResult(result);` call.
- **Verification:** Run `cherrypicker report` on a sample statement. Terminal should now show a spending-by-category table before the optimization results.
- **Status:** DONE

---

## Task 2: Standardize server-side CSV adapter `parseAmount` to return 0 instead of NaN

- **Finding:** C4R-M02
- **Severity:** LOW (consistency)
- **Confidence:** High
- **Files:** `packages/parser/src/csv/shinhan.ts:29`, and other server-side CSV adapter files in `packages/parser/src/csv/`
- **Description:** Server-side CSV adapters' `parseAmount` functions return `NaN` when parsing fails, while PDF parsers return `0` to prevent NaN propagation. While each adapter's `parseCSV` loop catches NaN with `isNaN()` checks, the inconsistency creates a maintenance risk.
- **Fix:** Change `if (isNaN(n)) return NaN;` to `if (isNaN(n)) return 0;` in `packages/parser/src/csv/shinhan.ts` and verify the other adapter files in that directory follow the same pattern. Also check the web-side `apps/web/src/lib/parser/csv.ts` for consistency.
- **Verification:** Run `bun test` to ensure no regressions.
- **Status:** DONE

---

## Task 3: Collect content-signature adapter failures into ParseResult.errors

- **Finding:** C4R-L01 (extends D-107)
- **Severity:** LOW (observability)
- **Confidence:** High
- **Files:** `packages/parser/src/csv/index.ts:60-62`
- **Description:** When a content-signature adapter fails in the detection loop (line 60-62), the error is only logged via `console.warn` and not collected into the ParseResult's errors array. This extends D-107.
- **Fix:** After the content-signature detection loop falls through to the generic parser, add any adapter failures to the result's errors array. This requires tracking failures during the loop and passing them to `parseGenericCSV` or appending them after.
- **Verification:** Run `bun test` and verify that adapter failures appear in ParseResult.errors.
- **Status:** DONE

---

## Deferred Items (New from this cycle)

### C4R-M02 (partial): Web-side CSV adapter `parseAmount` returns NaN

- **File+line:** `apps/web/src/lib/parser/csv.ts:121`
- **Original severity/confidence:** LOW / High
- **Reason for deferral:** The web-side CSV adapter's `parseAmount` already uses `isValidAmount` as a guard function, making the NaN return harmless. Changing it would require touching the web-side code which has its own validation layer. The server-side fix (Task 2) addresses the more impactful inconsistency.
- **Exit criterion:** If the web-side parser is refactored to remove `isValidAmount`, change `parseAmount` to return 0 instead of NaN at the same time.

---

## Prior Open Items (carried forward, not re-planned)

The following items from the original cycle 4 review remain open but are deferred per their original priority:

- C4-06: Annual savings projection misleading (LOW)
- C4-07: localStorage vs sessionStorage inconsistency (LOW)
- C4-09: CategoryBreakdown hardcoded colors (LOW)
- C4-10: E2E test stale dist/ dependency (MEDIUM)
- C4-11: No regression test for findCategory fuzzy match (MEDIUM)
- C4-13: Small-percentage bars nearly invisible (LOW)
- C4-14: Stale fallback values in Layout footer (LOW)
