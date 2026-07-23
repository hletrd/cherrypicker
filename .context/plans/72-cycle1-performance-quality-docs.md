# Cycle 1 Performance, Quality Gates, Generated Data, and Documentation Plan

**Status:** Implemented and verified — C1-040/C1-041 remain explicitly deferred
**Date:** 2026-07-23
**Deploy mode:** None — do not deploy
**Scope:** C1-040 through C1-044 and C1-061 through C1-071
**Source reviews:** `.context/reviews/_aggregate.md`, `.context/reviews/perf-reviewer.md`, `.context/reviews/architect.md`, `.context/reviews/test-engineer.md`, `.context/reviews/document-specialist.md`, and `.context/reviews/designer.md`

## Outcome

Make the repository's data publication, browser regression testing, catalog loading, parser loading, and public documentation reproducible and representative of production behavior.

This plan schedules 14 of the 16 assigned findings for implementation. C1-040 and C1-041 remain open as explicit performance deferrals because their algorithms depend on category and reward semantics being corrected by other Cycle 1 plans. Their original High/High ratings, exact locations, rationale, and measurable reopening criteria are recorded below. No assigned finding is silently dropped or downgraded.

## 2026-07-23 implementation progress

Completed in the infrastructure/docs lane:

- C1-061/C1-071: CI uses Bun 1.2.6, runs the explicit toolchain gate, installs Playwright Chromium, runs the scoped regression suite before Pages upload, and uploads failure artifacts only on failure. A consistency test locks the workflow to root scripts.
- C1-062/C1-064/C1-066: the core fixture supplies localized category labels; regression and screenshot configurations are separate; both set literal `reuseExistingServer: false`; and `scripts/run-e2e.ts` owns a checkout-scoped process group/profile with conservative pre/post cleanup and status inspection.
- C1-064 integration hardening: malformed, missing, foreign, or truncated
  ownership records remain visible as invalid stale runs, make
  `e2e:status --assert-clean` fail, and cause cleanup to stop before signaling
  any process whose ownership cannot be proven. The runner uses 4173 only when
  a loopback bind proves it free; otherwise it records a verified free
  alternate port and passes the exact port/base URL through both Playwright
  configurations and browser specs.
- C1-063: analyzer, parser encoding/PDF, and persistence tests now import production helpers; the built-app regression covers legacy, corrupted, and future persisted state.
- C1-042: multi-file parsing now uses a named two-file queue, preserves input-ordered results and errors, continues after per-file failures, releases/yields before dequeuing, reports completed/total progress, and stops between items on cancellation. Store request IDs plus latest-run tokens prevent late work from committing over a newer analysis.
- C1-043/C1-044: the store lazy-loads the analyzer, ordinary reset no longer loads/invalidates that immutable module, and every concrete format parser is now a separate on-demand import. XLSX and HTML share a neutral normalization helper instead of one concrete parser reaching the other. The deterministic source/built-graph gate requires six distinct deferred parser chunks with no sibling reachability.
- C1-043 UI bound: `CardGrid` renders a maximum of 36 cards, exposes accessible range/page/previous/next state, clamps or resets pages after result-reducing filters, and round-trips search/type/issuer/sort/page state through the URL. Production helper and static component-contract tests cover the 683-card boundary.
- C1-043 split catalog: the generator emits a 156.0 KiB raw/21.0 KiB gzip summary, 24 issuer detail shards, and a flat optimizer catalog at 41.6% of legacy raw size. Independent loaders preserve caller-local cancellation, timeout/retry, and cache isolation. The optimizer reader canonically validates all 683 generated rules while returning the original JSON array/object graph, and ordinary store reset does not invalidate it.
- C1-065 infrastructure: root `data:build`, `data:check`, `migrations:check`, `toolchain:check`, and blocking `verify` wiring use the generator/migration interfaces delivered by the domain lane.
- C1-067 through C1-070: `scripts/readme-catalog.ts` canonically validates and deterministically generates/checks the root badges/count table plus exhaustive indexes in all 24 issuer READMEs. The 683 generated relative links match all 683 YAML files; hand-written prose remains outside markers. Duplicate free-text totals were removed, partial tables are labeled representative, executable CLI/PDF examples and scraper scope are documented, and public CardPick/categorizer-ai references were removed.

Focused non-browser evidence:

- `bun run e2e:status --assert-clean`: pass; no owned run and port 4173 clear.
- A later integration-audit status check correctly returned non-clean because
  PID 17876 is a Travelback static server listening on port 4173 from
  `/Users/hletrd/flash-shared/Travelback`; it is foreign to this checkout and
  was deliberately preserved rather than signaled.
- PID 17876 later exited externally. No CherryPicker command signaled it.
  Focused lifecycle tests pass 16/16, both Playwright configs resolve an
  injected alternate port/base URL, and a real loopback probe selected and
  released alternate port 55668 while a temporary listener held 4173.
- `bun run migrations:check`: pass.
- `bun run data:check`: pass; 683 cards across 24 issuers.
- `bun scripts/check-web-bundles.ts`: pass; 107.8 KiB decoded, 42.2 KiB gzip, summary 156.0 KiB raw/21.0 KiB gzip, optimizer 41.6% of legacy, largest detail shard 218.6 KiB raw/14.4 KiB gzip; six deferred parser entries have no sibling reachability.
- `bun run docs:check`: pass; 683 indexed YAML links across 24 issuer READMEs.
- script tests: 29 pass, 0 fail, including generated Markdown/drift, executable README examples, and parser source/bundle isolation.
- focused helper/infrastructure/core tests: 32 pass, 0 fail.
- focused card-grid/disclosure tests: 13 pass, 0 fail, including the 683-card/36-item boundary, URL restoration, filter reset/clamp, missing-calendar-month provenance, and unsupported-rule grouping.
- focused file-parse queue and production-wiring tests: 6 pass, 0 fail; the instrumented maximum is two active workers and stale generations cannot commit.
- focused split-catalog/generator/budget tests: 27 pass, 0 fail; the exact production readers accept the summary, optimizer, and all 24 detail shards with 683-card count/ID parity. Unsupported rewards stay in detail/optimizer artifacts but are excluded from summary reward categories.
- standalone catalog request-boundary Playwright spec: `node --check` passes. The spec uses anchored pathname matching, limits the grid to 36 rendered card buttons, checks the selected issuer shard, and checks the optimizer request count. Playwright itself was intentionally not invoked in this implementation lane.
- full web unit regression after queue integration: 268 pass, 0 fail; production build and bundle gate pass at 107.8 KiB decoded/42.2 KiB gzip.
- full web unit regression after the UI integration: 253 pass, 0 fail; `astro build`: pass, 5 pages generated.
- full web unit regression after the split-catalog integration: 271 pass, 0 fail, 654 expectations; `astro build`: pass, 5 pages generated.
- `bun run --cwd apps/web typecheck`: latest aggregate checkpoint passes with 0 errors and 0 warnings after queue and split-catalog integration.
- Host `bun run toolchain:check`: expected failure because the host is Bun 1.3.12; `bunx bun@1.2.6 run toolchain:check` and the complete pinned `verify` gate pass.
- Pinned Bun 1.2.6 forced aggregate verification: pass with zero Turbo cache hits; all 11 package build/test tasks, 45 script tests, migrations, data/docs drift, lint, typecheck, production build, and bundle/artifact budgets pass.
- `bun run test:bun`: initially exposed the pinned runtime's missing native `euc-kr` decoder; the server-only `iconv-lite` fallback was added while preserving the browser-native path, and the rerun passes 1,639/1,639.
- `bunx vitest run`: initially exposed 21 Bun-only test assumptions; portable file reads, assertions, fetch mocks, and ESM imports fixed the test harness. After the final Plan 70 unit additions, the suite passes 2,151/2,151 across 67 files.
- Final Playwright discovery: 81 blocking regression tests and 13 separate screenshot tests; the blocking configuration excludes the screenshot suite.
- First scoped E2E batch: 60/64 passed and returned its real nonzero status for four stale accessible selectors. Its `finally` cleanup passed with port 4173 clear and zero owned processes.
- The original 64-test suite then passed 64/64. After adding the Plan 70 accessibility and Plan 71 security regressions, four expanded batches completed 75/81, 79/81, 80/81, and 81/81. Every failed batch still ran all 81 tests, returned its real nonzero status, and completed `finally` cleanup before the next batch.
- Final preflight, runner result, and post-cleanup status all returned zero; port 4173 had zero listeners and no repository-owned Playwright, preview, Chrome/Chromium, profile, or ownership record remained.
- Concurrent headless Chrome/ffmpeg processes were exact-inspected and traced to `/Users/hletrd/flash-shared/Travelback`; they and any interactive Chrome process were deliberately untouched.

Final browser verification:

- The final 81/81 blocking run includes the request-boundary spec: the list uses only the summary, selecting a card loads one issuer shard, analysis loads the optimizer at most once, legacy `cards.json` is never requested, and the rendered grid stays at or below 36 cards.
- The same run includes all Plan 70 accessibility/geometry/print regressions and all five Plan 71 security regressions.
- The screenshot configuration remains a separate 13-test capture suite and was discovery-checked without mixing it into the blocking 81-test regression batch.
- Final forced Bun 1.2.6 `verify` passed with zero Turbo cache hits; `test:bun` passed 1,639/1,639 and Vitest passed 2,151/2,151.

The implementation must:

- use the canonical rules schemas for publication and produce byte-deterministic tracked artifacts;
- make generated-data drift, documentation drift, and the declared Bun version blocking verification failures;
- run the production Playwright regression suite in CI;
- set `reuseExistingServer: false` literally and make the repository own and clean up its E2E process tree;
- terminate only repository-owned preview, Playwright, Chrome, and Chromium processes before and after each E2E batch;
- fix the stale optimizer E2E call and replace copied test implementations with imports of production helpers;
- split screenshot capture from the blocking regression suite;
- bound multi-file parse concurrency and lazy-load analyzers and format-specific parsers;
- serve the card grid from a compact summary artifact, load details on demand, and bound rendered card nodes;
- generate catalog counts/indexes in documentation and correct CLI, architecture, and product-name text;
- preserve all pre-existing dirty work and continue collecting independent gate results after any one batch fails;
- never invoke a deploy, publish, release, Pages upload, or Pages deployment command.

## Non-goals and cross-plan boundaries

- Do not deploy. Changes to `.github/workflows/deploy.yml` are configuration edits only; do not dispatch the workflow and do not push to `main`.
- Do not reset, stash, discard, overwrite, or reformat unrelated dirty files. In particular, preserve the existing changes in `apps/web/__tests__/amount.test.ts`, `apps/web/src/lib/parser/amount.ts`, and `apps/web/src/lib/store.svelte.ts`.
- Do not modify `.context/reviews/**`.
- Do not solve category/reward correctness findings C1-001 through C1-011 here. The strict generator must consume the canonical contract produced by those fixes rather than introducing another contract.
- Do not optimize the current incorrect matcher/rule semantics merely to make wrong results faster. C1-040 and C1-041 reopen under the explicit criteria in the deferred section.
- C1-026 loader cancellation/error semantics belong to `70-cycle1-web-ui-accessibility.md`. Apply that loader contract before changing its payload endpoints for C1-043, and preserve its explicit error/retry behavior.
- C1-034 supported-format copy belongs to `70-cycle1-web-ui-accessibility.md`. This plan may update the README architecture tree while resolving C1-070, but must not create a competing supported-format constant.
- Do not use broad `pkill`, `killall`, process-name-only matching, or any command that can terminate the user's interactive Chrome, the unrelated Travelback browser session, or another checkout's processes.
- Do not make a red CI/E2E result non-blocking to satisfy the gate. A failed batch must return its real exit code after cleanup; the outer review-plan-fix loop, not the test command, is responsible for continuing to the next cycle.

## Dirty-work and ownership guardrails

Before implementation:

1. Capture `git status --short`, `git diff --name-only`, and the existing diffs for every dirty file that this plan may overlap.
2. Record hashes for all dirty `.context/reviews/**` files. They must be unchanged at handoff.
3. Read the current diff before editing `apps/web/src/lib/store.svelte.ts`; make narrow patches around the user's existing work.
4. Use `apply_patch` for manual edits. A formatter may make only mechanical changes within the intended file set.
5. Keep generated writes behind the explicit `data:build` command. Tests, `data:check`, and verification must not mutate tracked files.
6. Run each quality gate separately and record its result. If a gate fails, clean up its resources, continue through the remaining independent gates, then fix all failures and rerun the affected gates before handoff.

Expected implementation surface:

- `package.json`
- `.github/workflows/deploy.yml`
- `playwright.config.ts`
- a separate screenshot Playwright config
- `scripts/run-e2e.ts` and focused process-runner tests
- `scripts/build-json.ts`, or a small pure generator module called by it
- a deterministic artifact/bundle check script
- `packages/rules/src/schema.ts` and exports only if the canonical schema needs a reusable exported helper
- `packages/rules/__tests__/schema.test.ts` and new generator/artifact tests
- generated catalog artifacts under `packages/rules/data/`, `apps/web/public/data/`, and `apps/web/src/lib/`
- `e2e/core-regressions.spec.js`
- `e2e/ui-ux-screenshots.spec.js`
- production-helper web tests and their corresponding new helper modules
- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/lib/parser/index.ts`
- `apps/web/src/lib/cards.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/components/cards/CardGrid.svelte`
- `README.md`
- issuer README files under `packages/rules/data/cards/*/README.md`
- `tools/cli/src/index.ts`
- `tools/scraper/src/cli.ts`
- `.gitignore` only for the repository-owned E2E state/profile directory if it is not already under ignored `test-results/`
- this plan for progress updates

Any source file outside that set requires a scope note in this plan before it is changed.

## Implementation sequence

### 1. Add a repository-owned E2E runner and make stale-process reuse impossible

**Findings:** C1-064 (High, High)

**Current locations**

- `playwright.config.ts:3-20`
- `package.json:15`
- `e2e/core-regressions.spec.js:16-33`
- `.gitignore:13-14`

**Changes**

- [x] Set `webServer.reuseExistingServer` to the literal `false` in every regression and screenshot Playwright configuration. Do not retain an environment-dependent expression.
- [x] Prefer port 4173 for compatibility only when an exclusive loopback bind proves it free. If it is occupied, preserve the listener and select a verified free loopback alternate; never reuse or kill the foreign listener.
- [x] Add `scripts/run-e2e.ts` as the only package-script entry point for browser suites. It must perform preflight cleanup, the required package/web build, the requested Playwright suite, and postflight cleanup in `try/finally`.
- [x] Give every run a unique directory under `test-results/cherrypicker-e2e/<run-id>/` and set that directory as the child process's temporary/profile root. Persist a strict versioned ownership record containing the repository realpath, run ID, selected port, wrapper PID, child process-group ID, start time, suite, and temporary paths before launching Playwright.
- [x] Launch the build/Playwright child in a dedicated process group. Propagate `SIGINT`, `SIGTERM`, and normal exit through one idempotent cleanup path while preserving the original build/test exit code.
- [x] At preflight, inspect prior ownership records plus default-port availability. Parameterize stale cleanup by each strict record's selected port. A stale process is killable only after both of these checks succeed:

  1. its recorded repository realpath equals this checkout; and
  2. its process group, command line, working directory, or Playwright temporary profile matches the recorded run.

- [x] For a proven repository-owned stale process group, send `SIGTERM`, wait up to five seconds, re-inspect exact PIDs, then use `SIGKILL` only on still-live recorded descendants. Never signal by executable name alone.
- [x] For a stale Chrome/Chromium child whose wrapper was force-killed, require the command line or open files to include the recorded repository-owned temporary profile before terminating it.
- [x] At postflight, terminate the exact current process group, assert that its recorded port has no listener, and only then remove its ownership record/profile. A listener lacking recorded process-group/profile proof is diagnosed and never signaled.
- [x] Add an `e2e:status`/`--assert-clean` mode that performs the same non-mutating ownership checks while distinguishing repository cleanliness from an unavailable foreign default port.
- [x] Convert the source-newer-than-`dist` warning in `e2e/core-regressions.spec.js:16-33` into a hard failure, or replace it with a build stamp/content hash produced by the wrapper. Direct Playwright invocation must never silently test stale core output.
- [x] Add unit tests for ownership validation, ambiguous/foreign PID refusal, signal escalation, stale state cleanup, exit-code preservation, and cleanup after simulated build/test failure. Mock process inspection/signaling; tests must never signal real processes.

**Mandatory lifecycle protocol**

Before and after every regression or screenshot batch, including a failed or interrupted batch:

1. Run the ownership/status inspection.
2. Terminate only validated repository-owned stale groups/profiles.
3. Use 4173 only if an exclusive loopback probe succeeds; otherwise select and record a verified free alternate.
4. Run the batch through `scripts/run-e2e.ts`.
5. In `finally`, terminate the recorded group and verify both the profile and port are clean.
6. Record any preserved external Chrome/Travelback process as intentionally untouched.

**Acceptance criteria**

- `reuseExistingServer` is exactly `false` in both configs.
- A repository-owned stale preview/Playwright/Chromium tree is removed before a new run and after success, failure, or `SIGINT`.
- An unowned port-4173 listener is diagnosed and never killed; a repository-clean run may continue on a verified alternate.
- No broad Chrome/process kill command exists in package scripts or the runner.
- `bun run e2e:status --assert-clean` reports no repository-owned run/browser/profile after every batch and separately reports whether default port 4173 is available.

### 2. Correct the core regression fixture and split screenshot capture from regression E2E

**Findings:** C1-062 (High, High), C1-066 (Low, High)

**Current locations**

- `e2e/core-regressions.spec.js:145-180`
- `packages/core/src/optimizer/constraints.ts:9-25`
- `packages/core/src/optimizer/greedy.ts:73-102`
- `playwright.config.ts:7-20`
- `e2e/ui-ux-screenshots.spec.js:14-142`

**Changes**

- [x] Pass an explicit `Map<string, string>` as the third `categoryLabels` argument to `buildConstraints` in the regression fixture.
- [x] Assert that the resulting assignments use the supplied Korean category labels. This verifies the missing argument's observable contract rather than merely avoiding the exception.
- [x] Keep the regression on built current `dist`; the runner from Step 1 owns the build and stale-build check.
- [x] Add a small public-API smoke test in `packages/core/__tests__` that builds constraints through the exported API and exercises one assignment with category labels.
- [x] Make `playwright.config.ts` the blocking regression configuration and exclude `ui-ux-screenshots.spec.js` explicitly.
- [x] Add a separate screenshot configuration and `test:e2e:screenshots` script that matches only screenshot-capture specs and writes to a distinct output directory.
- [x] Replace every fixed `waitForTimeout` in the screenshot spec with an observable readiness condition: a visible hydrated control, target URL, populated result region, opened menu state, completed font/layout state, or a documented screenshot-only stabilization helper.
- [x] Keep real assertions in regression specs. Screenshot capture must not inflate the blocking regression test count and must not be added to the deploy gate.
- [x] Run both configs through the same scoped process runner so screenshot failures receive identical cleanup.

**Acceptance criteria**

- The optimizer E2E no longer throws on `categoryLabels`, and it asserts localized assignment labels.
- `bun run test:e2e` cannot discover `ui-ux-screenshots.spec.js`.
- `bun run test:e2e:screenshots` discovers only the screenshot suite.
- The screenshot spec contains no `waitForTimeout`.
- Each suite exits with its own real status after repository-owned browser and port cleanup.

### 3. Replace copied web-test implementations with production helpers

**Findings:** C1-063 (High, High)

**Current locations**

- `apps/web/__tests__/analyzer-adapter.test.ts:1-72`
- `apps/web/src/lib/analyzer.ts:24-89,283-294`
- `apps/web/__tests__/parser-encoding.test.ts:17-49`
- `apps/web/src/lib/parser/index.ts:21-74`
- `apps/web/__tests__/store-persistence.test.ts:1-111`
- `apps/web/src/lib/store.svelte.ts:106-360`
- `apps/web/__tests__/parser-pdf.test.ts:10-74`
- `apps/web/src/lib/parser/pdf.ts:521-605`

**Changes**

- [x] Move analyzer-only pure transformations into an importable production module that does not import the parser/PDF/browser runtime. Include category-node projection, catalog validation/normalization, valid month extraction, and monthly-breakdown logic actually used by `analyzer.ts`.
- [x] Delete the local `toCoreCardRuleSets`, `getLatestMonth`, validation sets, and monthly-breakdown copies from `analyzer-adapter.test.ts`. Import and test the production functions. Invalid reward types must follow the production behavior, not the stale `"none"` expectation.
- [x] Extract text encoding detection/decoding into the browser-safe production kernel used by `parseFile` and imported by `parser-encoding.test.ts`; the pinned Bun server fallback and browser-native decoder share the same detected encoding contract.
- [x] Move persistence serialization, migration bounds, plain-object checks, and deserialization/validation into a side-effect-free production module. `store.svelte.ts` must call it, while `store-persistence.test.ts` imports it directly.
- [x] Add one built-app persistence E2E that seeds malformed and older-version `sessionStorage`, loads the real store/page, and verifies bounded migration, safe recovery, and the visible warning contract.
- [x] Move PDF fallback date/amount matching and line-to-transaction extraction into a browser-safe production helper with no `pdfjs-dist` or Vite `?url` import. `pdf.ts` and `parser-pdf.test.ts` call the same helper.
- [x] Test fallback behavior through full text-line input and resulting transactions/errors, including parentheses, Korean/full-width/trailing negative forms.
- [x] Remove copied-regex parity tests; the tests execute code reachable from production.
- [x] Replace the obsolete catalog transformation assertion with exact production-reader validation and object-identity coverage for the generated optimizer artifact.

**Acceptance criteria**

- No assigned test file contains a local copy of the corresponding production algorithm or regex.
- The production helper modules are imported by both the application and their tests.
- Web unit tests can import the helpers without loading `pdfjs-dist`, a browser worker URL, or a Svelte singleton.
- Invalid reward, encoding, persistence, and PDF fallback cases assert current production behavior.
- The real built application safely handles malformed persisted state.

### 4. Unify schema validation and make all generated artifacts deterministic

**Findings:** C1-065 (High, High)

**Current locations**

- `scripts/build-json.ts:1-81,177-293,305-451`
- `packages/rules/src/schema.ts:14-24,41-71,93-106`
- `packages/rules/src/loader.ts:7-15`
- `packages/rules/__tests__/schema.test.ts:275-301`
- `package.json:9-22`
- `.github/workflows/deploy.yml:31-39`

**Changes**

- [ ] Delete the relaxed duplicate Zod schemas from `scripts/build-json.ts`. Import `cardRuleSetSchema`, `categoriesFileSchema`, and `issuersFileSchema` from `@cherrypicker/rules` or its exported source entry.
- [ ] Parse every YAML/category/issuer source through the canonical schemas before any artifact is assembled. Do not default missing required metadata or strip fields merely to make publication succeed.
- [ ] Treat issuer-directory mismatch, unknown issuer, duplicate card ID, invalid tier reference, and category-contract failures as publication errors. Integrate the semantic catalog validator from the C1-001/C1-003 plan when it lands; do not leave a second warning-only path.
- [ ] Keep generator-specific projection/rendering after successful canonical validation. Types must be inferred from/exported by the canonical schema rather than repeated as a handwritten `CardEntry`.
- [ ] Split generation into a pure deterministic `buildArtifacts(inputs)` operation and a thin CLI with `--write` and `--check` modes.
- [ ] Sort every source and derived collection with explicit stable tie-breakers:

  - source paths lexically;
  - issuers by card count, then issuer ID;
  - cards by type, annual fee, then card ID;
  - category/index entries by value, then card ID and tier/category key;
  - object keys before JSON serialization.

- [ ] Remove `new Date()` from tracked content. Retain a valid deterministic snapshot time derived from canonical source metadata, and add a deterministic SHA-256 source/content hash to `meta`. Rebuilding identical source bytes must produce identical artifact bytes.
- [ ] Render tracked JSON with one documented serialization policy. Use compact JSON for browser runtime artifacts and formatted JSON only where humans intentionally review it.
- [ ] Produce, compare, and write the complete artifact set from the same in-memory model:

  - `packages/rules/data/cards.json`;
  - `packages/rules/data/cards-compact.json`;
  - `apps/web/public/data/cards.json` while compatibility remains necessary;
  - `apps/web/public/data/categories.json`;
  - `apps/web/src/lib/category-labels-fallback.ts`;
  - the new summary/detail/optimizer artifacts from Step 6;
  - generated README catalog sections from Step 7.

- [ ] Make `--check` compare expected bytes to every tracked artifact without writing. Report every missing/stale path in one run and exit nonzero.
- [ ] Make `--write` use temporary files followed by atomic renames so a failed run cannot leave a half-updated catalog.
- [x] Add root scripts:

  - `data:build` for explicit writes;
  - `data:check` for non-mutating parity;
  - `toolchain:check` for the Bun pin;
  - `verify` including `toolchain:check` and `data:check` before lint/typecheck/tests.

- [ ] Add generator tests with temporary fixture directories proving rejection of negative rates, simultaneous positive `rate` and `fixedAmount`, missing required fields, duplicate IDs, bad issuer/tier/category references, and malformed issuer/category files.
- [ ] Add a determinism test that builds twice from identical inputs and compares every byte/hash.
- [ ] Replace the loose `rules.length > 650` assertion with exact source/artifact parity: YAML file count, successfully validated rules, unique IDs, issuer totals, generated meta totals, compact/summary totals, and README table totals must all agree.

**Acceptance criteria**

- A YAML document rejected by `loadCardRule` cannot be accepted or published by the generator.
- `bun run data:check` performs no tracked writes and identifies all stale artifacts.
- Two builds from identical sources are byte-identical, including metadata.
- Exactly 683 current YAML cards and 24 current issuers agree across canonical validation, generated artifacts, and generated documentation; the assertion derives those values from sources rather than hard-coding them as permanent constants.
- `bun run verify` fails on any schema, semantic, generated-data, generated-documentation, or Bun-version drift.

### 5. Bound multi-file parsing and preserve deterministic aggregation

**Findings:** C1-042 (Medium, High)

**Current locations**

- `apps/web/src/components/upload/FileDropzone.svelte:152-220`
- `apps/web/src/lib/analyzer.ts:296-365`
- `apps/web/src/lib/parser/index.ts:21-100`

**2026-07-23 implementation evidence:** `apps/web/src/lib/file-parse-queue.ts` now
defines the named `FILE_PARSE_CONCURRENCY = 2` cap, ordered settled outcomes,
release-before-dequeue behavior, browser scheduling yield, monotonic progress,
cancellation, and a latest-generation commit gate. `analyzer.ts` consumes the
queue, `store.svelte.ts` conditionally commits only its newest request, and
`FileDropzone.svelte` snapshots files and exposes completed/total progress.
Focused queue/wiring tests pass 6/6; the full web unit suite passes 268/268.

**Changes**

- [x] Replace `Promise.all(files.map(...))` with a small production `mapWithConcurrency`/parse queue capped at two in-flight files. Keep the cap named and documented.
- [x] Preserve input order by storing each result/error at its original index even when completion order differs.
- [x] Keep one shared `MerchantMatcher` and category tree, but never share mutable per-file parser state.
- [x] Yield to the browser event loop between completed files using `scheduler.yield()` when available and a zero-delay fallback otherwise.
- [x] Release per-file buffers/workbooks/parser intermediates before dequeuing the next file; keep only the normalized parse result required for aggregation.
- [x] Preserve the current per-file error isolation: one failure must be recorded with its filename while later queued files still run.
- [x] Expose completed/total progress to the store/upload status without persisting `File` or buffer objects.
- [x] Honor cancellation between queue items and prevent a late completion from overwriting a newer analysis generation.
- [x] Add production-helper tests with delayed fake parsers proving maximum concurrency two, deterministic result/error order, continued work after one rejection, cancellation, progress ordering, and cleanup.

**Acceptance criteria**

- Instrumented tests never observe more than two active parsers.
- Ten files do not allocate ten simultaneous parser buffers/workbooks.
- Aggregate transactions and errors remain in the same deterministic file order as the input.
- A failed file does not prevent subsequent files from being attempted.
- The UI receives monotonic per-file progress and remains schedulable between files.

### 6. Lazy-load analyzers/parsers and replace full catalog-list loading

**Findings:** C1-043 (Medium, High), C1-044 (Medium, High)

**Current locations**

- `apps/web/src/components/upload/FileDropzone.svelte:1-7,315-325`
- `apps/web/src/lib/store.svelte.ts:1-5,491-619`
- `apps/web/src/lib/analyzer.ts:1-17,191-219,276-280`
- `apps/web/src/lib/parser/index.ts:1-19,21-100`
- `apps/web/src/lib/cards.ts:135-185,231-313`
- `apps/web/src/components/cards/CardGrid.svelte:14-93,193-231`
- `scripts/build-json.ts:391-428`
- `apps/web/astro.config.ts:5-12`

#### 6A. Lazy parser/analyzer boundaries

- [x] Keep only format detection and shared parser types statically imported by the dispatcher.
- [x] Remove static imports/re-exports of CSV, XLSX, PDF, JSON, OFX, and HTML implementations from `apps/web/src/lib/parser/index.ts`. Dynamically import exactly the selected parser inside each format branch. Existing direct consumers/tests must import their concrete format module.
- [x] Remove the store's eager runtime import of `analyzer.ts`. Dynamically import the analyzer only when `analyze` or `reoptimize` begins; retain type-only imports statically.
- [x] Keep quick bank/format detection lightweight. Selecting a file may load detection code, but must not load SheetJS, pdf.js, or the other unused format parsers.
- [x] Make immutable compiled catalog/category caches independent of `analysisStore.reset()` so reset does not force a second static catalog transformation. Provide explicit test-only/cache-version invalidation where needed rather than loading the analyzer on reset.
- [x] Enable a Vite build manifest and add a deterministic bundle-budget check that walks the home entry's initial dependency graph.

#### 6B. Summary, detail, and optimizer artifacts

- [x] Generate `cards-summary.json` containing only grid/search/filter fields and stable issuer metadata.
- [x] Generate per-card detail artifacts (or issuer shards with an ID index) so `getCardById` fetches only the selected card's detail, not all 683 rules.
- [x] Generate a flat, minified, calculator-ready optimizer catalog without duplicate issuer/category/index wrappers. Validate it canonically during generation and load/cache it once for analysis.
- [x] Give summary, detail, and optimizer loaders separate promises/controllers/caches and preserve the explicit failure/caller-cancellation contract from C1-026.
- [x] Remove the runtime full-object `toCoreCardRuleSets` copy when the generated optimizer payload already has the canonical core shape. Retain a production validation reader that returns the original validated array rather than duplicating the object graph.
- [x] Do not clear the immutable optimizer catalog on ordinary store reset.

#### 6C. Bounded catalog rendering

- [x] Change `getCardList` to use only `cards-summary.json`.
- [x] Render at most 36 card buttons per page. Add previous/next and page controls with accessible names, current-page state, result range, and disabled boundaries.
- [x] Reset/clamp the page when search/type/issuer filters reduce the result set.
- [x] Preserve search, sort, issuer, type, and page state in URL query parameters so navigating into a detail and back restores the list.
- [x] Keep the live result count and add a range such as “1–36 / 683.”
- [x] Add production-helper/static component tests for pagination boundaries, filter/page reset, query restoration, and a maximum of 36 rendered cards.
- [x] Add production-helper tests for summary parsing, detail lookup, and independent caches when the summary/detail/optimizer artifacts land.
- [x] Add and execute a standalone Playwright request-boundary regression for exact summary/legacy/optimizer/detail paths, the 36-card DOM bound, one selected issuer shard, and one optimizer fetch.

**Artifact and bundle budgets**

- The cards page must not request the legacy full `cards.json`.
- `cards-summary.json` must be at most 250 KiB raw and 60 KiB gzip for the current 683-card catalog.
- The calculator-ready artifact must be at most 65% of the legacy `cards.json` raw byte size and must not be copied into a second transformed object graph on the main thread.
- The home route's initial Vite dependency graph must exclude the XLSX, PDF, JSON, OFX, and HTML parser modules.
- Before file selection/analysis, decoded initial JavaScript must be at most 400 KiB and transferred initial JavaScript at most 150 KiB in the Chromium regression fixture.
- A deterministic source and production-bundle test must prove that each format branch imports exactly one concrete parser, produces six distinct deferred entries, and cannot statically reach another concrete parser entry. Browser request smoke may be run later only through the scoped runner.

**Acceptance criteria**

- The upload page does not load all format parsers before the user asks to analyze.
- The catalog grid fetches a compact summary and renders no more than 36 cards.
- Selecting one card fetches only its detail/shard.
- Analysis consumes one cached canonical optimizer artifact without the legacy wrapper/index and without reset-triggered re-transformation.
- Bundle and artifact budget checks are deterministic and blocking in `verify`.

### 7. Generate accurate catalog documentation and correct executable examples/identity

**Findings:** C1-067 (High, High), C1-068 (Medium, High), C1-069 (Medium, High), C1-070 (Low, High)

**Current locations**

- `README.md:12,27,37,53-68,86-104,114-129`
- `packages/rules/data/cards/shinhan/README.md:3-23`
- `packages/rules/data/cards/bc/README.md:3-33`
- `packages/rules/data/cards/dgb/README.md:3-14`
- all issuer directories under `packages/rules/data/cards/`
- `tools/cli/src/index.ts:7-32`
- `tools/scraper/src/cli.ts:53-69,81-97`

**Changes**

- [x] Add marker-delimited generated catalog sections to the root README. Generate the card/issuer badges and issuer-count table from canonically validated YAML inputs.
- [x] Remove duplicated free-text numeric catalog claims outside generated markers, or rewrite them without a count. There must be one generated source of catalog totals.
- [x] Assert that the generated root table contains every registered issuer exactly once and that its row sum equals the canonical YAML total.
- [x] Preserve hand-written issuer commentary, but rename incomplete “카드 목록” sections to “대표 카드” and clearly state that they are curated examples.
- [x] Add a marker-delimited generated full index to every issuer README with exact current count, latest canonical `lastUpdated`, card name/type, and relative YAML link.
- [x] Create minimal README files for the six issuer directories currently missing them, using issuer metadata plus the generated full index.
- [x] Make `data:check` validate README presence, generated markers, full-index/card-file parity, issuer counts, and links.
- [x] Correct the local CLI example to include a real statement argument:

  ```sh
  bun run analyze -- ./statement.csv
  ```

- [x] Add a PDF example with `--allow-remote-llm` and a concise statement that the flag authorizes the documented Anthropic fallback/data transfer; document `--yes` only as the explicit noninteractive consent option.
- [x] Replace the nonexistent `apps/web/src/lib/categorizer-ai.ts` tree entry with the actual analyzer, categorizer, and parser boundaries. Include the generated data/check commands and generated-artifact locations.
- [x] Standardize user-visible “CardPick” text in CLI/scraper help and progress output to “CherryPicker.” Keep the executable/bin name `cherrypicker`.
- [x] Explain that scraper target support is narrower than the complete 24-issuer catalog instead of implying that the ten configured scrape targets are the whole catalog.
- [x] Update stale analyzer comments such as “< 500” to describe the generated catalog without a hand-maintained count.
- [x] Add tests for generated Markdown escaping, stable ordering, marker replacement without disturbing hand-written prose, root count parity, issuer index parity, and executable README command shapes.

**Acceptance criteria**

- The root README's generated issuer rows sum to the generated total and cannot drift independently.
- All 24 issuer directories have a README and an exhaustive generated index; any hand-written partial list is explicitly labeled representative.
- The documented `bun run analyze -- ./statement.csv` reaches the CLI with a file argument.
- No user-facing CLI/scraper help says “CardPick.”
- The project tree contains only real paths and the generated-data workflow is documented accurately.

### 8. Pin CI to the current Bun contract and add blocking E2E verification

**Findings:** C1-061 (High, High), C1-071 (Medium, High)

**Current locations**

- `package.json:15-18,32`
- `.github/workflows/deploy.yml:18-39`

**Changes**

- [x] Keep `package.json:32` as the source declaration `bun@1.2.6` for this cycle.
- [x] Pin `oven-sh/setup-bun` to exactly `1.2.6`, not `latest`.
- [x] Add `scripts/check-toolchain.ts` (or an equivalent non-network check) that reads `packageManager`, compares it with `bun --version`, and fails with the expected/actual versions. Run it in `verify` and CI immediately after setup.
- [x] Continue using `bun install --frozen-lockfile`.
- [x] Install the pinned Playwright Chromium and its CI system dependencies in a dedicated workflow step.
- [x] Run `bun run data:check`, the repository verification gates, the web build/bundle budgets, and then `bun run test:e2e` before Pages artifact upload.
- [x] Keep screenshot capture out of the blocking workflow.
- [x] Upload Playwright traces/reports only on regression failure so a red gate is diagnosable.
- [x] Ensure the E2E step uses the scoped runner from Step 1 and always executes its cleanup before the workflow proceeds to artifact handling.
- [x] Add a workflow/package-script consistency test that asserts the workflow's Bun pin equals `packageManager`, invokes the regression script, and never substitutes the screenshot script.
- [x] Update README prerequisites to state Bun 1.2.6 (the current declared pin) and the one command used to verify it.

**Acceptance criteria**

- CI and local declared tooling both use Bun 1.2.6.
- A Bun-version mismatch fails before dependency-sensitive gates.
- The Pages artifact cannot be uploaded after a failed regression E2E.
- The blocking workflow runs production regression specs and excludes screenshot capture.
- No deploy is performed during implementation or validation of this plan.

## Explicit deferred performance findings

These are the only assigned findings not scheduled for implementation in this plan. They remain open at their original severity/confidence.

### D-C1-040 — Incremental, worker-hosted optimizer

**Original finding:** C1-040
**Original severity:** High
**Original confidence:** High
**Status:** Deferred performance/architecture work; not fixed by this plan

**Exact locations**

- `packages/core/src/optimizer/greedy.ts:39-70,187-265`
- `packages/core/src/calculator/reward.ts:67-94,191-382`
- `apps/web/src/lib/analyzer.ts:276-280`
- `apps/web/src/lib/store.svelte.ts:613-619`

**Concrete rationale**

An O(cards × transactions) incremental accumulator must encode exactly the same tier, condition, category, unit, per-transaction cap, category cap, global cap, and rollback semantics as the canonical calculator. Those semantics are being corrected by C1-002, C1-005, C1-006, C1-007, C1-008, and C1-009. Building a mutable accumulator and worker protocol first would either preserve known-wrong behavior or require a second high-risk rewrite immediately afterward. This is performance/architecture work, so explicit deferral is permitted; the High rating is not downgraded.

Moving only the existing quadratic implementation to a worker is not considered a fix. It would hide the freeze while retaining multi-second CPU use and duplicated catalog memory.

**Exit criterion and required implementation**

Reopen as soon as all six reward-contract findings above are merged and a deterministic calculator conformance suite is green. The reopened work must:

1. compile rule lookup/tier selection once per card;
2. implement `preview(transaction)`/`commit(delta)` accumulator state without replaying assigned history;
3. retain only the best six scores without sorting all cards;
4. calculate best-single-card results incrementally in the same pass;
5. host browser optimization behind a module worker with request IDs, cancellation, progress, and stale-response rejection;
6. prove output parity against the canonical batch calculator on deterministic randomized fixtures.

Measurable completion requires all of:

- the real 683-card/1,000-transaction optimizer benchmark median is at most 1.0 second on the current development host;
- doubling 500 to 1,000 transactions increases median time by no more than 2.5×;
- browser heartbeat delay during optimization stays below 100 ms in the Playwright fixture;
- no `calculateRewards([...assignedHistory, tx])` replay or full 683-score sort remains in the transaction loop;
- all canonical calculator/optimizer and differential conformance tests pass.

### D-C1-041 — Compiled merchant keyword matcher

**Original finding:** C1-041
**Original severity:** High
**Original confidence:** High
**Status:** Deferred performance/architecture work; not fixed by this plan

**Exact locations**

- `packages/core/src/categorizer/matcher.ts:8-19,61-103,129-139`
- `packages/core/src/categorizer/taxonomy.ts:58-107`
- static maps in `packages/core/src/categorizer/keywords*.ts`

**Concrete rationale**

C1-001 is replacing the current last-write-wins merge, conflicting category shapes, and hidden duplicate keyword precedence with an authoritative normalized category/keyword contract. Building an Aho–Corasick/trie or n-gram reverse index over today's merged map would compile known-conflicting mappings and make their accidental precedence harder to inspect. The compiled matcher must consume the canonical conflict-free stream produced by C1-001, not create a fifth interpretation. This is performance/architecture work, so explicit deferral is permitted; the High rating is preserved.

**Exit criterion and required implementation**

Reopen immediately when C1-001 publishes one normalized keyword stream and its catalog lint reports zero unresolved cross-map conflicts. The reopened work must:

1. preserve exact-match precedence;
2. use a compiled multi-pattern matcher for keyword-in-merchant searches;
3. use a bounded n-gram/prefix candidate index for reverse containment and verify candidates before selection;
4. cache all unique merchants for one analysis instead of churning at 500;
5. run differential matching against the canonical reference over every keyword plus deterministic prefix/suffix/unknown mutations.

Measurable completion requires all of:

- result/category/subcategory/confidence parity for the full differential corpus;
- 1,000 unique unmatched merchants complete in at most 200 ms on the current development host;
- 5,000 unique unmatched merchants complete in at most 750 ms;
- 1,000→5,000 scaling is at most 5.5×;
- the hot miss path contains no full scan of all approximately 12,740 keywords and no second full taxonomy scan.

## Exact quality gates

Run these as separate commands in this order. Record every exit code. A failure does not skip later independent gates; after the full matrix is collected, fix all error-level failures and rerun the affected gate plus its downstream gates.

1. Toolchain identity:

   ```sh
   bun --version
   bun run toolchain:check
   ```

   Expected Bun version: `1.2.6`.

2. Non-mutating generated-source parity:

   ```sh
   bun run data:check
   ```

3. Repository static gates:

   ```sh
   bun run lint
   bun run typecheck
   ```

4. All workspace unit/integration tests:

   ```sh
   bun run test
   ```

5. Full build and deterministic bundle/artifact budgets:

   ```sh
   bun run build
   bun run check:artifacts
   bun run check:bundle
   ```

6. Regression E2E lifecycle and suite:

   ```sh
   bun run e2e:status --assert-clean
   bun run test:e2e
   bun run e2e:status --assert-clean
   ```

7. Screenshot-suite split validation:

   ```sh
   bun run test:e2e:screenshots
   bun run e2e:status --assert-clean
   ```

8. Final no-drift and patch hygiene:

   ```sh
   bun run data:check
   git diff --check
   git status --short
   ```

For both E2E commands, the scoped runner must clean before and in `finally` after the batch. If the regression batch fails, capture the failure, verify cleanup, and still run non-browser gates and the independent screenshot-discovery batch. Before handoff, however, every configured error-level gate must be green.

## Handoff evidence

The implementation report must include:

- changed files grouped by E2E lifecycle, generated data, production-helper tests, browser performance, docs, and CI;
- confirmation that no deployment command or workflow dispatch ran;
- the toolchain pin observed by `toolchain:check`;
- `data:check` proof before and after tests;
- artifact and initial-bundle byte budgets;
- maximum observed parse concurrency and card-grid DOM count;
- regression and screenshot suite discovery counts;
- pre/post E2E ownership status showing the chosen run port clear and no repository-owned browser/profile process, while separately recording any preserved foreign default-port listener;
- a note that interactive Chrome and the unrelated Travelback session were preserved;
- every gate exit code, including initially failed batches and successful reruns;
- confirmation that the pre-existing dirty amount-parser/store work and all review files were preserved.

## Aggregate ID coverage

| Aggregate ID | Original severity / confidence | Disposition | Plan location |
|---|---|---|---|
| C1-040 | High / High | Explicitly deferred; remains open | D-C1-040 |
| C1-041 | High / High | Explicitly deferred; remains open | D-C1-041 |
| C1-042 | Medium / High | Scheduled | Step 5 |
| C1-043 | Medium / High | Scheduled | Steps 4 and 6 |
| C1-044 | Medium / High | Scheduled | Step 6A |
| C1-061 | High / High | Scheduled | Step 8 |
| C1-062 | High / High | Scheduled | Step 2 |
| C1-063 | High / High | Scheduled | Step 3 |
| C1-064 | High / High | Scheduled | Step 1 |
| C1-065 | High / High | Scheduled | Steps 4, 6B, and 7 |
| C1-066 | Low / High | Scheduled | Step 2 |
| C1-067 | High / High | Scheduled | Step 7 |
| C1-068 | Medium / High | Scheduled | Step 7 |
| C1-069 | Medium / High | Scheduled | Step 7 |
| C1-070 | Low / High | Scheduled | Step 7 |
| C1-071 | Medium / High | Scheduled | Step 8 |

**Coverage check:** 16 assigned aggregate IDs = 14 scheduled + 2 explicitly deferred + 0 omitted.
