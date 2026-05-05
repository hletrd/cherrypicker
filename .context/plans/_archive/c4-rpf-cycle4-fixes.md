# Cycle 4 (RPF) — Implementation Plan (2026-04-24)

**Source reviews:** `.context/reviews/c4-*.md`, `.context/reviews/_aggregate.md`

---

## Task 1: Fix SavingsComparison.svelte empty-state link to use buildPageUrl() [C4-01]

- **Severity:** MEDIUM (part of systematic incomplete-fix pattern), Confidence: High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:321`
- **Description:** The empty-state "명세서 올리러 가기" link uses `import.meta.env.BASE_URL ?? '/'` instead of `buildPageUrl()`. C3-05 fixed the breakdown table headers but missed this link.
- **Implementation:**
  1. Verify that `buildPageUrl` is already imported in SavingsComparison (it should be from C3-05).
  2. Check if `homeUrl` const already exists (from C3-05 fix).
  3. Replace `href={import.meta.env.BASE_URL ?? '/'}` at line 321 with `href={homeUrl}`.
- **Status:** DONE — Added `buildPageUrl` import, added `homeUrl` const, replaced raw BASE_URL at line 321.

## Task 2: Fix SpendingSummary.svelte empty-state link to use buildPageUrl() [C4-01]

- **Severity:** MEDIUM (part of systematic incomplete-fix pattern), Confidence: High
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:180`
- **Description:** Same pattern — raw BASE_URL instead of buildPageUrl(). This component was never in C3-05's scope.
- **Implementation:**
  1. Import `buildPageUrl` from `../../lib/formatters.js`.
  2. Add `const homeUrl = buildPageUrl('');` in the script block.
  3. Replace `href={import.meta.env.BASE_URL ?? '/'}` at line 180 with `href={homeUrl}`.
- **Status:** DONE — Added `buildPageUrl` import, added `homeUrl` const, replaced raw BASE_URL at line 180.

## Task 3: Add scope="col" to TransactionReview.svelte table headers [C4-01]

- **Severity:** MEDIUM (part of systematic incomplete-fix pattern), Confidence: High
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:276-280`
- **Description:** All 5 `<th>` elements in TransactionReview lack `scope="col"`. C3-04 fixed other tables but missed this one.
- **Implementation:**
  1. Add `scope="col"` to each of the 5 `<th>` elements at lines 276-280.
- **Status:** DONE — Added `scope="col"` to all 5 `<th>` elements.

## Task 4: Fix ReportContent summary table row headers — td to th scope="row" [C4-02]

- **Severity:** LOW, Confidence: High
- **File:** `apps/web/src/components/report/ReportContent.svelte:36-59`
- **Description:** The summary key-value table uses `<td>` for row-label cells instead of `<th scope="row">`. WCAG 1.3.1 structural accessibility issue. New finding — not identified in any previous cycle.
- **Implementation:**
  1. Change the 6 left-column `<td>` elements (lines 36, 40, 44, 48, 54, 58) to `<th scope="row">`.
  2. Add `text-left` class to maintain left alignment (since `<th>` defaults to center in some browsers).
- **Status:** DONE — Changed all 6 left-column `<td>` elements to `<th scope="row">` with `text-left` class.

## Task 5: Verify no remaining raw BASE_URL in Svelte components [C4-01 verification]

- **Severity:** MEDIUM (verification step), Confidence: High
- **Description:** After fixing Tasks 1 and 2, grep for `import.meta.env.BASE_URL` in all `.svelte` files. The only acceptable remaining instances are in `formatters.ts` (which defines `buildPageUrl`) and `cards.ts` (which uses it for a different purpose). CardPage.svelte uses it as a base for string concatenation and may warrant a separate decision.
- **Implementation:**
  1. Run grep for `import.meta.env.BASE_URL` in all `.svelte` files.
  2. Verify zero results in dashboard components (SavingsComparison, SpendingSummary, CategoryBreakdown, OptimalCardMap, TransactionReview, ReportContent).
- **Status:** DONE — Also fixed CardPage.svelte (replaced raw BASE_URL with `buildPageUrl()`). Grep confirms zero remaining raw BASE_URL usage in `.svelte` files.

---

## Deferred Items

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---------|----------|------------|---------------------|----------------|
| C4-03 | LOW | Low | No test coverage for scope="col" accessibility. Would require Playwright + axe-core setup, which is a significant infrastructure investment. | If accessibility audit infrastructure is added to the e2e test suite, add scope="col" assertions. |
| C4-04 | LOW | Low | No lint rule to enforce buildPageUrl() over raw BASE_URL. Could add grep-based CI check, but the fix in Tasks 1-2 eliminates all current instances, making the lint rule lower priority. | If new raw BASE_URL usage appears in Svelte components after this fix, add a CI check. |
