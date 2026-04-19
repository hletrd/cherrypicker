# Cycle 6 Re-review Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle6-comprehensive.md`

---

## Task 1: Replace `isNaN()` with `Number.isNaN()` in server-side XLSX parser

- **Finding:** C6R-M01
- **Severity:** MEDIUM (consistency / correctness)
- **Confidence:** High
- **Files:** `packages/parser/src/xlsx/index.ts:137,147`
- **Description:** The server-side XLSX parser's `parseAmount` function uses `isNaN(n)` at line 137 and `parseInstallments` uses `isNaN(n)` at line 147. All 10 server-side CSV adapters were fixed in cycle 5 to use `Number.isNaN()`, but the XLSX parser was missed.
- **Fix:** Replace `isNaN(n)` with `Number.isNaN(n)` in both locations.
- **Verification:** Run `bun test` and `tsc --noEmit` in `packages/parser`. Both should succeed with no errors.
- **Status:** DONE

---

## Task 2: Replace `isNaN()` with `Number.isNaN()` in web-side CSV/XLSX installment parsing

- **Finding:** C6R-M02
- **Severity:** LOW (consistency)
- **Confidence:** High
- **Files:** `apps/web/src/lib/parser/csv.ts:258,334,399,465,531,596,662,728,793,859,924` (11 occurrences in bank adapter installment parsing), `apps/web/src/lib/parser/xlsx.ts:304`
- **Description:** The web-side CSV bank adapters use `isNaN(inst)` for installment parsing in all 10 bank-specific adapters. The server-side CSV adapters were fixed in cycle 5 to use `Number.isNaN(inst)`. The web-side `parseAmount()` at line 121 correctly uses `Number.isNaN()`, and the `isValidAmount()` helper at line 128 uses `Number.isNaN()`, but the installment parsing in the individual bank adapters was not updated. Similarly, `apps/web/src/lib/parser/xlsx.ts:304` uses `!isNaN(n)` for installment parsing.
- **Fix:** Replace all `isNaN(inst)` with `Number.isNaN(inst)` in the 11 web-side CSV bank adapter locations. Replace `!isNaN(n)` with `!Number.isNaN(n)` in the web-side XLSX parser.
- **Verification:** Run `bun test` and check that the web app builds successfully with `bun run build`.
- **Status:** DONE

---

## Deferred Items (Active, carried forward)

No new deferred items. Prior deferred items (D-106, D-107, D-110) remain deferred with documented rationale per `.context/plans/00-deferred-items.md`.
