# Cycle 6 — Test Engineer

**Date:** 2026-04-24
**Reviewer:** test-engineer
**Scope:** Test coverage and quality

---

## C6-T01: No test for Layout.astro `buildPageUrl` migration

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/layouts/Layout.astro` (after migration)
- **Description:** When the Layout.astro BASE_URL migration is completed (C6-CR01), there should be a test verifying that all navigation hrefs use `buildPageUrl()`. Same concern as C5-T01 which was deferred — this is a new instance because the layout was not in scope for the prior fix.

---

## Final Sweep

Existing test suites cover:
- `packages/core/__tests__/` — optimizer, calculator, categorizer, reward-cap-rollback
- `packages/parser/__tests__/` — csv, detect, xlsx-parity
- `packages/rules/__tests__/` — schema, category-names
- `packages/viz/__tests__/` — report
- `tools/cli/__tests__/` — commands
- `tools/scraper/__tests__/` — fetcher

Total: 197 tests, 0 failures (from cycle 5 gate evidence).
