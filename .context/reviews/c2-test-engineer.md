# Cycle 2 — test-engineer pass

**Date:** 2026-05-03

## Scope

Test coverage gaps, flaky tests, TDD opportunities, e2e test quality.

## Findings

### C2-T01: No regression test for C97-01 (fullStatementPeriod ISO date filter) (re-confirmed from C1-T01)

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/__tests__/analyzer-adapter.test.ts` (missing test)
- **Description:** The C97-01 fix added a `length >= 10` filter on `allDates` and `optimizedDates` before sorting, but no dedicated regression test was added. Without a test, a future refactor could remove the filter and the C96-01 crash would resurface.
- **Fix:** Add the regression test to `analyzer-adapter.test.ts`.

### C2-T02: E2E tests exist but are not run in the current gate (re-confirmed from C1-T02)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `e2e/core-regressions.spec.js`, `e2e/web-regressions.spec.js`
- **Description:** The repo has e2e test files using Playwright, but `npm run test` only runs `bun test` and `vitest`.
- **Status:** Unchanged.

### C2-T03: Parser test coverage is sparse for web-specific parsers (re-confirmed from C1-T03)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts`, `xlsx.ts`, `pdf.ts` — no dedicated unit tests
- **Description:** The web-specific parsers have no dedicated unit tests.
- **Status:** Unchanged.

## Summary

0 net-new test findings. 3 re-confirmations of known items.
