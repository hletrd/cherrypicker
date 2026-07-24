# Code Review — Cycle 42

## CR-42-01: Web-side amount parser parity gap (Medium)
**File:** `apps/web/src/lib/parser/amount.ts:36-37`
**Confidence:** High

Cycle 41 fixed BUG-40-02 in `packages/parser/src/csv/shared.ts` (server-side) but did not propagate the same fix to `apps/web/src/lib/parser/amount.ts` (web-side). The two parsers are supposed to be parity-matched per C28-TEST02 and C100-04, but the web-side is now divergent.

**Fix:** Port the double-negative fix and add the `(-0)` test case to web-side tests.

---

## CR-42-02: Validation inconsistency in loadFromStorage (Medium)
**File:** `apps/web/src/lib/store.svelte.ts:265-356`
**Confidence:** High

The `loadFromStorage` function has inconsistent validation depth:
- `transactionCount` (line 334): `typeof === 'number' && Number.isFinite()`
- `totalTransactionCount` (line 336): `typeof === 'number' && Number.isFinite()`
- `previousMonthSpendingOption` (line 351-352): `typeof === 'number' && Number.isFinite()`
- `optimization.totalReward` (line 270): `typeof === 'number'` ONLY
- `optimization.totalSpending` (line 271): `typeof === 'number'` ONLY
- `optimization.effectiveRate` (line 272): `typeof === 'number'` ONLY
- `monthlyBreakdown[].spending` (line 345): `typeof === 'number'` ONLY
- `monthlyBreakdown[].transactionCount` (line 346): `typeof === 'number'` ONLY

The pattern is: newer fields got full validation, older fields did not get retroactively updated.

**Fix:** Apply `Number.isFinite()` consistently to all numeric fields.

---

## CR-42-03: Parser duplication continues to grow (Low)
**File:** `apps/web/src/lib/parser/amount.ts` vs `packages/parser/src/amount.ts`
**Confidence:** Medium

The web-side and server-side amount parsers have nearly identical logic but are maintained in separate files. Cycle 41 added MAX_SAFE_INTEGER to both, but cycle 41's double-negative fix was only applied to one. This is the exact risk ARCH-41-02 warned about.

**Recommendation:** Prioritize parser unification in a dedicated refactoring cycle.
