# Cycle 43 Implementation Plan

**Date:** 2026-04-21
**Source:** `.context/reviews/2026-04-21-cycle43-comprehensive.md`

---

## Review Summary

3 findings in this cycle. 2 are new actionable items (C43-01, C43-02). C43-03 is a carry-forward with no fix needed.

| ID | Severity | Confidence | Action |
|---|---|---|---|
| C43-01 | MEDIUM | High | Fix `isOptimizableTx` to filter `amount > 0` instead of `amount !== 0` |
| C43-02 | LOW | High | Remove redundant `Math.abs(tx.amount)` in performanceExclusions |
| C43-03 | LOW | Medium | No fix needed (theoretical edge case, same as C41-04/C42-03) |

---

## Prior Cycle 43 Tasks (from 2026-04-19, now archived)

| Task | Status |
|---|---|
| Add NaN/Infinity guards to report generator `formatWon` and `formatRate` (C43-L02, C43-L03) | DONE |
| Record C43-L01 and C43-L04 as deferred items | DONE |

---

## Task 1: Fix `isOptimizableTx` to filter negative amounts (C43-01)

**File:** `apps/web/src/lib/store.svelte.ts:168`
**Severity:** MEDIUM
**Description:** `isOptimizableTx` uses `obj.amount !== 0` which allows negative amounts to be restored from sessionStorage. After the C42-01 fix (all parsers filter `amount <= 0`), negative amounts should never reach sessionStorage, but this is a consistency gap.
**Fix:** Change line 168 from `obj.amount !== 0` to `obj.amount > 0`
**Verification:** Run `bun test` and `vitest` -- the sessionStorage validation tests should still pass (or be updated if they test negative-amount restoration).
**Status:** DONE

## Task 2: Remove redundant `Math.abs(tx.amount)` in performanceExclusions (C43-02)

**File:** `apps/web/src/lib/analyzer.ts:210`
**Severity:** LOW
**Description:** After C42-01 fix, all transactions reaching `optimizeFromTransactions` have `amount > 0`. The `Math.abs(tx.amount)` at line 210 is therefore redundant. This is also inconsistent with the C42-02 fix which removed `Math.abs()` from the same pattern at line 290.
**Fix:** Change line 210 from `Math.abs(tx.amount)` to `tx.amount`
**Verification:** Run `bun test` and `vitest` -- no behavioral change since all amounts are positive.
**Status:** DONE

---

## Deferred Items (Active)

The following deferred items remain from prior reviews. No new items added this cycle.

| ID | Severity | File | Description | Reason for Deferral |
|---|---|---|---|---|
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` | Bare `catch {}` in `tryStructuredParse` | Low severity; server-side equivalent correctly catches only specific errors |
| D-107 | LOW | `packages/parser/src/csv/index.ts:60-63` | `catch { continue; }` doesn't collect errors | Partially addressed (now logs warnings); full fix requires API change |
| D-110 | LOW | Store/UI | Non-latest month edits have no visible optimization effect | By design: optimization only covers the latest month |
| C4-06/C9-02/D-40/D-82 | LOW | SavingsComparison | Annual savings projection label unchanged | Low severity; label is informative |
| C4-09/D-42/D-46/D-64/D-78/D-96 | LOW | CategoryBreakdown | Hardcoded `CATEGORY_COLORS` map | Cosmetic; missing categories fall through to uncategorized gray |
| C4-10 | MEDIUM | E2E tests | E2E test stale dist/ dependency | E2E tests not in critical path |
| C4-11 | MEDIUM | Core | No regression test for findCategory fuzzy match | Test gap but existing tests cover optimizer |
| C4-13/D-43/D-74 | LOW | CategoryBreakdown | Small-percentage bars nearly invisible | Cosmetic |
| C4-14/D-44 | LOW | Layout | Stale fallback values in footer | Low severity |
| D-01 through D-111 | Various | Various | See `.context/plans/00-deferred-items.md` | Various reasons documented in deferred items file |
