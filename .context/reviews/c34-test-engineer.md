# Cycle 34 — Test Engineer Findings

**Date:** 2026-05-06
**Scope:** Test coverage, flaky tests, TDD opportunities

---

## Verified Fixed

- **C33-F12** Missing test for unknown reward type: `calculator.test.ts:775` covers `getCalcFn` throwing on unknown type.
- **C33-F10** Negative previousMonthSpending: `parsePreviousSpending` test coverage present in web tests.

---

## Coverage Gaps

### G1: Unknown reward type in analyzer adapter (MEDIUM)
- **File:** `apps/web/src/lib/analyzer.ts:71-73`
- No tests verify that an unknown reward type in the web-to-core adapter triggers a warning or error. The silent fallback to 'discount' is uncovered.

### G2: CSP header presence (LOW)
- **File:** `apps/web/src/layouts/Layout.astro`
- No tests verify that security headers are rendered in the HTML output.

### G3: sessionStorage migration path (LOW)
- **File:** `apps/web/src/lib/store.svelte.ts:122-124`
- Migrations registry is empty. No tests verify the migration framework works.

---

## Gate Status

| Gate | Result |
|------|--------|
| `npm run lint` | PASS (0 errors) |
| `npm run typecheck` | PASS |
| `bun run test` | PASS (213 pass, 0 fail) |
