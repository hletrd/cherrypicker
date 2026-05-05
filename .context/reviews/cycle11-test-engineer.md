# Cycle 11 — Test Engineer Findings

**Date:** 2026-05-05
**Reviewer:** test-engineer (simulated)
**Scope:** Test coverage, flaky test risks, and verification gaps

## Summary

Cycle 10 added Infinity edge case tests. No new test gaps identified as HIGH or MEDIUM. Two LOW coverage gaps remain.

---

## Findings

### C11-TE01 — [LOW] Infinity edge case tests added and verified

**File:** `packages/parser/__tests__/json.test.ts`
**File:** `packages/parser/__tests__/ofx.test.ts`
**File:** `packages/parser/__tests__/csv-shared.test.ts`

The `d8322a2` commit added `Infinity` and `NaN` edge case tests for amount parsing:
- JSON: `Infinity`, `-Infinity`, `NaN` number inputs return `null`
- JSON: `"Infinity"`, `"NaN"` string inputs return `null`
- OFX: `"Infinity"` amount returns `null`
- CSV shared: `parseAmountString("Infinity")` returns `null`

**Status:** VERIFIED ADDED (cycle 10)

---

### C11-TE02 — [LOW] Merchant matcher length guard tests missing

**File:** `packages/core/__tests__/categorizer.test.ts`

The cycle 10 fix added `lower.length < 2` guard in `MerchantMatcher.match()` and `lower.length >= 3` check for reverse substring matching. No dedicated test cases exercise these boundaries.

**Impact:** Regression risk if the length guard logic is accidentally removed or modified.

**Fix:** Add test cases for:
- Empty string merchant → uncategorized, confidence 0
- Single character merchant → uncategorized, confidence 0
- Two character merchant → forward match only, no reverse substring
- Three character merchant → reverse substring matching enabled

**Confidence:** High

---

### C11-TE03 — [LOW] No test for web-side parser parity

**File:** `apps/web/src/lib/parser/*`

The web-side parsers duplicate server-side logic with browser-compatible imports. There is no automated test verifying that web-side and server-side parsers produce identical output for the same inputs.

**Impact:** Parity drift risk. Past cycles have fixed multiple parity bugs (C9-01, C9-02, C9-03, C99).

**Fix:** Add a parity test that runs both web-side and server-side parsers against the same fixture files and compares results.

**Confidence:** Medium

---

### C11-TE04 — [LOW] No test for reoptimize monthlyBreakdown recalculation

**File:** `apps/web/src/lib/store.svelte.ts:531-551`

The `reoptimize` function recalculates `monthlyBreakdown` from edited transactions. No test verifies that editing a transaction in a non-latest month updates the corresponding monthly breakdown entry.

**Impact:** The logic appears correct (verified by code inspection), but lacks automated regression protection.

**Fix:** Add a unit test in `apps/web/__tests__/` or `packages/core/__tests__/` that mocks the store and verifies monthlyBreakdown updates after reoptimize.

**Confidence:** High

---

### C11-TE05 — [LOW] E2E screenshot tests have no assertions

**File:** `e2e/ui-ux-screenshots.spec.js`

This spec captures screenshots for visual regression but has no programmatic assertions. This is intentional per D7-M9 (cycle 7 deferred).

**Status:** INTENTIONAL — no fix needed

---

## Verdict

**COMMENT** — Test suite is solid. Two LOW coverage gaps for merchant matcher and reoptimize monthlyBreakdown.
