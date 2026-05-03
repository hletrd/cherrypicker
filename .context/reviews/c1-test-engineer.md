# Cycle 1 (fresh) — test-engineer pass

**Date:** 2026-05-03

## Scope

Test coverage gaps, flaky tests, TDD opportunities, e2e test quality.

## Findings

### C1-T01: No regression test for C97-01 (fullStatementPeriod ISO date filter)

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/__tests__/analyzer-adapter.test.ts` (missing test)
- **Description:** The C97-01 fix added a `length >= 10` filter on `allDates` and `optimizedDates` before sorting, but no dedicated regression test was added. Without a test, a future refactor could remove the filter and the C96-01 crash would resurface.
- **Fix:** Add the regression test to `analyzer-adapter.test.ts`.

### C1-T02: E2E tests exist but are not run in the current gate

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `e2e/core-regressions.spec.js`, `e2e/web-regressions.spec.js`
- **Description:** The repo has 4 e2e test files using Playwright, but `npm run test` only runs `bun test` and `vitest`. The `test:e2e` script requires a build step and preview server. The user-injected TODO specifically asks for Playwright testing.
- **Fix:** Run `npm run test:e2e` as part of this cycle's gate verification.

### C1-T03: Parser test coverage is sparse for web-specific parsers

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts`, `xlsx.ts`, `pdf.ts` — no dedicated unit tests
- **Description:** The web-specific parsers have no dedicated unit tests. Parser correctness is only validated through integration tests and e2e tests.
- **Fix:** Add unit tests for web CSV/XLSX/PDF parsers, especially for edge cases.

## Summary

3 findings (1 MEDIUM, 2 LOW). C1-T01 is the most actionable — add the C97-01 regression test. C1-T02 relates to the user-injected TODO.
