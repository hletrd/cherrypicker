# Review-plan-fix Cycle 17 — tracer

## Review identity

- Date: 2026-07-24
- Revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: causal tracing across parser, analysis, optimizer, persistence/UI,
  catalog generation, and catalog consumers
- Disposition: all four current Cycle 17 candidates confirmed under their
  existing owners; no distinct tracer-only root retained
- Scope: read-only investigation plus this report. No product source, test,
  generated artifact, plan, dependency, configuration, commit, deployment, or
  external state was changed.

## Inventory

The exact Git tree contains 2,374 tracked paths: 1,204 tracked `.context`
records and 1,170 active paths. Every active path was included in the tracked
manifest and classified before tracing. The causal inventory covered these
producer, boundary, and consumer groups:

| Flow | Files and collections inventoried |
| --- | --- |
| Server parser entry and routing | `packages/parser/src/statement.ts`, `packages/parser/src/detect.ts`, `packages/parser/src/{csv,xlsx,html,json,ofx,pdf}/**`, shared parser kernels, public barrels, and `tools/cli/src/parse-statement.ts` |
| Browser parser entry and workers | `apps/web/src/lib/parser/index.ts`, all browser parser adapters, `worker-runner.ts`, `worker-protocol.ts`, all five parser workers, upload admission, file queue, and format detection |
| Analysis and calendar scope | `apps/web/src/lib/analyzer.ts`, `analyzer-helpers.ts`, `analysis-context.ts`, `packages/core/src/analysis/context.ts`, `performance.ts`, and `tools/cli/src/analysis.ts` |
| Optimizer | `apps/web/src/lib/optimizer/**`, `packages/core/src/optimizer/**`, reward calculation, constraints, numeric helpers, result models, and browser/CLI callers |
| State, persistence, and UI | `operation-epoch.ts`, `analysis-replacement-runtime.ts`, `analysis-reset-runtime.ts`, `store.svelte.ts`, `analysis-result.ts`, `persistence.ts`, result/dashboard/report components, Astro result pages, and visualization consumers |
| Catalog authoring and generation | `packages/rules/src/schema.ts`, validation and availability helpers, all 683 authored card YAML files, category and issuer YAML, `scripts/build-json.ts`, `scripts/catalog-publication.ts`, publication checks, and generated catalog files |
| Catalog readers and consumers | `apps/web/src/lib/cards.ts`, `card-catalog-reader.ts`, category-label modules, card list/detail components and pages, core optimizer catalog input, CLI catalog loader, scraper schema/writer boundaries, and bundle/data checks |
| Regression and history evidence | All 176 tracked paths matching standard test-file names plus their fixtures, the complete Cycle 16 role set and aggregate, archived Plan 143 and its implementation, all current Cycle 17 reports, and candidate-specific searches over all 1,204 tracked `.context` records |

Generated data was traced as a collection from canonical schema and authored
input through publication and checked-in output. It was not treated as
independent handwritten logic. Protected untracked Cycle 42 files were
excluded from review provenance.

## End-to-end trace 1 — statement input to persisted and rendered result

1. Server parsing dispatches detected formats in
   `packages/parser/src/statement.ts:75-150`. Browser parsing dispatches the
   same supported formats to a dedicated worker or direct fallback in
   `apps/web/src/lib/parser/index.ts:55-142`.
2. Spreadsheet and HTML routes validate the complete decoded workbook before
   logical conversion:
   `packages/parser/src/xlsx/index.ts:110-169`,
   `packages/parser/src/html/index.ts:57-103`, and their browser counterparts.
   The shared limits and checked cumulative validation are in
   `packages/parser/src/shared/sheet-cells.ts:1-70,260-370`; the bounded
   row-interval merge index and last-range-wins lookup are at
   `packages/parser/src/shared/sheet-cells.ts:372-432`.
3. Browser parsing and categorization completes before the strict analysis
   context is built
   (`apps/web/src/lib/analyzer.ts:143-175,286-335,407-425`). Parser workers
   therefore isolate format work, but not the subsequent calendar-context
   work.
4. `buildAnalysisContext()` first partitions every input with the strict
   calendar validator, then re-invokes the same validator through
   `yearMonthOfDate()` while deriving the latest month, latest rows, previous
   rows, and monthly buckets
   (`packages/core/src/analysis/context.ts:51-77,101-179`).
5. Only after that synchronous context construction does the browser send
   constraints to the optimizer worker
   (`apps/web/src/lib/analyzer.ts:418-425,250-283` and
   `apps/web/src/lib/optimizer/worker-runner.ts:52-130`). The CLI reaches the
   same context directly at `tools/cli/src/analysis.ts:58-82`.
6. The fresh result is coherently validated before return
   (`apps/web/src/lib/analyzer.ts:428-461`). Replacement analysis and
   reoptimization use owned epochs and current-result checks before commits
   (`apps/web/src/lib/analysis-replacement-runtime.ts:114-207` and
   `apps/web/src/lib/store.svelte.ts:332-440`).
7. Persistence projects and size-bounds the validated result
   (`apps/web/src/lib/persistence.ts:127-198`), and restoration performs
   structural decoding followed by final coherence validation
   (`apps/web/src/lib/persistence.ts:720-923`). Result, dashboard, report, and
   warning components consume that state after restoration.

This trace places `RPF17-PERF-001` on the ordinary synchronous path between
parser completion and optimizer dispatch. The worker boundary does not absorb
or hide the repeated validation.

## End-to-end trace 2 — catalog authoring to generated consumers

1. Card and category authoring data enters through the rules schemas.
   Category IDs and labels are unrestricted strings at
   `packages/rules/src/schema.ts:303-335`.
2. Canonical reward publication preserves a discriminant through
   `publicationRewardIndexValue()`
   (`scripts/catalog-publication.ts:173-187`).
3. The legacy generator branch reduces each tier to its raw numeric amount,
   selects a maximum, sorts category entries by that number, and sorts then
   truncates compact rewards by the same number
   (`scripts/build-json.ts:79-86,248-271,373-404`). The retained kind and unit
   are not used by either ordering.
4. That branch publishes `packages/rules/data/cards.json`,
   `packages/rules/data/cards-compact.json`, and
   `apps/web/public/data/cards.json`
   (`scripts/build-json.ts:365-413`). It does not feed the primary browser
   optimizer.
5. The primary browser path instead loads independently validated summary,
   optimizer, category, and issuer-detail artifacts, checking a common source
   hash (`apps/web/src/lib/cards.ts:308-458`). This bounds the effect of the
   heterogeneous ordering to the legacy/public derived contract.
6. A separate generator branch places raw category strings between handwritten
   single quotes while constructing a TypeScript module
   (`scripts/build-json.ts:448-463`). The generated module is re-exported at
   `apps/web/src/lib/category-labels.ts:21-23`, statically imported by
   `apps/web/src/components/cards/CardDetail.svelte:1-19`, and selected as a
   runtime fallback at `CardDetail.svelte:40-62`.

This trace separates the two catalog findings. `C17-CR-001` is an invalid
comparison in legacy derived data. `C17-SEC-001` is a distinct data-to-code
encoding boundary on an active fallback module.

## End-to-end trace 3 — web parity test to dependency resolution

1. `apps/web/__tests__/parser-cycle5-integrity.test.ts:3,48-50` directly
   imports and calls `iconv-lite` to construct a CP949 fixture.
2. `apps/web/package.json:14-30` declares neither a dependency nor a
   development dependency for that package.
3. Resolution currently succeeds through the workspace graph because the web
   package depends on `@cherrypicker/parser`, whose manifest declares
   `iconv-lite` at `packages/parser/package.json:20-24`.
4. The repository dependency policy enumerates only each workspace's `src`
   tree and compares imports only with production dependencies
   (`scripts/check-dependencies.ts:553-595,695-720`). It therefore cannot
   identify the test-only direct import.

This trace confirms `C17-DEP-001` as a current test ownership defect rather
than a runtime parser defect. The present hoisted resolution explains why the
test passes; it does not create a direct manifest contract.

## Current Cycle 17 candidate adjudication

| Candidate | Severity / confidence / status | Causal disposition | Ordinary scenario and correction |
| --- | --- | --- | --- |
| `C17-CR-001` — heterogeneous legacy reward ranking | Low / High / Confirmed | Confirmed at `scripts/build-json.ts:79-86,248-271,373-404`. Percentage, fixed Won, mileage, per-day, and per-liter amounts are ordered and truncated as one scalar. The modern optimizer catalog does not consume this ordering, so the original Low impact is retained. | A legacy reader treats descending values or the top-five list as comparable recommendations even though ordering changes with purchase and benefit context. Remove the unsupported ranking, or group by canonical kind and unit without cross-group truncation; use the calculator for contextual comparison. |
| `RPF17-PERF-001` — repeated strict calendar validation | Medium / High / Confirmed | Confirmed at `packages/core/src/analysis/context.ts:54-77,114-160`; ordinary browser, reoptimization, and CLI callers are `apps/web/src/lib/analyzer.ts:407-425`, `apps/web/src/lib/store.svelte.ts:355-394`, and `tools/cli/src/analysis.ts:58-82`. | A large valid statement pays the calendar round trip during admission and again in three downstream passes before optimization begins. Keep strict validation at admission, then derive months from the established invariant and combine downstream aggregation without revalidating each row. |
| `C17-SEC-001` — raw category data in generated TypeScript | Medium / High / Confirmed | Confirmed at `packages/rules/src/schema.ts:303-335` and `scripts/build-json.ts:448-463`, with active fallback consumers at `apps/web/src/lib/category-labels.ts:21-23` and `apps/web/src/components/cards/CardDetail.svelte:40-62`. Current authored values are benign. | Ordinary source-significant punctuation can break generation, while a source-valid authored value can alter first-party code before Svelte rendering. Serialize an in-memory tuple array as structured data, and add exact round-trip generator coverage for source-significant characters. |
| `C17-DEP-001` — undeclared web test dependency | Low / High / Confirmed | Confirmed at `apps/web/__tests__/parser-cycle5-integrity.test.ts:3,48-50`, `apps/web/package.json:14-30`, and `packages/parser/package.json:20-24`. Current resolution is transitive; `scripts/check-dependencies.ts:553-595` excludes tests. | An isolated or stricter workspace install, or removal of parser's runtime need for `iconv-lite`, makes the unchanged web parity test unresolvable. Declare a web development dependency or move encoding behind an owning helper, and extend policy coverage to test/config imports and development dependencies. |
| Cycle 17 critic — no retained finding | N/A | Compatible with the three source-specific roots above. Its Cycle 16 repair assessment is confirmed by the parser trace; it supplied no contrary causal evidence. | No action beyond retaining the current owners. |
| Cycle 17 verifier — three confirmed roots, no verifier-only root | N/A | Independently consistent with the first three producer-to-consumer traces; it predates the later dependency report. | No duplicate count. |
| Later Cycle 17 architect and document reports — no retained finding | N/A | Both are compatible with the four current roots. The document report's remaining worksheet-limit prose gap retains its explicit Cycle 16 owner. | No duplicate count. |

## Competing hypotheses

### Rejected — legacy ranking changes current browser recommendations

The affected rankings are published in legacy/public catalog artifacts.
`loadOptimizerCatalog()` reads `data/cards-optimizer.json` through its own
decoder at `apps/web/src/lib/cards.ts:336-359,438-443`. No production reference
routes the legacy `index.byCategory` or compact `topRewards` into
`greedyOptimize()`. The ranking defect remains real, but this broader impact
hypothesis is not supported.

### Rejected — Svelte text escaping closes the generated-source boundary

Svelte escaping applies after module parsing and execution. The raw value is
inserted into TypeScript source during generation, before
`CardDetail.svelte` can render it. Svelte's output encoding therefore does not
mitigate `C17-SEC-001`.

### Rejected — parser workers contain the repeated calendar work

Workers return normalized parser results. Calendar context construction occurs
after the parse queue resolves and before optimizer-worker dispatch
(`apps/web/src/lib/analyzer.ts:303-335,407-425`). The repeated validator remains
main-thread synchronous in the browser and directly synchronous in the CLI.

### Rejected — the Cycle 16 worksheet repair leaves a conversion bypass

The final call-site sweep found four production `sheet_to_json()` sites and
four workbook validation sites: server/browser XLSX and server/browser HTML.
Each workbook route validates first. Direct merge-index calls independently
inspect their merge contract. No fifth production SheetJS conversion or
unvalidated worker adapter was found.

### Rejected — stale async work can publish an otherwise valid but obsolete result

`OperationEpoch.begin()` aborts the previous controller
(`apps/web/src/lib/operation-epoch.ts:15-28`). Replacement analysis composes
caller and store ownership, removes listeners in `finally`, and checks
ownership immediately before state and persistence commits
(`apps/web/src/lib/analysis-replacement-runtime.ts:44-82,114-207`).
Reoptimization additionally pins the starting result object
(`apps/web/src/lib/store.svelte.ts:347-395`). No current late-commit path was
identified.

### Rejected — current transitive resolution means the web test owns `iconv-lite`

Dependency availability and manifest ownership are different invariants.
The package is presently reachable because the parser workspace declares it,
but the importing web test has no direct declaration and the policy does not
scan tests. That competing explanation does not invalidate `C17-DEP-001`.

## Historical reconciliation

All 1,204 tracked `.context` records were inventoried. Candidate-specific
searches were run across the full tracked history, including current and
archived plans, comprehensive reviews, role reports, aggregates, and deferred
items.

- Cycle 16's complete role set, aggregate, Plan 143, implementation, and
  current helper were reconciled. Archived Plan 108 owns XLSX archive-byte
  bounds and Plan 69 owns earlier merge-value semantics; Cycle 16 owns decoded
  worksheet metadata limits and the interval index. No part was relabeled.
- Cycle 2 owns repeated date-array sorting and a prior monthly rebuild concern;
  Cycle 10 owns post-optimizer result coherence. Neither owns repeated strict
  calendar validation inside one current context build.
- Earlier generator work owns catalog validation, deterministic publication,
  source hashes, and generation of the fallback label module. It does not own
  heterogeneous raw-scalar ranking or structured source-literal encoding.
- Earlier dependency findings own scraper's former Zod declaration, removed
  heavy packages, vendor integrity, and browser/server partitions. The web
  parity test moved from parser ownership without a matching web development
  dependency, and no tracked item owns that exact mismatch.
- The historical `rate: 0`/`fixedAmount` issue concerns selecting the canonical
  value discriminant. `C17-CR-001` occurs after the current discriminant is
  derived and is therefore distinct.
- Existing parser, persistence, PDF, cache, unsupported-rule, and UI findings
  retained their historical owners.

The current code, performance, security, dependency, critic, verifier,
architect, and document reports were read in full. Their confirmations are
not counted again as tracer findings.

## Final missed-file sweep

The closing sweep re-ran exhaustive production call-site searches for:

- every `buildAnalysisContext()` caller;
- every `sheet_to_json()`, `validateWorkbookSheetMetadata()`, and
  `createSheetMergeIndex()` call;
- every use of `getTierComparableValue()`, `pickBestTier()`,
  `publicationRewardIndexValue()`, and `FALLBACK_CATEGORY_LABELS`;
- every parser and optimizer worker runner;
- every `serializeAnalysis()`, `deserializeAnalysis()`,
  `isAnalysisResultCoherent()`, and `OperationEpoch` boundary.
- the direct `iconv-lite` import, all workspace manifest declarations, and the
  dependency policy's production/test scan boundary.

The sweep also rechecked canonical inputs, generated outputs, public exports,
browser and CLI consumers, failure handling, state ownership, focused tests,
and candidate-specific history. No missed consumer changed the four current
dispositions, and no distinct current-HEAD tracer root survived.

## Tracer result

No genuinely new tracer-only finding is retained. The aggregate should keep
the existing four unique owners: `C17-CR-001`, `RPF17-PERF-001`,
`C17-SEC-001`, and `C17-DEP-001`.
