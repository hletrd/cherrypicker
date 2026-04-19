# Comprehensive Code Review — Cycle 33

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 33)
**Scope:** Full repository — all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (35+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-32 reviews. Verified that all prior cycle 32 findings C32-01 through C32-03 and the carried-over C31-01 are now fixed. Ran `bun test` and identified a new issue. Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Cycle 32 Findings

| Finding | Status | Evidence |
|---|---|---|
| C31-01 | **FIXED** | `parser-date.test.ts:41-49` — YYYYMMDD handler now has range validation; test cases for invalid YYYYMMDD strings added (lines 286-300) |
| C32-01 | **FIXED** | `report.js:63-64` — now uses `(opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)` |
| C32-02 | **FIXED** | `csv.ts:43-51`, `xlsx.ts:210-217`, `pdf.ts:149-156` — full-date format now validates month/day ranges |
| C32-03 | **FIXED** | `csv.ts:63-74`, `xlsx.ts:231-240`, `pdf.ts:158-169` — short-year format now validates month/day ranges |

---

## New Findings

### C33-01: Playwright E2E spec files crash `bun test` — no bunfig.toml exclusion

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `e2e/core-regressions.spec.js`, `e2e/web-regressions.spec.js`, `e2e/ui-ux-review.spec.js`, `e2e/ui-ux-screenshots.spec.js`
- **Description:** The `e2e/` directory contains 4 Playwright `.spec.js` files that are discovered by `bun test` (which matches `.spec.` filenames). `bun test` attempts to run them but crashes because Playwright's `test.describe.configure()` and `test.beforeAll()` APIs are not compatible with Bun's test runner. Running `bun test` from the repo root produces 4 errors and 4 failures. The `test:bun` script works around this by restricting to `packages/parser tools/scraper`, but bare `bun test` (used by CI or developers who don't know about the restriction) still fails. The repo has no `bunfig.toml` to exclude the `e2e/` directory from `bun test` discovery.

  The `package.json` `verify` script runs `bun run test` which invokes `turbo run test`, but any developer running bare `bun test` from the repo root will see failures.

- **Failure scenario:** A developer runs `bun test` from the repo root to check their changes. The command fails with 4 errors from Playwright spec files, obscuring whether their actual code changes pass. They may waste time investigating what they assume is a regression in their code.
- **Fix:** Create a `bunfig.toml` at the repo root with a test exclusion for `e2e/`:
  ```toml
  [test]
  exclude = ["e2e"]
  ```

---

## Final Sweep — Cross-File Interactions

1. **All prior findings confirmed fixed:** C31-01, C32-01, C32-02, C32-03 are all verified as resolved in the current codebase.

2. **Date validation chain is now complete across all formats:**
   - YYYYMMDD: validated (csv.ts, xlsx.ts) + tests
   - Full-date YYYY-MM-DD: validated (csv.ts, xlsx.ts, pdf.ts) + tests
   - Short-year YY-MM-DD: validated (csv.ts, xlsx.ts, pdf.ts) + tests
   - MM/DD: validated (csv.ts, xlsx.ts, pdf.ts) + tests
   - Korean full: validated (csv.ts, xlsx.ts, pdf.ts) + tests
   - Korean short: validated (csv.ts, xlsx.ts, pdf.ts) + tests

3. **Test-production sync verified:** The test file's local `parseDateToISO` (parser-date.test.ts) now matches all three production copies (csv.ts, xlsx.ts, pdf.ts) across all date formats including range validation.

4. **Report page "+" prefix verified:** `report.js:63-64` now correctly prepends "+" for positive savings, consistent with `results.js:14` and `SavingsComparison.svelte:202`.

5. **Deferred items unchanged:** D-01 through D-105 remain unchanged from prior cycles.

6. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

7. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

8. **E2E test isolation:** The 4 Playwright spec files in `e2e/` are only compatible with `playwright test`, not `bun test`. Without a `bunfig.toml` exclusion, bare `bun test` fails. This is the only new finding this cycle.

---

## Summary of Active Findings (New in Cycle 33)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C33-01 | MEDIUM | High | `e2e/*.spec.js`, missing `bunfig.toml` | Playwright E2E spec files crash `bun test` — no exclusion configured |
