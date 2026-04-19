# Cycle 5 Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle5-comprehensive.md`

---

## Task 1: Fix server-side CSV adapter `parseAmount` to restore NaN error reporting

- **Finding:** C5-M01
- **Severity:** MEDIUM (dead code / silent data corruption)
- **Confidence:** High
- **Files:** `packages/parser/src/csv/shinhan.ts`, `lotte.ts`, `samsung.ts`, `ibk.ts`, `hyundai.ts`, `kb.ts`, `hana.ts`, `bc.ts`, `nh.ts`, `woori.ts`
- **Description:** Each server-side CSV adapter's `parseAmount` returns 0 on NaN (`if (isNaN(n)) return 0;`), but the calling code still checks `if (isNaN(amount))` after calling `parseAmount`. Since `parseAmount` never returns NaN, the `isNaN(amount)` check is dead code. Invalid amounts silently become 0-amount transactions.
- **Fix:**
  1. In each adapter's `parseAmount`, change `if (isNaN(n)) return 0;` to `if (Number.isNaN(n)) return NaN;` -- return NaN on parse failure (matching web-side behavior).
  2. The callers already check `if (isNaN(amount))` and push errors + `continue` -- this will work correctly once `parseAmount` returns NaN.
  3. Also fix: replace `isNaN(n)` with `Number.isNaN(n)` in `parseAmount` (covers C5-M02 as well).
  4. Also fix: replace `isNaN(amount)` with `Number.isNaN(amount)` in the callers (covers C5-M02).
  5. Also fix: replace `isNaN(inst)` with `Number.isNaN(inst)` in the installment parsing (covers C5-M02).
- **Verification:** Run `bun test` to ensure no regressions. Manually verify that a CSV row with unparseable amount (e.g., "abc") now produces an error in `ParseResult.errors` instead of a 0-amount transaction.
- **Status:** TODO

---

## Task 2: Remove unused `nextCount` variable in table-parser.ts

- **Finding:** C5-L02
- **Severity:** LOW (dead code)
- **Confidence:** High
- **Files:** `packages/parser/src/pdf/table-parser.ts:37`
- **Description:** The `detectColumnBoundaries` function reads `charCount[i + 1]` into `nextCount` but never uses it.
- **Fix:** Remove line 37 (`const nextCount = charCount[i + 1] ?? 0;`).
- **Verification:** Run `bun test` and `tsc --noEmit` to ensure no regressions.
- **Status:** TODO

---

## Deferred Items (Active, carried forward)

No new deferred items. Prior deferred items (D-106, D-107, D-110) remain deferred with documented rationale per `.context/plans/00-deferred-items.md`. C5-L01 (duplicate parser implementations) is already deferred as D-01.
