# High Priority Fixes — Cycle 41

## BUG-41-01: OFX `parseOFXDate` timezone bug

**Severity:** Medium
**Files:** `packages/parser/src/ofx/index.ts:88-115`, `apps/web/src/lib/parser/ofx.ts:57-84`
**Description:** When OFX DTPOSTED includes HHMMSS but no timezone offset, tzOffset defaults to 0 and the code adds 9 hours for KST conversion. This treats the input as UTC, but OFX without timezone uses local time (KST). Evening transactions (e.g., 20:00 KST) get shifted to the next day.

**Implementation:**
1. Distinguish between "no timezone specified" (tzOffset undefined) and "timezone is GMT+0" (tzOffset = 0)
2. When no timezone is present, skip the +9h conversion and treat time as KST
3. When timezone IS present, apply the existing conversion logic
4. Update both server-side and web-side parsers
5. Add unit tests

**Exit criterion:** `parseOFXDate('20240115230000')` returns `'2024-01-15'` (not `'2024-01-16'`)

---

## CR-41-01: Amount test precision loss

**Severity:** Medium
**File:** `apps/web/__tests__/amount.test.ts:104-105`
**Description:** Test `expect(parseAmount('9999999999999999')).toBe(9999999999999999)` documents precision loss as expected. Both sides are silently rounded to `10000000000000000`.

**Implementation:**
1. Add MAX_SAFE_INTEGER guard to `parseAmountString` in `packages/parser/src/amount.ts` and `apps/web/src/lib/parser/amount.ts`
2. Return `null` with ParseError when amount exceeds `Number.MAX_SAFE_INTEGER`
3. Update tests to assert error behavior instead of silent rounding
4. Also fix the uncommitted test change for `(-0)`

**Exit criterion:** Tests assert ParseError for amounts above MAX_SAFE_INTEGER; no ts(80008) hints

---

## BUG-41-02: Batch file upload error handling

**Severity:** Medium
**File:** `apps/web/src/lib/analyzer.ts:315-317`
**Description:** `Promise.all` with unwrapped `parseAndCategorize` calls means any single file failure aborts the entire batch.

**Implementation:**
1. Wrap each `parseAndCategorize` call in try/catch
2. Collect per-file errors alongside successful results
3. Proceed with successfully parsed files
4. Include per-file error info in returned `parseErrors`
5. Add tests for mixed success/failure scenarios

**Exit criterion:** Uploading 2 valid files + 1 corrupt file returns results for 2 files with error info for the 3rd

---

## CR-41-05: `cardResults.totalReward` validation gap

**Severity:** Low
**File:** `apps/web/src/lib/store.svelte.ts:295-306`
**Description:** `cardResults` validation checks `typeof cr.totalReward === 'number'` but not `Number.isFinite(cr.totalReward)`.

**Implementation:**
1. Add `Number.isFinite(cr.totalReward)` and `cr.totalReward >= 0` checks
2. Add `cr.cardId.length > 0` check for completeness

**Exit criterion:** Corrupted `totalReward: NaN` or `totalReward: Infinity` is filtered out
