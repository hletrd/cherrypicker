# Test Engineering Review — Cycle 1

**Reviewer:** test-engineer
**Date:** 2026-07-23
**Method:** Static review only. No unit, E2E, browser, or Chrome process was started.

## Inventory and coverage map

- Examined all 104 product source files under `apps/web/src`, `packages/*/src`, and `tools/*/src`.
- Examined all 39 unit-test files and all 4 Playwright specs, plus root/workspace scripts, Vitest/Turbo/Playwright configuration, and the deployment workflow.
- Scanned all 683 card YAML files, both generated card catalogs, the compact catalog, category JSON/YAML, issuer YAML, and all 18 issuer README files for interface/parity implications.
- Final sweep covered public entry points, negative/boundary inputs, persistence, generated-data freshness, CLI/scraper error paths, and repeated-E2E lifecycle hygiene.

## Findings

### TE-01 — The deployment verification path never runs the Playwright suite

**Severity:** High
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `package.json:15` defines `test:e2e`, but `package.json:18` defines `verify` as lint + typecheck + `bun run test` only.
- `.github/workflows/deploy.yml:34-39` runs `bun run verify` and then builds the web app; it never invokes `test:e2e`.
- The browser specs live in top-level `e2e/`, outside every workspace's `test` script, so Turbo's normal test task cannot discover them.

**Failure scenario**

A change can break upload, navigation, hydration, session persistence, or the report/results pages while every deployment gate remains green. The broken static site is then built and published because the only tests that exercise those flows were never run.

**Fix**

Add an explicit browser setup and `bun run test:e2e` step before the Pages build. Keep screenshot-only work in a separate non-blocking project so the regression gate remains focused.

### TE-02 — `core-regressions.spec.js` calls the current API with a missing required argument

**Severity:** High
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `e2e/core-regressions.spec.js:145-152` calls `buildConstraints(transactions, previousSpending)` with only two arguments.
- `packages/core/src/optimizer/constraints.ts:9-25` requires a third `categoryLabels: Map<string, string>` and returns it unchanged.
- `packages/core/src/optimizer/greedy.ts:73-96` unconditionally calls `categoryLabels.get(...)` while building the first assignment.
- `package.json:15` rebuilds the current core package before invoking Playwright, so the stale call cannot be rescued by an older `dist/`.

**Failure scenario**

The test reaches assignment construction and throws `TypeError: Cannot read properties of undefined (reading 'get')`, making the configured E2E command red before it can validate the claimed optimizer regression.

**Fix**

Pass an explicit label map in the spec and assert the localized category labels. Add a small JavaScript-facing API smoke test so required-parameter changes cannot bypass TypeScript and silently stale the E2E fixture.

### TE-03 — Several web “unit tests” test copied implementations, and the copies are already stale

**Severity:** High
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `apps/web/__tests__/analyzer-adapter.test.ts:1-6,22-72` explicitly reproduces private analyzer functions. Its copy converts an invalid reward type to `"none"` (`:61-66`), while production filters invalid reward rules out (`apps/web/src/lib/analyzer.ts:60-80`).
- `apps/web/__tests__/parser-encoding.test.ts:17-49` copies an old three-encoding/early-exit algorithm. Production now tries only UTF-8 and CP949 and checks both candidates without early exit (`apps/web/src/lib/parser/index.ts:40-62`).
- `apps/web/__tests__/store-persistence.test.ts:1-25,99-111` copies private persistence parsing/validation rather than loading the store.
- `apps/web/__tests__/parser-pdf.test.ts:10-13,51-69` copies both the fallback regex and a local amount parser instead of executing `parsePDF`.

**Failure scenario**

Production behavior can regress or change while these tests stay green because they prove only that the copied test code behaves like itself. The invalid-reward and encoding cases already document behavior different from the application.

**Fix**

Extract pure production helpers into importable modules and test those exports. Test Svelte persistence through a browser page seeded with malformed `sessionStorage`, and run PDF fallback tests through a narrow production-exported parser helper or a real minimal fixture.

### TE-04 — Local E2E accepts stale servers and does not own their shutdown lifecycle

**Severity:** High
**Confidence:** High
**Status:** Confirmed configuration risk

**Evidence**

- `playwright.config.ts:16-20` sets `reuseExistingServer: !process.env.CI`.
- An already-running process on port 4173 is therefore accepted locally; Playwright neither starts nor owns that process and consequently cannot terminate it after the run.
- `e2e/core-regressions.spec.js:16-33` also merely warns when source is newer than `dist/` and continues importing stale output when Playwright is invoked directly.
- No repository script or Playwright global teardown records owned server/browser process IDs for interrupted-run cleanup.

**Failure scenario**

On repeated review cycles, a prior Astro preview remains on port 4173. A later cycle reuses that stale process, exercises an old web build, and reports misleading pass/fail results. Because the process is external to Playwright, it remains after the cycle. An interrupted runner can likewise leave its owned browser process group behind.

**Fix**

Set `reuseExistingServer: false` for the repeatable test command, use an isolated/dynamic port, and make the runner own the preview process. Wrap the E2E command with `EXIT`/signal cleanup for only the recorded process group (never a broad system-wide Chrome kill). Make stale `dist/` a hard failure or always build it in the sole supported entry point.

### TE-05 — Per-transaction caps are applied but never reported, and the test omits the contract assertion

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `packages/core/src/models/result.ts:23-29` exposes `CapInfo.capType: "per_transaction"`.
- `packages/core/src/calculator/reward.ts:273-292` clips both rate and fixed rewards by `perTransactionCap`.
- The only `capsHit.push` paths are for `monthly_total` (`:307-317`) and `monthly_category` (`:339-346`); no per-transaction entry is emitted.
- `packages/core/__tests__/calculator.test.ts:486-495` verifies only the clipped reward value. It never checks `capsHit` or `capReached`.

**Failure scenario**

Reports show the reduced reward but omit why it was capped, even though the public result model promises per-transaction cap information. A UI or CLI consumer cannot explain the discrepancy to the user.

**Fix**

Emit a `per_transaction` `CapInfo` whenever the uncapped reward exceeds the per-transaction cap, mark the bucket capped, and assert the complete cap record for both percentage and fixed-amount rewards.

### TE-06 — Source YAML and production JSON can diverge without any gate noticing

**Severity:** Medium
**Confidence:** High
**Status:** Risk needing manual validation; artifacts are currently in sync

**Evidence**

- `scripts/build-json.ts:381-451` generates four production-facing artifacts, including `apps/web/public/data/cards.json`, `categories.json`, and the fallback label module.
- `package.json:12-18` does not expose or run a data generation/parity check from `build`, `test`, or `verify`.
- `.github/workflows/deploy.yml:34-39` verifies and builds the committed artifacts directly.
- `packages/rules/__tests__/schema.test.ts:275-301` validates YAML loading with a loose `>650` count but never regenerates or compares the browser artifacts.

**Failure scenario**

A contributor changes a valid YAML rule or category and forgets the manual generation command. Unit tests pass against YAML, while the deployed browser continues serving stale JSON and stale fallback labels.

**Fix**

Add deterministic `data:build` and `data:check` scripts. Run generation before the web build and fail CI when normalized generated output differs from tracked files; handle `generatedAt` deterministically or exclude it from parity comparison.

### TE-07 — Non-finite transaction amounts are untested at the public reward-calculator boundary

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed direct-API defect

**Evidence**

- `packages/core/src/calculator/reward.ts:226-260` rejects only `amount <= 0`; `NaN` passes that comparison and is added to category spending before reward math.
- `packages/core/__tests__/calculator.test.ts:509-568` covers negative, zero, non-KRW, and null-rate inputs, but not `NaN` or infinities.
- The non-finite tests at `packages/core/__tests__/calculator.test.ts:776-803` validate only `previousMonthSpending`.

**Failure scenario**

An unchecked library caller passes a transaction with `amount: NaN`; the calculator returns `NaN` spending/rates/rewards rather than a skipped transaction or descriptive error, contaminating downstream optimization/report serialization.

**Fix**

Define the boundary policy explicitly (reject or skip non-finite amounts), enforce `Number.isFinite(tx.amount)` before bucket creation, add a distinct skip reason if skipping, and cover `NaN`, `Infinity`, and `-Infinity`.

### TE-08 — The scraper's encoding re-fetch and timeout paths have no tests and contain observable failure bugs

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `tools/scraper/__tests__/fetcher.test.ts:4-27` tests only `cleanHTML`.
- `tools/scraper/src/fetcher.ts:47-60` performs a second fetch when a meta tag declares EUC-KR, but does not check the second response's `ok` status.
- The second timeout is cleared only after a successful `.arrayBuffer()`; a rejected fetch leaves its timer pending until 30 seconds.

**Failure scenario**

A legacy issuer page declares EUC-KR, then its re-fetch returns HTTP 500. The scraper decodes the error page as card content and sends it to the LLM. If the re-fetch rejects quickly, the leftover timer can keep the CLI process alive after failure.

**Fix**

Extract a checked fetch helper with `try/finally` timeout cleanup and use it for both requests. Add mocked-fetch tests for EUC-KR headers/meta, second-fetch HTTP errors, aborts, rejection cleanup, and charset aliases.

### TE-09 — Screenshot capture is mixed into the normal E2E regression suite

**Severity:** Low
**Confidence:** High
**Status:** Confirmed test-hygiene issue

**Evidence**

- `playwright.config.ts:8` includes every file under `e2e/`.
- `e2e/ui-ux-screenshots.spec.js:14-142` contains 14 artifact-capture cases, almost entirely without assertions.
- The file uses repeated fixed waits of 300–3000 ms (`:17,26,34,42,53,64,68,80,92,99,106,118,131,138,140`).

**Failure scenario**

Every regression run pays for screenshot-only work and becomes timing-sensitive on slower machines. A sleep can expire before the UI settles, producing inconsistent artifacts or flaky failures unrelated to behavior.

**Fix**

Move captures to a separately tagged Playwright project/script, exclude it from the blocking regression command, and replace fixed sleeps with explicit readiness conditions.

## Final missed-issue sweep

The remaining notable gaps are lower-signal variants of the findings above: the public `parseStatement` dispatcher lacks direct multi-format integration coverage; most scraper validator/writer/CLI branches are untested; and parser format tests write fixed fixture paths inside the repository rather than isolated temporary directories. No relevant source, test, config, generated interface, or documentation family was skipped.
