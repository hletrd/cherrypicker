# Cycle 95 — test-engineer

## Current Test Coverage

- `packages/core`: 95 tests across 4 files, 189 expect() calls (calculator, optimizer, categorizer, models).
- `packages/parser`: covered by build + downstream consumer tests; no dedicated test files in viewed area.
- `packages/viz`: 1 test (`report.test.ts`) — verifies summary values + transaction escaping.
- `packages/scraper`: 1 test (`fetcher.test.ts`) — cleanHTML behavior.
- `packages/cli`: 4 tests (commands.test.ts) — argument guards.
- `apps/web`: tests include `analyzer-adapter.test.ts` referenced in grep results; E2E via playwright.

All tests pass (turbo cache-hit confirmed at baseline).

## Deferred Test Gaps (unchanged)

- D-36 — No unit tests for web-side XLSX parser.
- D-37 — E2E tests use `waitForTimeout` in places.
- D-86-16 — No integration test for multi-file upload path (analyzeMultipleFiles cross-file merge).

None promoted this cycle; no new regressions observed.

## New Findings

None.

## Summary

0 new findings. Test suite stable; gate `bun run verify` passes on turbo cache.
