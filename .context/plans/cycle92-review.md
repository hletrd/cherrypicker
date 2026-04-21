# Cycle 92 Plan — Savings Sign-Prefix Dedup + Documentation

## New Findings Addressed

### C92-01: Savings sign-prefix logic triplicated across components (LOW, MEDIUM confidence)

**File:** `ReportContent.svelte:48`, `SavingsComparison.svelte:242-244`, `VisibilityToggle.svelte:97`

**Problem:** The sign-prefix logic (showing '+' when savings >= 100, using Math.abs() for negative values, and determining the label from `opt.savingsVsSingleCard`) is duplicated across three components without a shared helper. This creates a maintenance risk where a fix to one copy might not be applied to the others.

**Plan:** Extract a shared `formatSavingsValue(value: number, animatedValue?: number)` helper in `formatters.ts` that encapsulates:
1. The '+' prefix decision (value >= 100)
2. The Math.abs() on the displayed value
3. The label determination ("추가 절약" vs "추가 비용")

Then update all three components to use the shared helper.

**Status:** Not implemented this cycle — LOW severity, no functional impact. Carried forward as a maintainability improvement.

---

### C92-02: ALL_BANKS 5th copy of bank list (LOW, LOW confidence)

**File:** `FileDropzone.svelte:80-105`

**Problem:** Already tracked as C74-05/C7-07. The ALL_BANKS array in FileDropzone is the 5th copy of the bank list that needs to stay in sync with BANK_SIGNATURES (detect.ts), BANK_COLUMN_CONFIGS (xlsx.ts), formatIssuerNameKo (formatters.ts), and getIssuerColor (formatters.ts).

**Plan:** Same as C74-05 — extract a shared `banks.ts` module that exports both the bank ID list and the display metadata. This is blocked on the D-01 architectural refactor (shared parser module between Bun and browser).

**Status:** Deferred — same exit criterion as D-01/D-57.

---

## Previously Implemented Items (Verified This Cycle)

- C91-01: **CONFIRMED FIXED** — `Math.abs()` applied unconditionally to displayed animated values in `SavingsComparison.svelte:242,244`. No further action needed.

---

## Archived Plans (Fully Implemented)

All prior cycle plans through C91 have been fully implemented. The codebase is stable with no regressions.
