# Cycle 14 — test-engineer

**Date:** 2026-04-25
**Scope:** Test coverage gaps, flaky tests, TDD opportunities.

## Inventory of test files

Counted ~17 `__tests__` files spanning core (4), parser (3), rules (2), viz (1), cli (1), scraper (1), web (4). Plus Playwright e2e under `e2e/`.

## Findings

### C14-TE01 — LOW (Medium confidence) — Test gap
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:94-98` (`getCategoryColor`)
- **Observation:** Same as C13-TE01. The 3-way fallback function still has no direct unit test. Repeated re-flagging confirms importance, but it remains a Svelte component-internal helper that would require export refactor to test in isolation.
- **Suggested fix:** Either (a) extract `getCategoryColor` + `CATEGORY_COLORS` to `apps/web/src/lib/category-colors.ts` to enable unit testing, or (b) add a Playwright assertion that the cafe sub-bar uses a non-grey color. Same exit criterion as C9-08.
- **Confidence:** Medium. **Severity:** LOW (carry-forward).

### Final sweep

- All test suites pass on FULL TURBO cache. No flakes observed in cycle 14.
- No newly added uncovered branches in cycles 12-13 commits.

## Summary

No net-new test gaps. Existing C13-TE01 / C9-08 still apply.
