# Test Engineering Review — Cycle 42

## TE-42-01: No web-side test for double-negative (Medium)
**File:** `apps/web/__tests__/amount.test.ts`
**Confidence:** High

The web-side amount test file does not include a test for `(-1234)`. The server-side test (`packages/parser/__tests__/amount.test.ts:82-86`) covers this since cycle 41, but the web-side equivalent does not.

**Fix:** Add `expect(parseAmount('(-1234)')).toBe(-1234)` to web-side tests.

---

## TE-42-02: No test for NaN in optimization scalars (Medium)
**File:** `apps/web/__tests__/` (no test for loadFromStorage corruption)
**Confidence:** High

There are no tests verifying that `loadFromStorage` rejects `optimization.totalReward: NaN`, `totalSpending: NaN`, or `effectiveRate: NaN`.

**Fix:** Add sessionStorage corruption tests for these fields.

---

## TE-42-03: No test for monthlyBreakdown NaN (Low)
**File:** `apps/web/__tests__/` (no test for monthlyBreakdown corruption)
**Confidence:** Medium

There are no tests verifying that `loadFromStorage` rejects `monthlyBreakdown` entries with NaN spending or transactionCount.

**Fix:** Add corruption test for monthlyBreakdown entries.

---

## Carryover test gaps (still present from prior cycles)
- TE-37-01: No tests for OFX CCSTMTRS credit card statements
- TE-37-02: No tests for HTML forward-fill (web-side)
- TE-41-04: No tests for normalizeHTML security patterns
