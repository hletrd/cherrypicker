# Cycle 24 Implementation Plan

**Date:** 2026-05-06
**Source reviews:** `.context/reviews/c24-aggregate.md`, `.context/reviews/c24-{code-reviewer,security-reviewer,perf-reviewer,test-engineer,architect,debugger,critic,verifier,tracer,designer,document-specialist}.md`
**Status:** Complete

---

## Task 1: Fix HTML event handler regex for whitespace around equals sign [C24-SEC01] — DONE

- **Commit:** `47c623b`
- **Files:** `apps/web/src/lib/parser/html.ts:42`, `packages/parser/src/csv/shared.ts:191-192`
- Updated BOTH regexes to `/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi` (web) and `/\son\w+\s*=\s*["'][^"']*["']/gi` + `/\son\w+\s*=\s*\w+/gi` (server).

## Task 2: Add test for whitespace-variant event handlers [C24-TEST01] — DONE

- **Commit:** `b5c7d12`
- **Files:** `apps/web/__tests__/parser-html.test.ts`, `packages/parser/__tests__/csv-shared.test.ts`
- Added tests covering spaces before, after, and on both sides of `=` for both web and server `normalizeHTML`.

## Task 3: Add finite-number validation for totalTransactionCount [C24-DB02] — DONE

- **Commit:** `56d5fea`
- **Files:** `apps/web/src/lib/store.svelte.ts:289,291`
- Added `Number.isFinite()` guard for both `transactionCount` and `totalTransactionCount` in `loadFromStorage`.

## Task 4: Remove redundant per-cell isSummaryRow checks [C24-PERF01] — DEFERRED

- **Severity:** LOW (performance)
- **Files:** `apps/web/src/lib/parser/html.ts:182-227`
- **Reason for deferral:** The per-cell `isSummaryRow` checks serve a different purpose than the row-level check at line 163. The row-level check skips rows where the combined text matches summary patterns. The per-cell checks prevent individual cells containing summary text (e.g., a cell with just "합계") from being used as forward-fill values within otherwise normal rows. Removing them would change behavior. A proper optimization requires caching `isSummaryRow` results or restructuring the forward-fill logic, which is higher risk than justified for a LOW severity finding.
- **Exit criterion:** If HTML tables exceed 5000 rows and parsing becomes slow, implement per-row isSummaryRow cache.

---

## Deferred Items

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---------|----------|------------|---------------------|----------------|
| C24-ARCH01 | LOW | High | Extracting normalizeHTML to shared utility is part of A-ARCH-01 parser duplication refactor. | A-ARCH-01 shared module is implemented |
| C24-TEST02 | LOW | Medium | Testing `persistToStorage` + `loadFromStorage` round-trip requires exporting private functions or large mock data. Same as deferred C22-TEST02. | `persistToStorage` refactored to be testable |
| C24-PERF01 | LOW | High | Per-cell isSummaryRow guards are semantically meaningful; removing them risks changing forward-fill behavior. | If HTML tables exceed 5000 rows and parsing is slow |

---

## Gate Results

- `npm run lint`: PASS (0 errors, 0 warnings)
- `npm run typecheck`: PASS (0 errors)
- `bun run test`: PASS (all packages green)
