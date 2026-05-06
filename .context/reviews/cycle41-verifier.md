# Verifier Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** verifier
**Cycle:** 41 / 100

---

## Verification Results

### Cycle 40 Fixes

| ID | Claim | Status | Evidence |
|----|-------|--------|----------|
| BUG-40-02 | `(-1234)` no longer flips sign | **VERIFIED** | `csv/shared.ts:170-172` sets `isNeg = false` for inner negatives |
| BUG-40-01 | NaN blocked from sessionStorage | **VERIFIED** | `store.svelte.ts:347-350` uses `Number.isFinite()` |
| CR-40-01 | `analyze()` validates previousMonthSpending | **VERIFIED** | `store.svelte.ts:494-500` checks `Number.isFinite()` and `>= 0` |

### Carryover Verifications

| ID | Status | Notes |
|----|--------|-------|
| C32-V07 (FIFO cache) | **STILL BROKEN** | `matcher.ts:128` still uses FIFO, not LRU |
| C32-V03 (Web UTF-16) | **STILL BROKEN** | `parser/index.ts:26` no UTF-16 support |
| C32-V08 (AbortController reuse) | **STILL BROKEN** | `fetcher.ts:38` still reuses controller |
| BUG-3 (NaN propagation) | **PARTIALLY FIXED** | Core fixed (C39), store fixed (C40), analyzer.ts:381 still unguarded |

---

## New Verifications

### V-41-01: `parseAmountString('(-0)')` behavior

**Status:** VERIFIED — returns `0`, not `-0`. The `result === 0 ? 0 : result` guard at line 191 normalizes `-0` to `0`. The uncommitted test change from `.toBe(-0)` to `.toBe(0)` is correct.

### V-41-02: `previousMonthSpending` in `reoptimize()`

**Status:** VERIFIED — lines 586-588 validate with `Number.isFinite()` and `>= 0`. Lines 589-595 preserve the explicit user input. Correct.

### V-41-03: `parseOFXDate` with time-only input

**Status:** CONFIRMED BUG — traced with `20240115230000` (no timezone):
- `Date.UTC(2024, 0, 15, 23, 0, 0)` = 1705369200000 (23:00 UTC)
- `+ 32400000` = 1705401600000 = 2024-01-16 08:00 UTC
- `getUTCDate()` = 16 (WRONG — should be 15)

This confirms BUG-41-01 / CR-41-03.

### V-41-04: `cardResults` validation in `loadFromStorage`

**Status:** CONFIRMED GAP — `totalReward` is checked as `typeof === 'number'` but not `Number.isFinite()`. A corrupted `totalReward: NaN` would pass validation.
