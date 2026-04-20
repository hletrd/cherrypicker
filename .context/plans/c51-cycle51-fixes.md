# Plan: Cycle 51 Fixes

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle51-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [LOW] Replace report page plain JS with Svelte component for dark mode and store consistency (C51-01)

- **Finding:** C51-01
- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/pages/report.astro:49`, `apps/web/public/scripts/report.js`
- **Description:** The report page uses a plain JS script (`public/scripts/report.js`) that reads from sessionStorage directly, builds the DOM with hardcoded light-mode colors, and has a duplicated `formatWon` without negative-zero normalization. This creates a split-brain where dashboard/results pages use Svelte components with `analysisStore` but the report page reads sessionStorage directly.
- **Fix:**
  1. Create `apps/web/src/components/report/ReportContent.svelte` that reads from `analysisStore` (like other dashboard components) and renders the report with proper dark mode support, shared formatters, and full data display.
  2. Update `apps/web/src/pages/report.astro` to:
     - Remove the `<script is:inline src="/cherrypicker/scripts/report.js">` tag
     - Add `VisibilityToggle` component (same as dashboard/results pages)
     - Add `ReportContent` Svelte component inside the data content div
     - Keep the print button with `onclick="window.print()"` 
  3. The old `public/scripts/report.js` can remain for backward compatibility but is no longer loaded.
- **Verification:** After analyzing a file, navigate to the report page. It should show analysis data with proper dark mode support. Click "print" to verify print output. Run `npx tsc --noEmit` and `npx vitest run` to ensure no regressions.
- **Status:** PENDING

---

### 2. [LOW] Remove dead `isSubstringSafeKeyword` function (C49-01)

- **Finding:** C49-01
- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `packages/core/src/categorizer/matcher.ts:21-23`
- **Description:** The function `isSubstringSafeKeyword` is defined but never called. The filtering it would perform is done inline at module level via `SUBSTRING_SAFE_ENTRIES` (line 18-19), which pre-computes the filtered entries. The function serves no purpose and adds confusion.
- **Fix:** Remove the dead function and any associated comment.
- **Verification:** Run `npx vitest run` and `bun test` to ensure no regressions.
- **Status:** PENDING

---

### 3. [LOW] Fix OptimalCardMap toggleRow to mutate $state Set directly (C51-04)

- **Finding:** C51-04
- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:37-44`
- **Description:** `toggleRow` creates a `new Set(expandedRows)` on every call, copying all existing expanded rows before adding/removing the toggled category. Svelte 5's proxy-based reactivity tracks Set mutations via `.add()` and `.delete()`, so the copy is unnecessary.
- **Fix:** Mutate the `$state` Set directly instead of creating a new one:
  ```ts
  function toggleRow(category: string) {
    if (expandedRows.has(category)) {
      expandedRows.delete(category);
    } else {
      expandedRows.add(category);
    }
  }
  ```
- **Verification:** Click category rows in the OptimalCardMap table to expand/collapse. Verify that expanding one row does not collapse others. Run `npx vitest run`.
- **Status:** PENDING

---

## Deferred Items (not implemented this cycle)

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---|---|---|---|---|
| C51-02/C4-07 | LOW | HIGH | SpendingSummary dismiss uses separate sessionStorage key. Low severity UX preference -- dismiss state is non-critical. | Store refactor consolidates all persistence keys |
| C51-03 | LOW | HIGH | scoreCardsForTransaction double-calls calculateCardOutput. Known greedy trade-off; acceptable at current scale. | Transaction count exceeds 10,000 or performance profiling shows bottleneck |
