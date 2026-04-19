# Architect Review — Cycle 3 (2026-04-19)

**Reviewer:** architect
**Scope:** Architectural/design risks, coupling, layering

---

## Findings

### C3-A01: Web app duplicates core package's `CATEGORY_NAMES_KO` instead of using taxonomy

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:7-50`
- **Description:** (Already noted as C2-A01/C3-03.) The `CATEGORY_NAMES_KO` map in the optimizer duplicates data that already exists in the taxonomy. The optimizer should receive category labels from its callers (who have access to the taxonomy) rather than maintaining its own copy.
- **Fix:** Add a `categoryLabels: Map<string, string>` parameter to `greedyOptimize` or `buildAssignments`, populated from `CategoryTaxonomy.getCategoryLabel()`.

### C3-A02: `loadCategories` fetches data that's already in `cards.json`

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/cards.ts:159-173`
- **Description:** The `loadCategories` function fetches `categories.json` separately, but `cards.json` already contains a `categories` array in its `meta` section. This is an unnecessary network request and creates a data consistency risk if the two files get out of sync.
- **Fix:** Load categories from the already-fetched `cards.json` data. Keep the separate `categories.json` endpoint as a fallback for backward compatibility.

### C3-A03: Web `analyzer.ts` performs both parsing and optimization orchestration

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/analyzer.ts`
- **Description:** The `analyzer.ts` module handles three responsibilities: (1) parsing files, (2) categorizing transactions, and (3) running the optimization. This makes it hard to test each concern independently and creates tight coupling between the parser and optimizer. A cleaner architecture would separate these into distinct services.
- **Fix:** Consider splitting into `ParseService`, `CategorizationService`, and `OptimizationService`. This is a large refactor and should only be done if the current coupling causes real problems.

### C3-A04: `inferYear` is duplicated across three files

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:29-37`, `apps/web/src/lib/parser/xlsx.ts:183-190`
- **Description:** The `inferYear` function is duplicated in `csv.ts` and `xlsx.ts` with identical logic. This is a minor DRY violation. (The `parseDateToISO` functions are also duplicated across these files and `pdf.ts`.)
- **Fix:** Extract `inferYear` and `parseDateToISO` into a shared utility module (e.g. `apps/web/src/lib/parser/date-utils.ts`).
