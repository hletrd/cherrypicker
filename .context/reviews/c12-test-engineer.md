# Test Engineer — Cycle 12

**Date:** 2026-04-24
**Reviewer:** test-engineer

## Findings

### C12-TE01: No test coverage for `formatSavingsValue` [LOW]
- **File:** `apps/web/src/lib/formatters.ts:224-227`
- **Description:** The `formatSavingsValue` helper centralizes sign-prefix logic across SavingsComparison, VisibilityToggle, and ReportContent, but has no dedicated unit tests. This is the same finding as C10-01, already tracked and deferred.
- **Confidence:** High
- **Severity:** LOW (already deferred)

### C12-TE02: No test coverage for sessionStorage persistence round-trip [LOW]
- **File:** `apps/web/src/lib/store.svelte.ts:146-330`
- **Description:** The `persistToStorage` / `loadFromStorage` round-trip (including migration, validation, truncation) has no automated tests. This is the same finding as C9-09, already tracked and deferred.
- **Confidence:** High
- **Severity:** LOW (already deferred)

### C12-TE03: No test coverage for XLSX parser's HTML-as-XLS detection [LOW]
- **File:** `apps/web/src/lib/parser/xlsx.ts:266-275`
- **Description:** The `isHTMLContent` function that detects HTML disguised as XLS (common in Korean card exports) has no test coverage. Malformed HTML detection edge cases (e.g., BOM + HTML, mixed encoding) are untested.
- **Confidence:** High
- **Severity:** LOW

### C12-TE04: No test coverage for `reoptimize` category label caching [LOW]
- **File:** `apps/web/src/lib/store.svelte.ts:383-398`
- **Description:** The `getCategoryLabels()` caching behavior (including the "don't cache empty Map" guard at line 394-397) has no test coverage. A regression in the caching logic could cause `reoptimize` to show English keys instead of Korean labels.
- **Confidence:** High
- **Severity:** LOW

## Convergence Note

All findings are LOW-severity test coverage gaps, consistent with the established pattern (C9-08, C9-09, C10-01). No new MEDIUM or HIGH test findings. The core optimization engine (`packages/core`) has robust test coverage; gaps are primarily in the web app's integration paths.
