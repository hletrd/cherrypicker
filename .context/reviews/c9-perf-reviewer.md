# Cycle 9 — Performance Reviewer

## C9-P01: CategoryBreakdown re-sorts assignments on every render
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:120`
- **Description:** `const sorted = [...assignments].sort(...)` creates a new sorted copy of assignments on every reactive update. For typical usage (< 50 categories) this is negligible. The spread+sort is O(n log n) per render. Since assignments already come sorted by spending from the optimizer (buildAssignments returns sorted), the re-sort is redundant when sortKey is 'spending'.
- **Fix:** Check if the current sort key matches the optimizer's default sort (spending) and skip the re-sort in that case.

## C9-P02: CategoryTaxonomy substring scan is O(n) per match call
- **Severity:** LOW (previously noted as D-09)
- **Confidence:** Medium
- **File:** `packages/core/src/categorizer/taxonomy.ts:70-78`
- **Description:** The substring match in `findCategory` iterates all keyword entries. This is the same O(n*m) pattern noted as D-09 for scoreCardsForTransaction. For typical usage (< 200 keywords), it's fast enough. Not a new finding.
