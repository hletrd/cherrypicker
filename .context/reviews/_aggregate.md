# Review Aggregate -- 2026-04-19 (Cycle 7 Deep Re-review)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle7-comprehensive.md` (prior C7 review, many findings since fixed)
- Full re-read of all 40+ source files in this cycle

**Prior cycle reviews (still relevant):**
- All cycle 1-48 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-6, 47-50 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-01 | **FIXED** | `SavingsComparison.svelte:262` uses `formatRate(card.rate)` |
| C7-02 | **FIXED** | `SpendingSummary.svelte:111` uses `formatRatePrecise()` |
| C7-03 | **FIXED** | `SavingsComparison.svelte:179` uses `formatRatePrecise()` |
| C7-08 | **FIXED** | `pdf.ts` now has `inferYear()` and handles short Korean dates + MM/DD |
| C7-13 | **FIXED** | `analyzer.ts:167-168` caches by null check, not reference equality |
| C6R-M01 | **FIXED** | Server-side XLSX uses `Number.isNaN()` |
| C6R-M02 | **FIXED** | Web-side CSV/XLSX use `Number.isNaN()` |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |

---

## Still-Open Findings (New and Carried Forward)

### C7R-M01: Category aggregation bug in spending summary -- subcategories merged with wrong label

- **Severity:** MEDIUM
- **Confidence:** High
- **Files:**
  - `packages/viz/src/terminal/summary.ts:36-39`
  - `packages/viz/src/report/generator.ts:75-77`
- **Description:** The `byCategory` Map is keyed by `tx.category` (parent ID), but the `categoryKey` includes the subcategory (e.g., `"dining.cafe"`). The label is resolved from `categoryKey` (which may resolve to `"카페"`) rather than the parent key `"dining"` (which resolves to `"외식"`). This means all subcategories under a parent are summed into one row, but the label is the first subcategory's label, not the parent's. Example: cafe and restaurant transactions merge into one row labeled "카페" instead of "외식".
- **Failure scenario:** Upload a statement with both cafe and restaurant transactions. The spending summary shows one merged row with the wrong category name.
- **Fix:** Change the Map key from `tx.category` to `categoryKey` to produce separate rows for each subcategory, matching the optimization result granularity.

### C7R-L01: Unused `bank` parameter in web-side `tryStructuredParse`

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:236`
- **Description:** The `bank: BankId | null` parameter is declared but never referenced. Produces a lint warning.
- **Fix:** Prefix with underscore: `_bank: BankId | null`.

### C7R-L02: Lint gate failure -- `bun:test` type declaration errors in web app test files

- **Severity:** LOW (lint gate, not runtime)
- **Confidence:** High
- **Files:**
  - `apps/web/__tests__/analyzer-adapter.test.ts:7`
  - `apps/web/__tests__/parser-date.test.ts:8`
- **Description:** The `@cherrypicker/web` lint task reports 5 errors because `bun:test` module is not found during type-checking. Tests run fine with `bun test` but the `svelte-check` lint step fails.
- **Fix:** Add `@types/bun` to the web app's devDependencies, or exclude test files from the lint/typecheck configuration.

### C7R-L03: `formatDateKo`/`formatDateShort` use `parseInt` without NaN guard

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/formatters.ts:153,164`
- **Description:** `parseInt(m!, 10)` without NaN check. If date parts are malformed (e.g., "2026-ab-15"), the function would produce "2026년 NaN월 NaN일".
- **Fix:** Add NaN guard with fallback to `'-'`.

---

## Still-Open Prior Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06 | LOW | Annual savings projection label unchanged |
| C4-07 | LOW | localStorage vs sessionStorage inconsistency in SpendingSummary |
| C4-09 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13 | LOW | Small-percentage bars nearly invisible |
| C4-14 | LOW | Stale fallback values in Layout footer |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | LOW | CSV adapter error collection (partially addressed) |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
