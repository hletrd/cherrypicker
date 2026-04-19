# Cycle 50 Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle50-comprehensive.md`

---

## Task 1: Add Korean label resolution to viz report generator and terminal summary

- **Finding:** C50-M01
- **Severity:** MEDIUM (incorrect output)
- **Confidence:** High
- **Files:** `packages/viz/src/report/generator.ts:64-120`, `packages/viz/src/terminal/summary.ts:24-64`, `tools/cli/src/commands/report.ts:66-132`
- **Description:** Both `buildCategoryTable` in the HTML report generator and `printSpendingSummary` in the terminal summary set `labelKo: tx.category` when building per-category aggregations. The `tx.category` field is the canonical English category ID (e.g., `"dining"`, `"cafe"`), not a Korean label. This means the HTML report's category column and the terminal summary's category column display raw English IDs instead of Korean labels like "외식" and "카페".
- **Fix:**
  1. Add an optional `categoryLabels?: Map<string, string>` parameter to `generateHTMLReport()` and `printSpendingSummary()`.
  2. In `buildCategoryTable`, look up `categoryLabels?.get(tx.category) ?? CATEGORY_NAMES_KO[tx.category] ?? tx.category` instead of using `tx.category` directly as the label.
  3. In `printSpendingSummary`, do the same.
  4. In `tools/cli/src/commands/report.ts`, build the category labels Map from the loaded categories (already available from `loadCategories`) and pass it to both functions.
  5. The `CATEGORY_NAMES_KO` map in `greedy.ts` is currently private. Either re-export it from `@cherrypicker/core` or duplicate it in the viz package (it's already duplicated in spirit across the codebase for the web dashboard). The cleaner approach is to re-export it from `@cherrypicker/core`.
- **Verification:** Run `cherrypicker report` on a sample statement. The terminal summary and HTML report category columns should show Korean labels instead of English IDs. Run `bun test` to ensure no regressions.
- **Status:** TODO

---

## Task 2: Use `replaceAll()` instead of `replace()` for template placeholder substitution in report generator

- **Finding:** C50-L01
- **Severity:** LOW (fragility)
- **Confidence:** High
- **Files:** `packages/viz/src/report/generator.ts:225-230`
- **Description:** `generateHTMLReport` uses `template.replace('{{SUMMARY}}', ...)` which only replaces the first occurrence. If the template ever contained a placeholder twice, the second occurrence would remain unreplaced. Using `replaceAll()` would be safer.
- **Fix:** Change all 5 `.replace(` calls to `.replaceAll(` in `generateHTMLReport`.
- **Verification:** Run `bun test` and `bun run build` to ensure no regressions. The template currently has single occurrences so output should be identical.
- **Status:** TODO

---

## Deferred Items (Active, carried forward)

No new deferred items. Prior deferred items (D-106, D-107, D-110) remain deferred with documented rationale per `.context/plans/00-deferred-items.md`.
