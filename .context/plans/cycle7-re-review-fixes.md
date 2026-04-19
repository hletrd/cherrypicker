# Cycle 7 Implementation Plan (Re-review)

**Date:** 2026-04-19
**Source:** `.context/reviews/_aggregate.md` (cycle 7 deep re-review)

---

## Task 1: Fix category aggregation bug in spending summary -- use categoryKey as Map key

- **Finding:** C7R-M01
- **Severity:** MEDIUM
- **Confidence:** High
- **Files:** `packages/viz/src/terminal/summary.ts:36-39`, `packages/viz/src/report/generator.ts:75-77`
- **Description:** The `byCategory` Map is keyed by `tx.category` (parent ID, e.g., `"dining"`), but the `categoryKey` includes the subcategory (e.g., `"dining.cafe"`). When multiple subcategories exist under a parent, they are merged into a single row with the wrong label. The label resolves from `categoryKey` (e.g., "카페") instead of the parent ("외식").
- **Fix:** Change the Map key from `tx.category` to `categoryKey` in both `printSpendingSummary()` and `buildCategoryTable()`. This produces separate rows for each subcategory, matching the optimization result granularity.
- **Status:** TODO

---

## Task 2: Prefix unused `bank` parameter in web-side `tryStructuredParse`

- **Finding:** C7R-L01
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:236`
- **Description:** The `bank: BankId | null` parameter is declared but never referenced. This produces a lint warning.
- **Fix:** Change `bank: BankId | null` to `_bank: BankId | null` in the function signature.
- **Status:** TODO

---

## Task 3: Fix lint gate failure -- `bun:test` type declaration errors

- **Finding:** C7R-L02
- **Severity:** LOW (lint gate)
- **Confidence:** High
- **Files:** `apps/web/__tests__/analyzer-adapter.test.ts:7`, `apps/web/__tests__/parser-date.test.ts:8`
- **Description:** The `@cherrypicker/web` lint task (svelte-check) fails because `bun:test` module is not found during type-checking. Tests run fine with `bun test` but svelte-check can't resolve the type declarations.
- **Fix:** Add `@types/bun` to the web app's devDependencies so that `bun:test` type declarations are available during lint/type-checking.
- **Status:** TODO

---

## Task 4: Add NaN guard to `formatDateKo` and `formatDateShort`

- **Finding:** C7R-L03
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/formatters.ts:153,164`
- **Description:** `parseInt(m!, 10)` is used without a NaN check. If date parts are malformed (e.g., "2026-ab-15"), the function would produce "2026년 NaN월 NaN일" instead of a fallback.
- **Fix:** Add NaN guard with fallback to `'-'` for both `formatDateKo` and `formatDateShort`.
- **Status:** TODO

---

## Deferred Items (Active)

The following deferred items remain from prior reviews. No new items added this cycle.

| ID | Severity | File | Description | Reason for Deferral |
|---|---|---|---|---|
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` | Bare `catch {}` in `tryStructuredParse` | Low severity; server-side equivalent correctly catches only specific errors; web-side has multiple fallback tiers |
| D-107 | LOW | `packages/parser/src/csv/index.ts:60-63` | `catch { continue; }` doesn't collect errors into ParseResult | Partially addressed by C46-L02 (now logs warnings); full fix would require API change to accumulate errors |
| D-110 | LOW | Store/UI | Non-latest month edits have no visible optimization effect | By design: optimization only covers the latest month; non-latest edits only affect previousMonthSpending |
| C4-06 | LOW | SavingsComparison | Annual savings projection label unchanged | Low severity; label is informative |
| C4-07 | LOW | SpendingSummary | localStorage vs sessionStorage inconsistency | Low severity; both are used for different purposes |
| C4-09 | LOW | CategoryBreakdown | Hardcoded `CATEGORY_COLORS` map | Cosmetic; missing categories fall through to uncategorized gray |
| C4-10 | MEDIUM | E2E tests | E2E test stale dist/ dependency | E2E tests not in critical path |
| C4-11 | MEDIUM | Core | No regression test for findCategory fuzzy match | Test gap but existing tests cover optimizer |
| C4-13 | LOW | CategoryBreakdown | Small-percentage bars nearly invisible | Cosmetic |
| C4-14 | LOW | Layout | Stale fallback values in footer | Low severity |
