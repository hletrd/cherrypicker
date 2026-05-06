# Code Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** code-reviewer
**Cycle:** 41 / 100

---

## Verified Fixed (from Cycle 40)

| ID | Finding | File | Status |
|----|---------|------|--------|
| BUG-40-02 | `parseAmountString` double-negative: `(-1234)` -> positive | `csv/shared.ts:165-173` | **FIXED** — inner `-` prefix now sets `isNeg = false` |
| CR-40-01 | `analyze()` stores unvalidated `previousMonthSpending` | `store.svelte.ts:490-492` | **FIXED** — `Number.isFinite()` guard added |
| BUG-40-01 | NaN persists to sessionStorage via `typeof === 'number'` | `store.svelte.ts:347` | **FIXED** — `Number.isFinite()` validation in `loadFromStorage` |

---

## New Findings

### CR-41-01: Numeric literal precision loss in amount tests (Medium)

**File:** `apps/web/__tests__/amount.test.ts:104-105`
**Confidence:** High

```typescript
expect(parseAmount('9,999,999,999,999,999')).toBe(9999999999999999);
expect(parseAmount('9999999999999999')).toBe(9999999999999999);
```

`9999999999999999` exceeds `Number.MAX_SAFE_INTEGER` (9007199254740991). JavaScript silently rounds it to `10000000000000000`. The `toBe` assertion passes by accident — both sides are the same imprecise value — but the test documents incorrect expected behavior. Users parsing amounts above ~9 quadrillion Won will get silently rounded results.

**Fix:** Either cap parsed amounts at `MAX_SAFE_INTEGER` and test the cap, or document the precision limit. The TypeScript compiler already surfaces this as ts(80008) hint.

---

### CR-41-02: `previousMonthSpending` not validated at `analyzeMultipleFiles` call site (Low)

**File:** `apps/web/src/lib/analyzer.ts:381-392`
**Confidence:** Medium

`previousMonthSpending` is computed from `monthlySpending.get(previousMonth)` or `options?.previousMonthSpending`, then passed directly to `optimizeFromTransactions()`. While `optimizeFromTransactions()` validates it (line 230-234), the validation happens inside a different async function. A negative or NaN value from corrupted `monthlySpending` Map data (e.g., if the Map was mutated externally) would propagate before being caught.

**Fix:** Add an inline guard before the `optimizeFromTransactions` call, or tighten the `monthlySpending` accumulation to ensure only positive finite values are stored.

---

### CR-41-03: `parseOFXDate` timezone math applies KST offset even when no timezone present (Medium)

**File:** `packages/parser/src/ofx/index.ts:88-115` and `apps/web/src/lib/parser/ofx.ts:57-84`
**Confidence:** High

When OFX includes a time component (HHMMSS) but no timezone offset, `tzOffset` defaults to 0. The code computes:
```
Date.UTC(year, month, day, hour, minute, second) - 0 + 9 * 3600000
```
This assumes the input time is UTC and adds 9 hours. But OFX without timezone uses local time (KST for Korean banks). For evening transactions (e.g., 20:00 KST), adding 9 hours shifts the UTC timestamp past midnight, producing the wrong date.

**Fix:** When `tzOffset` is undefined (not 0), skip the timezone conversion and treat the time as already KST.

---

### CR-41-04: `findField` allocates Map per object in JSON parser (Low)

**File:** `packages/parser/src/json/index.ts:67-83` and `apps/web/src/lib/parser/json.ts:67-83`
**Confidence:** Medium

The lowercase lookup map is built fresh for every transaction object. For a 10,000-transaction JSON file, this creates 10,000 temporary Maps. The allocation cost dominates parsing time for large files.

**Fix:** Pre-build lowercase alias Sets/Maps once, or use a two-pass approach: exact match first (no allocation), case-insensitive only when exact fails.

---

### CR-41-05: `cardResults` validation in `loadFromStorage` misses `totalReward` finiteness (Low)

**File:** `apps/web/src/lib/store.svelte.ts:295-306`
**Confidence:** Medium

The `cardResults` validation checks `typeof cr.totalReward === 'number' && Array.isArray(cr.byCategory)` but does not verify `Number.isFinite(cr.totalReward)`. A corrupted `totalReward` of `NaN` or `Infinity` would pass validation and propagate to dashboard components.

**Fix:** Add `Number.isFinite(cr.totalReward)` and `cr.totalReward >= 0` checks.

---

## Carryover (still open from prior cycles)

| ID | Description | File | Severity |
|----|-------------|------|----------|
| CR-15 | ReDoS risk in SUMMARY_ROW_PATTERN | `column-matcher.ts:93` | Medium |
| CR-01 | Silent JSON.parse error swallowing | `detect.ts:286` | Medium |
| CR-02 | Silent HTML parser error swallowing | `html/index.ts:48` | Medium |
| CR-10 | Outdated hardcoded model name | `extractor.ts:34` | Low |
| CR-09 | Windows path bug in CLI | `tools/cli/` | Medium |

---

## Final Sweep

- No new ReDoS patterns introduced since cycle 40.
- All new parser code (HTML/OFX/JSON) has been reviewed against both server and web implementations.
- The uncommitted change in `amount.test.ts` (changing `(-0)` expectation from `-0` to `0`) is correct — the function already returns `0` via the `result === 0 ? 0 : result` guard.
