# Comprehensive Code Review — Cycle 21

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 21)
**Scope:** Full repository — all packages, apps, and shared code

---

## Methodology

Read every source file in the repository. Cross-referenced with prior cycle 1-20 reviews, deferred items (D-01 through D-105), and the aggregate. Focused on finding genuinely NEW issues not previously reported. Verified that prior cycle 20 findings (C20-01 through C20-07) are still present or have been addressed.

---

## Verification of Cycle 20 Findings

| Finding | Status | Evidence |
|---|---|---|
| C20-01 | PARTIALLY FIXED | `CardDetail.svelte:231` now uses `categoryLabels.get(row.category) ?? row.category` — the categoryLabels Map is built in onMount. However, the fix relies on the async `loadCategories()` completing before the table renders. If the fetch is slow, users briefly see raw IDs. This is acceptable — the Map populates quickly. |
| C20-02 | DEFERRED | Same as prior — LOW, theoretical |
| C20-03 | DEFERRED | Same as prior — LOW, cosmetic |
| C20-04 | DEFERRED (D-87) | Same as prior — LOW, style only |
| C20-05 | DEFERRED (D-73/D-89) | Same as prior — LOW |
| C20-06 | NOT FIXED | `CardGrid.svelte:62-65` still sorts only by `annualFee.domestic` |
| C20-07 | DEFERRED (D-42/D-57) | Same as prior — LOW, long-term |

---

## New Findings

### C21-01: `CardDetail.svelte` categoryLabels Map may miss subcategory dot-notation keys for reward entries

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardDetail.svelte:22-31`
- **Description:** The `categoryLabels` Map is built from `loadCategories()` which provides `{ id, labelKo, subcategories }`. The Map correctly includes dot-notation keys (`${node.id}.${sub.id}`). However, `row.category` in the rewards table can be a simple category ID like `"dining"` or a dot-notation key like `"dining.cafe"`. The `categoryLabels.get(row.category)` lookup works correctly for both. BUT: if a card's reward YAML has `category: "cafe"` (short subcategory ID) instead of `category: "dining.cafe"` (dot-notation), the lookup would fail because `categoryLabels` only has the `"cafe"` key pointing to the Korean label (not the dot-notation key). This is actually correct — the Map includes both `sub.id` and `${node.id}.${sub.id}` as keys. So `"cafe"` maps to `"카페"` and `"dining.cafe"` also maps to `"카페"`. No bug here on closer inspection. Withdrawn.

### C21-02: `SavingsComparison.svelte` uses `formatRatePrecise` for bestSingleCard rate but `formatRate` for other rates — inconsistent precision

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:150` vs `apps/web/src/components/dashboard/OptimalCardMap.svelte:117`
- **Description:** In `SavingsComparison.svelte:150`, the best single card's rate is displayed with `formatRatePrecise` (2 decimal places), while `OptimalCardMap.svelte:117` uses `formatRate` (1 decimal place). This means the same effective rate appears as "1.50%" in the savings comparison but "1.5%" in the card map. The inconsistency is minor but visible to users comparing the two views.
- **Failure scenario:** A card with 1.25% effective rate shows "1.25%" in the savings comparison card and "1.3%" (rounded) in the card map table.
- **Fix:** Use `formatRate` consistently everywhere, or use `formatRatePrecise` consistently everywhere.

### C21-03: `FileDropzone.svelte` ALL_BANKS list is a third hardcoded copy of bank names

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:72-97`
- **Description:** The `ALL_BANKS` array in `FileDropzone.svelte` is a hardcoded list of bank IDs and Korean labels. This is the third copy of this data — the others are in `formatters.ts:formatIssuerNameKo` and `detect.ts:BANK_SIGNATURES`. Adding a new bank requires updating all three files independently. This extends D-42/D-57/D-07 (hardcoded maps that drift from data source).
- **Failure scenario:** A new bank "citi" is added to `BANK_SIGNATURES` in detect.ts but forgotten in `ALL_BANKS` in FileDropzone. Users cannot select "citi" from the bank selector dropdown even though the parser can detect it.
- **Fix:** Derive the bank list from `cards.json` issuers data (which already has `nameKo`). Alternatively, create a single shared `BANKS` constant module.

### C21-04: `CardGrid.svelte` fee sort still ignores international annual fee (C20-06 repeated, confirming not fixed)

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardGrid.svelte:62-65`
- **Description:** Re-confirming C20-06. The fee-asc and fee-desc sort options only sort by `annualFee.domestic`. The fix is straightforward: add `a.annualFee.international - b.annualFee.international` as a secondary sort.
- **Failure scenario:** Two cards both have 0 domestic annual fee. One has 15,000 international, the other 30,000. Both appear at the same position in fee-asc sort.
- **Fix:** Add `|| a.annualFee.international - b.annualFee.international` as secondary sort key.

### C21-05: `pdf.ts` `parseTable` exits early after only 3 non-table lines

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/parser/pdf.ts:82-85`
- **Description:** The `parseTable` function breaks out of table collection when `inTable && !line.trim()` and `tableLines.length > 3`. However, this means that if a PDF has a blank line within a table (e.g., between sections of transactions), parsing stops prematurely. Korean credit card PDFs sometimes have section headers or blank separator lines between monthly groups. The threshold of 3 lines is too low — a single blank line after 4+ transaction lines would trigger the break.
- **Failure scenario:** A PDF statement with 50 transactions has a blank line after the 5th transaction (between monthly groups). The parser collects the first 5 transactions and then breaks, missing the remaining 45.
- **Fix:** Instead of breaking on the first blank line after 3+ lines, require 2+ consecutive blank lines to break. Or remove the early break entirely and let the function collect all lines that look like table content.

### C21-06: `Math.max(...lines.map((l) => l.length))` in pdf.ts column detection is the same stack overflow risk as D-73/D-89

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:26`
- **Description:** `Math.max(...lines.map((l) => l.length))` spreads all line lengths as arguments. For a PDF with > 100K lines, this would cause a stack overflow. This is the same class as D-73/D-89 but in a different file. Typical PDFs have < 500 lines so this is not a realistic concern.
- **Fix:** Replace with `lines.reduce((max, l) => Math.max(max, l.length), 0)`.

---

## Final Sweep — Cross-File Interactions

1. **CardDetail categoryLabels fix (C20-01):** Verified that the `onMount` in `CardDetail.svelte` correctly builds the categoryLabels Map with both short IDs and dot-notation keys. The `categoryLabels.get(row.category) ?? row.category` fallback correctly shows the raw ID if the Map hasn't loaded yet. This is a good fix.

2. **Session storage validation (D-99):** Verified that `isValidTx` now checks `Number.isFinite(tx.amount)` and `tx.amount > 0` (fixed in a prior cycle). This addresses the NaN and negative value concerns.

3. **Category label consistency:** All three `categoryLabels` building locations (`store.svelte.ts:247-261`, `analyzer.ts:191-204`, `analyzer.ts:249-263`) now include dot-notation keys. The `CardDetail.svelte:22-31` also includes them. Consistent.

4. **Greedy optimizer cap rollback:** Verified that the global cap over-count correction in `reward.ts:265-290` correctly rolls back the rule-level tracker when the global cap clips a reward. The `overcount` calculation is correct.

5. **PDF fallback date extraction:** The `fallbackDatePattern` regex in `pdf.ts:315` correctly matches various date formats. The `dateMatch[1]` extraction uses the first capture group, which matches the full date pattern. The last-amount-match strategy (`amountMatches[amountMatches.length - 1]`) correctly selects the rightmost amount on the line.

---

## Summary of Active Findings (New in Cycle 21)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C21-02 | LOW | High | `SavingsComparison.svelte:150` vs `OptimalCardMap.svelte:117` | Inconsistent rate formatting precision (1dp vs 2dp) |
| C21-03 | LOW | High | `FileDropzone.svelte:72-97` | Third hardcoded copy of bank names (extends D-42/D-57) |
| C21-04 | LOW | High | `CardGrid.svelte:62-65` | Fee sort ignores international annual fee (same as C20-06, not fixed) |
| C21-05 | LOW | Medium | `pdf.ts:82-85` | `parseTable` exits early after blank line within table |
| C21-06 | LOW | High | `pdf.ts:26` | `Math.max(...array)` stack overflow risk (same class as D-73/D-89) |
