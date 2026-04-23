# Cycle 7 Implementation Plan (Re-review) -- ARCHIVED

**Date:** 2026-04-19
**Source:** `.context/reviews/_aggregate.md` (cycle 7 deep re-review)
**Archived:** 2026-04-19 (cycle 51)

---

## Task 1: Fix category aggregation bug in spending summary -- use categoryKey as Map key

- **Finding:** C7R-M01
- **Status:** RESOLVED -- FALSE POSITIVE
- **Resolution:** The `byCategory` Map has always been keyed by `categoryKey` (not `tx.category`). Verified in `summary.ts:31-32` and `generator.ts:70`. Subcategories are correctly separated into their own rows with correct labels. The original finding incorrectly described the Map as being keyed by `tx.category`.

---

## Task 2: Prefix unused `bank` parameter in web-side `tryStructuredParse`

- **Finding:** C7R-L01
- **Status:** RESOLVED
- **Resolution:** `apps/web/src/lib/parser/pdf.ts:236` already uses `_bank: BankId | null` (underscore prefix convention for intentionally unused parameters).

---

## Task 3: Fix lint gate failure -- `bun:test` type declaration errors

- **Finding:** C7R-L02
- **Status:** RESOLVED
- **Resolution:** `bun run lint` and `bun run typecheck` now pass with 0 errors across all workspaces including `@cherrypicker/web`.

---

## Task 4: Add NaN guard to `formatDateKo` and `formatDateShort`

- **Finding:** C7R-L03
- **Status:** RESOLVED
- **Resolution:** `apps/web/src/lib/formatters.ts:153-156` and `164-168` both have `if (Number.isNaN(mNum) || Number.isNaN(dNum)) return '-';` guards.

---

All tasks resolved. No implementation work needed. Plan archived.
