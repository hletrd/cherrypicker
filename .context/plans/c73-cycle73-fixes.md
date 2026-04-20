# Cycle 73 Implementation Plan

**Date:** 2026-04-22
**Status:** In Progress

---

## Task 1: Fix TransactionReview loadCategories() orphaned fetch

**Finding:** C73-02
**Severity:** LOW / MEDIUM
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:43-69`

**Problem:** `onMount` calls `loadCategories()` without an AbortSignal. If the component unmounts during the fetch (e.g., Astro View Transition), the fetch continues and the callback tries to set state on an unmounted component.

**Fix:** Add an AbortController that is aborted on component destroy via the `onMount` cleanup return.

**Implementation:**
```svelte
onMount(() => {
  const controller = new AbortController();
  (async () => {
    try {
      const nodes = await loadCategories(controller.signal);
      // ... existing logic
    } catch {
      // Fall back to hardcoded list
    }
  })();
  return () => controller.abort();
});
```

---

## Task 2: Consolidate BOM stripping to single responsibility

**Finding:** C73-04
**Severity:** LOW
**Files:** `apps/web/src/lib/parser/csv.ts:928,134`, `apps/web/src/lib/parser/index.ts`

**Problem:** UTF-8 BOM is stripped redundantly in `parseCSV()` and `parseGenericCSV()`. The `parseFile()` entry point in `index.ts` is the proper place for single-responsibility BOM handling.

**Fix:** Keep BOM stripping in `parseCSV()` (the public entry point for CSV parsing), but remove the redundant strip in `parseGenericCSV()` since it's always called after `parseCSV()` has already stripped the BOM.

---

## Task 3: Run quality gates (eslint, tsc --noEmit, vitest, bun test)

**Requirement:** All gates must pass before cycle completion.

---

## Progress

- [ ] Task 1: TransactionReview AbortController
- [ ] Task 2: BOM stripping consolidation
- [ ] Task 3: Quality gates
