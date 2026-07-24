# High Priority Fixes — Cycle 42

> **Status (verified 2026-07-24): CLOSED — no code changes required.**
> This plan was written against commit `7fa6eef`. HEAD has since advanced past
> it; the web-side parser was unified into `@cherrypicker/parser/browser`
> (`375f0f2`) and persistence validation was rewritten into `persistence.ts`
> (`09c8e0c`, `09b8fb9`, `774d896`, …). Re-verification against the current tree:
> BUG-42-01 (`amount.ts` re-export preserves `(-1234)`), BUG-42-02
> (`persistence.ts:749-753`), BUG-42-03 (`persistence.ts:830-832`), BUG-42-04
> (`persistence.ts:829` `isYearMonth`) are all already resolved. The only
> remaining gap was explicit NaN regression tests for effectiveRate and
> monthlyBreakdown (TE-42-02/03), added this cycle in
> `apps/web/__tests__/store-persistence.test.ts`. See
> `.context/reviews/cycle42-aggregate.md` → "Post-Review Resolution" for the
> full evidence table. Deferred items below remain intentionally deferred.


## BUG-42-01: Web-side parseAmount double-negative (HIGH)

**Severity:** High
**Files:** `apps/web/src/lib/parser/amount.ts:36-37`, `apps/web/__tests__/amount.test.ts`
**Description:** Web-side amount parser is missing the double-negative fix from cycle 41. `(-1234)` returns positive 1234 instead of -1234.

**Implementation:**
1. Change `const isNegative` to `let isNegative` in `apps/web/src/lib/parser/amount.ts`
2. After stripping parentheses, check if inner value starts with `-` and set `isNegative = false`
3. Add test for `(-1234)`, `(-1,234)`, `(-0)` to `apps/web/__tests__/amount.test.ts`

**Exit criterion:** `parseAmount('(-1234)')` returns `-1234` on web-side

---

## BUG-42-02: optimization scalar fields validation gap (Medium)

**Severity:** Medium
**File:** `apps/web/src/lib/store.svelte.ts:270-272`
**Description:** `optimization.totalReward`, `totalSpending`, `effectiveRate` use `typeof === 'number'` without `Number.isFinite()`. Corrupted sessionStorage can propagate NaN/Infinity.

**Implementation:**
1. Add `Number.isFinite()` guard for `totalReward`
2. Add `Number.isFinite()` guard for `totalSpending`
3. Add `Number.isFinite()` guard for `effectiveRate`

**Exit criterion:** NaN/Infinity in any of these three fields causes the entire optimization block to be rejected

---

## BUG-42-03: monthlyBreakdown entry validation gap (Medium)

**Severity:** Medium
**File:** `apps/web/src/lib/store.svelte.ts:345-346`
**Description:** `monthlyBreakdown` entry `spending` and `transactionCount` use `typeof === 'number'` without `Number.isFinite()`.

**Implementation:**
1. Add `Number.isFinite()` guard for `spending` (default to 0 if invalid)
2. Add `Number.isFinite()` guard for `transactionCount` (default to 0 if invalid)

**Exit criterion:** NaN in monthlyBreakdown entries is replaced with 0

---

## Deferred

| ID | Description | File | Severity | Reason |
|----|-------------|------|----------|--------|
| BUG-42-04 | monthlyBreakdown month empty string | `store.svelte.ts:344` | Low | Cosmetic; empty month renders as blank label |
| CR-42-03 | Parser duplication | `packages/parser/` vs `apps/web/` | Low | Large refactoring; needs dedicated cycle |
| SEC-42-01 | safeJSONParse incomplete keys | `store.svelte.ts:220-231` | Low | Defense-in-depth; modern browsers hardened |
| BUG-3 | NaN in analyzer.ts monthlySpending | `analyzer.ts:381` | High | Partially fixed; isOptimizableTx guards transactions |
| BUG-4 | EUC-KR detection | `xlsx.ts:99` | High | Requires encoding detection library |
| CR-15 | ReDoS in SUMMARY_ROW_PATTERN | `column-matcher.ts:93` | Medium | Complex regex; needs careful replacement |
| SEC-01 | CSP unsafe-inline | `Layout.astro:50` | Medium | Requires Astro build config change |
| PERF-02 | Optimizer O(C*T^2) | `greedy.ts:39-71` | Medium | Needs benchmarking |
| TE-37-01 | No OFX CCSTMTRS tests | `ofx/index.ts` | Medium | Test infrastructure gap |
| TE-37-02 | No HTML forward-fill tests | `html.ts` | Medium | Test infrastructure gap |
