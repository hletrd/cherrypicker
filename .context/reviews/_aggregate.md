# Review Aggregate -- 2026-04-19 (Cycle 37)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle37-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-36 per-agent and aggregate files

---

## Deduplication with Prior Reviews

Cycle 36 findings C36-01 and C36-02 are CONFIRMED ALREADY FIXED in the current codebase. Deferred item D-99 is also CONFIRMED FIXED. Cycle 37 finding C37-01 is NEW and requires implementation.

---

## Verification of Cycle 36 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C36-01 | **FIXED** | `apps/web/src/lib/parser/csv.ts:258` now uses `inst > 1` instead of `inst > 0` |
| C36-02 | **FIXED** | `packages/parser/src/xlsx/index.ts:128` now uses `Math.round(raw)` for numeric values |

---

## Verification of Deferred Item Fix

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` now has `Number.isFinite(tx.amount) && tx.amount > 0` in `isValidTx` |

---

## Active Findings (New in Cycle 37)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C37-01 | LOW | High | `packages/parser/src/pdf/index.ts:98` | Server-side PDF `parseAmount` returns NaN for unparseable amounts instead of 0 -- inconsistent with web-side, creates fragile NaN-propagation risk if new code paths skip NaN guard | PENDING |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
