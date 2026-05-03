# Cycle 1 Plan — Review-Plan-Fix

**Date:** 2026-05-03

## Plan tasks

### Task 1: Add C97-01 regression test for fullStatementPeriod ISO date filter

- **Finding:** C1-T01 (test-engineer)
- **Severity:** MEDIUM
- **File:** `apps/web/__tests__/analyzer-adapter.test.ts`
- **Action:** Add a test that verifies `fullStatementPeriod` filters out non-ISO dates (e.g., Korean footer rows like "소계") before computing period bounds. This prevents regression of the C96-01 crash and C97-01 period pollution.
- **Status:** TODO

### Task 2: Run Playwright e2e tests with realistic data (USER-INJECTED TODO)

- **Finding:** C1-T02 (test-engineer), user-injected TODO
- **Severity:** MEDIUM (user requirement)
- **Action:** Run `npm run test:e2e` against the built app to verify realistic file upload and analysis workflow. If existing e2e tests don't cover realistic CSV/XLSX upload with correct parsing, add a new test. Verify that:
  1. App starts and the upload page loads
  2. File upload works for CSV and XLSX
  3. Analysis runs without errors
  4. Dashboard displays results correctly
- **Status:** TODO

### Task 3: Remove/deprecate ILP optimizer stub

- **Findings:** C1-R02 (code-reviewer), C1-A02 (architect), C1-DOC02 (document-specialist)
- **Severity:** LOW
- **Files:** `packages/core/src/optimizer/ilp.ts`, `packages/core/src/optimizer/index.ts`
- **Action:** Add `@deprecated` JSDoc tag and remove the `console.debug` call. Update the JSDoc to clarify it's a stub delegating to greedy optimizer. Do not remove the export (may be used externally).
- **Status:** TODO

### Task 4: Add diagnostic logging to empty catch blocks

- **Finding:** C1-R03 (code-reviewer)
- **Severity:** LOW
- **Files:** `FileDropzone.svelte:297`, `TransactionReview.svelte:110`, `CardDetail.svelte:34,291`, `SpendingSummary.svelte:39`
- **Action:** Add `console.debug` or `console.warn` in each empty catch block with a brief diagnostic message explaining the expected fallback behavior.
- **Status:** TODO

### Task 5: XLSX parser memory optimization — avoid TextEncoder re-encoding

- **Finding:** C1-P01 (perf-reviewer)
- **Severity:** LOW
- **File:** `apps/web/src/lib/parser/xlsx.ts:299`
- **Action:** Replace `new TextEncoder().encode(html)` + `XLSX.read(uint8array, { type: 'array' })` with `XLSX.read(html, { type: 'string' })`. Verify that XLSX's string input path handles Korean characters correctly.
- **Status:** TODO

### Task 6: Store cardIds in AnalysisResult and forward in reoptimize

- **Finding:** C1-TR01 (tracer)
- **Severity:** LOW
- **Files:** `apps/web/src/lib/store.svelte.ts`, `apps/web/src/lib/analyzer.ts`
- **Action:** Add `cardIdsOption?: string[]` to `AnalysisResult` (similar to `previousMonthSpendingOption`). Set it during `analyze()` when `options.cardIds` is provided. Forward it in `reoptimize()`.
- **Status:** TODO

### Task 7: Show auto-detected bank in FileDropzone

- **Finding:** C1-UX01 (designer)
- **Severity:** LOW
- **File:** `apps/web/src/components/upload/FileDropzone.svelte`
- **Action:** After file upload, run `detectBankFromText` on the file content and display the detected bank name as a hint next to the "자동 인식" button. This requires reading file content for bank detection before the full parse.
- **Status:** TODO

---

## Deferred findings (not scheduled for this cycle)

### D-New-01: MIGRATIONS dict uses `(data: any) => any`

- **Finding:** C1-R04 (code-reviewer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:110`
- **Reason for deferral:** No migrations exist yet (v1 schema). Adding stricter types now has no practical benefit and would require changes when the first migration is added anyway.
- **Exit criterion:** When the first real migration is added, type the parameter and return as `PersistedAnalysisResult`.

### D-New-02: Build chunk size > 500 KB warning

- **Finding:** C1-P02 (perf-reviewer)
- **Severity:** LOW
- **Confidence:** High
- **Reason for deferral:** The xlsx library is the primary contributor. Code-splitting requires careful testing to ensure the parser still works when loaded on-demand. This is a bundle optimization that should be done in a dedicated performance pass.
- **Exit criterion:** When bundle size becomes a user-reported issue or a dedicated perf sprint is scheduled.

### D-New-03: Parser test coverage sparse for web-specific parsers

- **Finding:** C1-T03 (test-engineer)
- **Severity:** LOW
- **Confidence:** High
- **Reason for deferral:** The web parsers are indirectly tested via integration tests (analyzer-adapter) and e2e tests. Adding dedicated unit tests is a good practice but not blocking for correctness.
- **Exit criterion:** When a dedicated test-coverage improvement cycle is scheduled.

### D-New-04: No loading skeleton for card detail page

- **Finding:** C1-UX02 (designer)
- **Severity:** LOW
- **Confidence:** Low
- **Reason for deferral:** Minor consistency issue. Card detail page loads quickly from cached data. The missing skeleton is not user-visible in practice.
- **Exit criterion:** When a UI consistency pass is scheduled.

### D-New-05: `inferYear` timezone edge case (C8-08, unchanged)

- **Finding:** C1-D01 (debugger)
- **Severity:** LOW
- **Confidence:** Medium
- **Reason for deferral:** Known limitation, narrow edge case (minutes around midnight on Dec 31, once per year). Not user-visible in typical usage.
- **Exit criterion:** If a user reports incorrect year inference.

### D-New-06: `detectBank` can misidentify bank (unchanged)

- **Finding:** C1-D02 (debugger)
- **Severity:** LOW
- **Confidence:** Medium
- **Reason for deferral:** Partially mitigated by C70-01 confidence cap. User can override via bank selector. No real statement samples showing the issue.
- **Exit criterion:** If users report incorrect bank detection.

### Previously deferred items (unchanged)

D-01 through D-65 from prior cycles remain unchanged. See `00-deferred-items.md`.

### Re-confirmed deferred items (no action this cycle)

- **D-01** (parser return-type leak / C1-R01/A01): Remains deferred. Root cause of C96-01, C97-01, and C1-T01. Requires D-01 architectural refactor.
- **D-02** (LICENSE vs README / C1-DOC01): Remains deferred. Requires project owner confirmation.
- **D-05** (No CI quality gate / C1-CR02): Remains deferred. Depends on D-04 (lint setup).
- **C1-A03** (CATEGORY_NAMES_KO drift / TODO C64-03): Remains deferred. Partial mitigation via categoryLabels Map in web path.
