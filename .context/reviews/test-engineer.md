# Test Engineer — Cycle 3

**Reviewer:** test-engineer
**Date:** 2026-07-23
**Baseline:** `614ce5c`
**Result:** 7 concrete regression gaps; current suites pass but do not exercise
the newly identified boundaries.

## Complete test inventory

| Area | Test files | Lines | Executed tests |
|---|---:|---:|---:|
| Web unit/contract | 28 | 4,411 | 302 |
| Core | 5 | 2,432 | 129 |
| Parser | 23 | 11,821 | 1,595 |
| Rules/catalog | 5 | 1,154 | 84 |
| Visualization | 1 | 120 | 4 |
| CLI | 4 | 787 | 41 |
| Scraper | 8 | 1,129 | 50 |
| Root scripts/workflow | 6 | 1,240 | 49 |
| Browser regression | 7 executed + 1 screenshot-only | 2,345 | 84 executed |
| **Total executed** | **80 unit/script + 7 E2E** |  | **2,338** |

The unit/script number is 2,254; the browser regression suite contributes 84.
The inventory includes parser adapters/parity, calculator/optimizer, complete
catalog semantics, browser loaders/workers/PDF lifecycle, persistence,
upload/operation ownership, CLI consent/commands/disclosures, scraper
network/writer/schema boundaries, publication/build budgets, workflow
consistency, accessibility, security, and end-to-end product routes.

## Gate execution

- `bun run test`: **2,254 passed, 0 failed**.
- `bun run test:e2e`: **84 passed, 0 failed** in 31.8 seconds; owned processes
  were cleaned and port 4173 was free afterward.
- `migrations:check`, `data:check`, `docs:check`, lint, typecheck, and
  `web:build:check`: passed individually.
- Catalog checks parsed all **683 cards across 24 issuers** and bundle budgets
  passed.
- `bun run verify`: stopped, as designed, at `toolchain:check` because the host
  has Bun **1.3.12** while `packageManager` and CI pin **1.2.6**. This is an
  environment limitation, not a repository failure; the full chained gate was
  not represented as green.
- The Pages workflow installs Bun 1.2.6, uses a frozen lockfile, runs `verify`,
  then the 84-test regression suite before artifact upload. Screenshot capture
  is intentionally separate.

## Findings

### C3-TE-001 — Terminal safety tests cover the helper, not the real output sinks

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed gap
- **Locations:** `tools/cli/__tests__/terminal.test.ts:1-28`;
  `tools/cli/__tests__/disclosures.test.ts:1-70`;
  untested sinks `packages/viz/src/terminal/summary.ts:24-109`,
  `packages/viz/src/terminal/comparison.ts:16-79`, and
  `tools/cli/src/disclosures.ts:36-72`

The helper matrix proves `sanitizeTerminalText` removes OSC/CSI/CR/bidi
controls, but no test sends those values through table cells, cap warnings,
alternatives, best-card text, or unsupported-rule disclosures. A local sink
probe retained payload control bytes, confirming this is not merely theoretical
coverage. Add captured-console tests at each public visualization function and
one CLI command-level regression. Assert absence of payload controls while
allowing `cli-table3`'s own known styling.

### C3-TE-002 — Output-path tests omit the exact `mustExist: false` symlink case

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed gap
- **Locations:** `tools/cli/__tests__/commands.test.ts:373-415`;
  production `tools/cli/src/commands/report.ts:82-87,144-152`

The suite tests a symlink only with `mustExist: true`; report output uses
`mustExist: false`. Add a temporary-root integration test with an existing
final-component symlink and sentinel target, plus dangling symlink, ordinary
existing file, exclusive create, explicit overwrite, and validation/open swap
cases. Every rejection must leave the target byte-for-byte unchanged.

### C3-TE-003 — Report escaping has no invalid numeric-entity matrix

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed gap
- **Locations:** `packages/viz/__tests__/report.test.ts:56-76`;
  production `packages/viz/src/report/generator.ts:46-63`

The four report tests cover ordinary `<`, quotes, CSP, and branding only.
They do not cover out-of-range code points, huge entities, surrogates,
incomplete entities, or literal entity text. Add a table-driven no-throw test
across every dynamic report field and verify the rendered DOM contains text,
never a recursively decoded element.

### C3-TE-004 — Persistence tests do not execute the store's analyze failure transition

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed gap
- **Locations:** `apps/web/__tests__/store-persistence.test.ts:84-297`;
  production `apps/web/src/lib/store.svelte.ts:335-384`

Current tests call the side-effect-free serializer/deserializer. They never
construct the rune store with controlled `sessionStorage` and a rejecting
analyzer. Consequently, success A -> failure B -> reload is uncovered, and the
old storage entry survives. Add a runtime store harness (dependency-injected
analyzer/storage if needed) and a built-app test covering result, error,
generation, persistence-warning state, storage bytes, and reload/direct-route
behavior after both abort and non-abort failure.

### C3-TE-005 — Scraper tests confuse response truncation coverage with source coverage

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed gap
- **Locations:** `tools/scraper/__tests__/extractor.test.ts:36-100`;
  production `tools/scraper/src/extractor.ts:8-55`

The suite verifies a `max_tokens` response fails, but never crosses the
40,000-character request boundary. Add 39,999/40,000/40,001 tests, Unicode
boundary cases, and a long cleaned-page fixture with a material restriction
near the tail. The contract should expose source truncation to the caller and
block ordinary success/publication until completeness is resolved.

### C3-TE-006 — Cancellation coverage ends at parser/PDF workers

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed gap
- **Locations:** `apps/web/__tests__/file-parse-queue.test.ts:112-226`;
  `apps/web/__tests__/pdf-lifecycle.test.ts:1-179`;
  production `apps/web/src/lib/analyzer.ts:165-220,245-305,389-393`

Queue and PDF tests are strong, but none cancels while categories or optimizer
catalog loading is pending, or while optimization runs. Add deferred loader
tests with two callers (one canceled, one live) to prove caller-scoped abort
does not poison the shared cache, and an optimizer cancellation test proving
prompt settlement/no stale commit/no further chunks.

### C3-TE-007 — The success-countdown/drop overlap has no component or E2E test

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed gap
- **Locations:** `apps/web/__tests__/upload-contract.test.ts:1-104`;
  `apps/web/__tests__/operation-epoch.test.ts:1-84`;
  `e2e/ui-ux-review.spec.js:163-236`;
  production `apps/web/src/components/upload/FileDropzone.svelte:52-92,
  162-169,196-236,319-337`

Admission tests are pure and operation tests cover async ownership, but neither
owns the component's 1.2-second navigation timer. Add a fake-timer component
test and a real-browser page-wide drop immediately after the success state.
Assert the timer is canceled/invalidated, the new file stays visible, old
analysis is not presented as new, and navigation occurs only after a new
successful analysis.

## Flakiness and maintainability observations

- `e2e/ui-ux-review.spec.js:420-446,597-623` uses five fixed two-second sleeps.
  These add a ten-second floor and can still fail when the intended state takes
  longer. Replace them with response/DOM/hydration predicates. CI retries (2)
  should remain diagnostics, not the synchronization mechanism.
- Browser tests repeat the full upload/analysis flow in many cases. Shared
  fixtures are acceptable if they preserve test isolation; a setup helper that
  waits on explicit UI state would reduce runtime and divergent timing logic.
- The test runner's process ownership, alternate-port selection, status proof,
  signal propagation, and cleanup tests are unusually thorough; no orphaned
  process remained after this review run.

## Final missed-regression sweep

I mapped every Cycle 3 production finding to the nearest existing test and
searched all unit/E2E names and assertions for the exact boundary. No hidden
coverage was found for terminal sinks, no-follow report creation, invalid
numeric entities, analyze failure/storage atomicity, scraper input truncation,
post-parser cancellation, or the success timer/drop overlap. No further
material gap was added after that mapping.
