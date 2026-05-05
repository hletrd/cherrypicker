# Plan: Cycle 7 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle7-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [LOW] Add date length guard in test file `analyzer-adapter.test.ts` (C7-01)

**File:** `apps/web/__tests__/analyzer-adapter.test.ts:236,271`
**Problem:** The test file reproduces the monthlyBreakdown and previousMonthSpending calculations from `analyzer.ts` but uses `tx.date.slice(0, 7)` without the `tx.date.length >= 7` guard that exists in the production code. This is a test-code inconsistency -- if test fixtures ever include short/malformed dates, the test would produce different results from production.
**Fix:** Add the same `if (tx.date.length >= 7)` guard in the test's local monthlySpending calculation at lines 236 and 271 to mirror the production code exactly.

Line 236: Change `const month = tx.date.slice(0, 7);` to add a length check before slicing.
Line 271: Change `const months = new Set(txs.map(tx => tx.date.slice(0, 7)));` to filter for valid-length dates first.

**Status:** DONE

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
| C4-06/C52-03/C9-02 | LOW severity; annual projection label partially addressed; UX team input needed | UX review recommends different label |
| C4-09/C52-05 | LOW severity; dark mode contrast acceptable for most colors; design token migration is larger effort | Design system integration planned |
| C4-10 | MEDIUM severity; E2E test infrastructure change; out of scope | E2E test framework refactor |
| C4-11 | MEDIUM severity; requires new test infrastructure; out of scope | Test coverage sprint |
| C4-13/C9-08 | LOW severity; visual polish; small bars still visible at wider widths | Design review |
| C9-04 | LOW severity; complex regex works correctly for all known PDF formats | PDF parser rewrite |
| C9-06 | LOW severity; rounding affects only edge cases with many tiny categories | Threshold adjustment PR |
| C9-07 | LOW severity; theoretical; no real datasets approach the limit | Large dataset reported |
| C9-09 | LOW severity; categories cache is static JSON; invalidation not needed | Dynamic category loading implemented |
| C9-10 | LOW severity; double-decode is harmless; re-encode is defensive | XLSX parser refactor |
| C9-12 | LOW severity; module-level cache is intentional for static JSON data | Store architecture change |
| D-66 | LOW severity; issuer filter UX is functional; existing $effect resets stale filters | UX redesign |
| D-106 | LOW severity; bare catch in tryStructuredParse is acceptable for resilience | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
