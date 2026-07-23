# Cycle 4 verifier, test-engineer, and document-specialist review

Date: 2026-07-23
Baseline: `555c56a` (`docs(reviews,plans): close cycle 3 findings`)

## Verdict

I found six current defects:

| ID | Severity | Confidence | Status | Summary |
|---|---|---|---|---|
| C4-VTD-001 | Medium | High | Confirmed | Safe per-row monetary values can overflow analysis and performance aggregates, and the public reward boundary accepts an unsafe previous-spending integer. |
| C4-VTD-002 | Medium | High | Confirmed | An already-stale caller run can still erase the committed in-memory and persisted analysis. |
| C4-VTD-003 | Medium | High | Confirmed | A failed persisted-analysis clear is non-terminal, so failed replacement B can leave old persisted A available to a later reload. |
| C4-VTD-004 | Medium | High | Confirmed | Card-search/detail browser tests can pass without proving their named behavior and use timing sleeps in place of readiness. |
| C4-VTD-005 | Low | High | Confirmed | Maintainer and user documentation still describes removed dependencies and obsolete keyword-conflict behavior. |
| C4-VTD-006 | Low | High | Confirmed | `validateFilePath` documents null-byte rejection but passes such a path, while callers continue with the uncleaned original value. |

No Cycle 1-3 item is repeated merely because it appeared in an old review. The fixed two-second browser waits were previously noted as an unresolved maintainability observation and remain a current defect; the stronger false-pass assertions described below are independently present on current HEAD.

## Inventory and review method

I first enumerated the tracked repository with `git ls-files`, then classified and inspected the complete relevant sets rather than selecting samples:

- 2,112 tracked files.
- 184 production `.ts`, `.js`, `.svelte`, and `.astro` files after excluding tests, configs, and declarations.
- 102 executable `*.test.ts` / `*.spec.js` files: 32 web, 9 E2E, 37 package, 7 script, and 17 tool tests.
- 20 package/toolchain/test/deployment config files.
- 1,037 Markdown files, of which 1,008 are historical `.context` material and 29 are live non-context documentation. Live documentation was read directly; historical Cycle 1-3 reviews/plans and the aggregate were searched to prevent duplicate findings.
- 683 authored card YAML files and 26 generated/public JSON artifacts, validated exhaustively through the publication/data gates.

Cross-file traces covered:

1. statement bytes -> format detection/parser -> canonical transaction facts -> categorization -> calendar context -> per-card performance spending -> calculator/optimizer -> web, CLI, report, and persistence outputs;
2. upload ownership -> replacement runtime -> parser/optimizer workers -> in-memory commit -> `sessionStorage` -> navigation/reload;
3. YAML/schema/taxonomy -> build projections and source identity -> split browser artifacts and CLI catalog -> card UI;
4. CLI option/path validation -> local/consented remote parsing -> terminal/report output; and
5. scraper URL/DNS/redirect policy -> bounded fetch -> LLM contract -> filesystem writer.

The sweep also checked errors, unsafe casts, monetary accumulators, cancellation points, timers/listeners, shared promises, fetch timeouts, worker disposal, storage migration, path/symlink handling, terminal/HTML escaping, response-size limits, dependency declarations, generated-data identity, action pins, test skips, and fixed waits.

## Findings

### C4-VTD-001 — Analysis breaks the repository's safe-integer monetary invariant

Severity: Medium
Confidence: High
Status: Confirmed

Evidence:

- The canonical parser intentionally accepts one row at exactly `Number.MAX_SAFE_INTEGER`: `packages/parser/src/shared/amount.ts:52-54` and `packages/parser/__tests__/amount.test.ts:58-65`.
- Monthly spending uses unchecked `+=`: `packages/core/src/analysis/context.ts:129-139`.
- Eligible performance spending and its no-exclusion fast path use unchecked addition/reduction: `packages/core/src/analysis/performance.ts:31-54,57-68`.
- `calculateRewards` rejects non-finite and negative previous spending but not a non-integer or unsafe integer: `packages/core/src/calculator/reward.ts:435-444`.
- Restored monthly totals are accepted when merely finite: `apps/web/src/lib/persistence.ts:442-450`.
- Existing focused tests cover ordinary calendar/exclusion cases and NaN, Infinity, and negative previous spending, but not safe per-row values whose sum is unsafe: `apps/web/__tests__/analysis-context.test.ts:38-83`, `apps/web/__tests__/performance-spending.test.ts:4-60`, and `packages/core/__tests__/calculator.test.ts:1319-1347`.

Deterministic current-HEAD reproduction with two accepted maximum rows produced:

```text
monthly=18014398509481982, Number.isSafeInteger(monthly)=false
performance=18014398509481982, Number.isSafeInteger(performance)=false
previousMonthSpending=9007199254740992 was accepted and selected tier "high"
```

Failure scenario:

1. A statement contains two individually valid maximum-safe rows in June and a normal July row.
2. The calendar context publishes an inexact June monthly total.
3. Automatic June performance spending supplies an unsafe rounded value to tier selection for July.
4. The dashboard can persist and restore the unsafe monthly total. A direct core caller can also pass the first unsafe integer to `calculateRewards` without rejection.

The values are extreme, but this is an explicit exact-money invariant: adjacent calculator and optimizer accumulators already use `addSafeNonnegativeIntegers`, and the parser deliberately defines the maximum per-row boundary.

Root fix:

- Use `addSafeNonnegativeIntegers` (or one shared equivalent) in `buildAnalysisContext`, `calculatePerformanceSpending`, and `resolveCardPreviousSpending`.
- Require a non-negative safe integer for `calculateRewards.previousMonthSpending` and at the direct `optimizeFromTransactions`/basis boundary.
- Require safe non-negative monetary/count values when restoring aggregates, or rebuild them from validated transactions.
- Add boundary tests using two `Number.MAX_SAFE_INTEGER` rows and a direct `Number.MAX_SAFE_INTEGER + 1` previous-spending input.

### C4-VTD-002 — An already-invalid caller run still performs destructive replacement

Severity: Medium
Confidence: High
Status: Confirmed

Evidence:

- `analyze` starts a new operation and composes the caller run at `apps/web/src/lib/analysis-replacement-runtime.ts:105-115`.
- It sets loading state, clears persisted analysis, clears memory, and increments generation at `apps/web/src/lib/analysis-replacement-runtime.ts:117-128`.
- The first `owned.run.isCurrent()` check is only after the analyzer module await at `apps/web/src/lib/analysis-replacement-runtime.ts:130-134`.
- Existing tests cover a current success/failure pair and cancellation after replacement has already started, but never an invalid token at entry: `apps/web/__tests__/analysis-replacement-runtime.test.ts:58-168`.

I invalidated a `LatestFileParseRun` before passing it to `analyze`. Current HEAD returned:

```json
{"clears":1,"result":null,"storageHasA":false,"generation":2,"error":null}
```

Failure scenario:

A caller retains a run token, invalidates or supersedes it, and then invokes the public analysis boundary with that stale token. The stale work cannot parse or commit a new result, but it still destroys committed result A in both memory and storage. It can also invalidate another store-owned operation because `OperationEpoch.begin()` runs before caller ownership is checked.

Root fix:

- Return immediately when `execution.run.isCurrent()` is false or its signal is aborted, before `OperationEpoch.begin()`.
- Do not move the check only to just before storage clearing; by then `begin()` has already aborted current owned work.
- Add a regression that supplies an already-stale run and asserts no dependency call, state mutation, generation change, storage mutation, or active-operation invalidation.

### C4-VTD-003 — Failed storage clearing allows old A to survive failed replacement B

Severity: Medium
Confidence: High
Status: Confirmed

Evidence:

- `clearPersistedAnalysis` converts any `sessionStorage.removeItem` exception into `{ kind: 'error' }`: `apps/web/src/lib/store.svelte.ts:131-139`.
- The replacement runtime records that warning but proceeds to clear memory and analyze B: `apps/web/src/lib/analysis-replacement-runtime.ts:120-140`.
- If B fails, it sets the error and leaves memory empty without another attempt to remove old storage: `apps/web/src/lib/analysis-replacement-runtime.ts:164-174`.
- Both runtime-test clear fakes always successfully delete storage, so the error result is untested: `apps/web/__tests__/analysis-replacement-runtime.test.ts:78-80,144-147`.

I made the clear dependency return `{ kind: 'error' }` without deleting A and made B fail. Current HEAD returned:

```json
{"memory":null,"error":"replacement B failed","persistWarningKind":"error","storageMerchant":"old-a","generation":2}
```

Failure scenario:

`sessionStorage.removeItem` throws, for example because storage is temporarily restricted. The UI reports failed B and has no in-memory result, but the old bytes remain. A later reload or navigation when storage is readable can deserialize A as though it were current, violating the runtime's stated replacement policy at `apps/web/src/lib/analysis-replacement-runtime.ts:80-88`.

Root fix:

- Treat a failed clear as a terminal replacement precondition.
- Preserve committed A in memory and generation, stop before loading/analyzing B, and expose a specific storage-clear error/warning. This keeps memory and reload state consistent when atomic replacement is impossible.
- Add clear-error + B-failure + reload coverage and a clear-error test that verifies the analyzer and persist dependencies are not called.

### C4-VTD-004 — Card E2E tests can pass without testing search or detail

Severity: Medium
Confidence: High
Status: Confirmed

Evidence:

- Three card tests wait a fixed two seconds instead of waiting for the catalog/result state: `e2e/ui-ux-review.spec.js:420-446`.
- “search filters cards” fills the search input and then only asserts that some count text is truthy; it never compares the count, visible cards, or result identity before and after filtering: `e2e/ui-ux-review.spec.js:431-440`.
- “clicking a card opens detail view” wraps the entire interaction/assertion in `if (await firstCard.isVisible())`, so no loaded card means a passing test with zero assertions about detail: `e2e/ui-ux-review.spec.js:443-455`.
- Two error-listener tests use the same fixed sleep as their observation window: `e2e/ui-ux-review.spec.js:597-625`.
- CI retries failures twice, which is diagnostic but cannot repair an absent assertion: `playwright.config.ts:12-24`.

Failure scenario:

- Search can become a no-op and the named search test still passes because the pre-existing count badge remains truthy.
- Catalog loading can take more than two seconds or fail before rendering a card; the detail test then skips its body and passes.
- Errors emitted after the arbitrary two-second window are missed, while slower healthy runs can fail elsewhere.

Root fix:

- Wait on a specific first-card/count/loading-state locator or the catalog response, not elapsed time.
- Record the unfiltered result, search for a known unique card/issuer, and assert the visible result set and count actually change.
- Require the first card to be visible, click it unconditionally, and assert the selected hash plus a card-specific detail heading/content.
- Replace the error-window sleeps with deterministic page readiness and settled application-state hooks.

### C4-VTD-005 — Documentation describes removed dependencies and obsolete keyword semantics

Severity: Low
Confidence: High
Status: Confirmed

Evidence:

- The README still lists PapaParse as a parser dependency: `README.md:89-99`.
- The maintainer overview still lists LayerChart and D3: `.claude/CLAUDE.md:6-13`.
- The actual web manifest contains none of PapaParse, LayerChart, or D3: `apps/web/package.json:14-29`. The dependency/import gate also passes with those packages absent.
- The agent guide says duplicate keyword keys are overwritten by the later file: `.claude/AGENTS.md:87-97`.
- Current matcher construction collects all source definitions and requires an explicit audited override for conflicting canonical categories: `packages/core/src/categorizer/matcher.ts:23-28,81-117,125-154`.
- A current test comment also still claims an English entry “silently shadows” a base entry through a spread merge, although no such spread merge remains: `packages/core/__tests__/categorizer.test.ts:378-399`.
- README's “350+” keyword copy at `README.md:32,45` is materially stale. Current source maps contain 13,568 authored entries and 12,740 unique authored keys (10,007 base, 1,686 English, 915 niche, and 960 locations).

Failure scenario:

A maintainer follows the guide, adds a cross-file duplicate with a different category, and expects source order to decide the result. Matcher construction instead fails until `keyword-overrides.ts` is updated. Users and contributors are also told the project ships chart/parser libraries that were deliberately removed.

Root fix:

- Remove the retired dependency names and describe the current custom shared CSV parser/native Svelte-SVG presentation stack.
- Replace the overwrite rule with the explicit conflict/override workflow and update the stale test comment.
- Derive the displayed keyword count and dependency claims in `docs:check`, or at least add narrow assertions so the next dependency cleanup cannot leave these claims behind.

### C4-VTD-006 — Null bytes are “cleaned” only for validation, not for use

Severity: Low
Confidence: High
Status: Confirmed

Evidence:

- The function contract says null bytes are rejected: `tools/cli/src/validation.ts:18-22`.
- The implementation silently strips them into local `cleaned`, validates that different path, returns `void`, and never returns a canonical path: `tools/cli/src/validation.ts:23-64`.
- Callers continue with the original `file`/`output` strings, for example `tools/cli/src/commands/analyze.ts:28-37` and `tools/cli/src/commands/report.ts:49-58`.
- The unit test explicitly expects the opposite of the documented contract: `tools/cli/__tests__/commands.test.ts:402-406`.

Current-HEAD reproduction using `"/etc/hosts\0"`:

```json
{"validation":"passed","downstream":"ERR_INVALID_ARG_VALUE"}
```

Failure scenario:

The cleaned target exists, so `mustExist` validation and symlink checking pass against it. Parsing then receives the original NUL-containing path and fails later with a generic runtime error. For non-existing output paths, validation likewise reports success while a lower filesystem boundary rejects the original value.

Root fix:

Reject `\0` at the validation boundary and make the test assert the documented failure. Returning and consistently using a canonicalized path is another possible contract, but silent removal changes the user's requested filesystem coordinate and is less clear than rejection.

## Verification evidence

The composite `bun run verify` stopped at its first intentional guard because this host has Bun 1.3.12 while `package.json:42` pins Bun 1.2.6. I did not claim an exact pinned-toolchain composite pass. The CI workflow pins 1.2.6 and Node 24 before running both `verify` and browser regression: `.github/workflows/deploy.yml:24-45`.

Read-only gates run individually on the available host:

- `bun run migrations:check`: pass.
- `bun run dependencies:check`: pass.
- `bun run data:check`: pass; 683 YAML cards across 24 issuers, all generated/public projections and README issuer indexes matched.
- `bun run lint`: pass in all seven workspaces; Astro reported 0 errors, warnings, or hints.
- `bun run typecheck`: pass in all seven workspaces; Astro reported 0 errors, warnings, or hints.
- `bun run test`: pass; all workspace tasks and 53 script tests passed. Turbo replayed valid local cache entries for several package tasks, so fresh runner evidence was also gathered separately.
- `bunx vitest run --reporter=dot`: 85 files and 2,290 tests passed fresh.
- `bun test ...command-process.test.ts ...analysis-replacement-runtime.test.ts ...analysis-context.test.ts ...performance-spending.test.ts ...calculator.test.ts`: 85 focused Bun tests passed fresh, including all six Bun-only CLI process/RSS tests.
- `bun run web:build:check`: pass; five static pages built and bundle/catalog budgets passed.
- `bun scripts/migrations/generate-keyword-overrides.ts`: clean with 211 explicit decisions.
- Test scan: no `.only`, `.skip`, or `.todo` markers; five fixed `waitForTimeout(2000)` calls remain, all in `e2e/ui-ux-review.spec.js`.
- E2E ownership status: clean. Port 4173 had an unowned listener and was correctly left untouched; the runner reported that it would choose an alternate port.

The full browser regression suite was inspected but not executed in this review session, so no browser-pass claim is made here.

## Missed-issue sweep and explicit coverage

- Core: calendar/provenance context, categorizer/taxonomy/keyword conflicts, reward selection/conditions/caps, exact numeric helpers, optimizer assignment/aggregation, and public models.
- Parser: every server/browser format route and shared CSV/date/amount/fact normalization, PDF local/remote paths and lifecycle, XLSX archive boundary, size/admission limits, conformance fixtures, and format isolation.
- Rules/data: schema, semantic fail-closed rules, URL/card ID constraints, issuer registry, optimizer artifact identity, all 683 YAML files, category YAML, compact/full/generated outputs, and issuer README generation.
- Web: all pages/layout/public scripts/components, upload and file queue, workers, catalog caches/source pinning, analysis and reoptimization, state ownership, persistence/migration, navigation, formatting, disclosures, print, accessibility/state helpers, and all 32 unit-test files plus nine browser specs.
- CLI/viz: shared option parsing, consent and local-first PDF path, compiled catalog, calendar analysis, disclosures, terminal sanitation, report context/output races, all command process tests, terminal summary/comparison, and HTML report generation.
- Scraper: argument/issuer contracts, DNS and connected-address enforcement, redirect allowlisting, deadline/size/media/charset handling, prompt/schema/extraction completeness, and contained no-follow writing.
- Repository controls: root/workspace manifests, lock/dependency policy, Bun/Node pins, TypeScript/Bun/Astro/Playwright/Vitest/Turbo configs, build/bundle checks, E2E process ownership, migrations, publication scripts, workflow permissions/action pins, and vendored SheetJS digests.
- Documentation: root README, both live maintainer guides, 24 generated issuer READMEs, vendor README, current workflow/config comments, and Cycle 1-3 aggregate/plans relevant to duplicate suppression.

The six protected untracked Cycle 42 artifacts present at review start were not modified. No tracked production, test, config, data, or documentation file was edited.
