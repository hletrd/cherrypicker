# Review-plan-fix Cycle 20 — performance reviewer

## Review identity

- Date: 2026-07-24
- Reviewed revision: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: latency, CPU, memory, concurrency, cancellation, bundle, and
  responsiveness
- Scope: whole tracked repository and documentation; Cycle 18/19 history is
  provenance rather than a source of new findings
- Review mode: read-only except for this report; no browser, E2E, source,
  generated-data, plan, Git-history, publication, or deployment change

## Complete inventory and performance coverage

Inventory preceded inspection. All 2,424 tracked paths were classified:
1,252 context/history paths, 683 authored card YAML files, 30 generated/public
artifacts, 181 test/E2E paths, 211 production-source paths, 29 documentation
paths, 21 manifest/config/workflow paths, one fixture, and 16 other assets.

The performance pass inspected:

- core calendar aggregation, categorization, reward calculation, cap
  telemetry, greedy scoring, alternatives, and deterministic ordering;
- server and browser format detection, decoding, row/cell normalization, ZIP
  preflight, PDF lifecycle, worker transfer, and parser error summarization;
- web parse lanes, operation generations, worker termination, catalog
  request/cache/abort state, coherence, persistence budgets, Svelte derived
  state, and deferred bundles;
- rules/publication generation, split artifacts, compatibility payloads,
  visualization/report templates, CLI and scraper I/O, scripts, test runners,
  CI, and E2E process ownership;
- all 683 cards and generated projections through canonical drift and size
  checks, rather than sampling.

All tracked documentation and historical records entered the novelty/exit
criterion sweep. The six protected untracked Cycle 42 files were not opened,
searched, or changed.

## Result

No genuinely new Cycle 20 performance root survived review.

| Classification | Count | Severity | Confidence | Failure scenario | Recommended fix |
| --- | ---: | --- | --- | --- | --- |
| Confirmed new | 0 | Not applicable | High for current bounded paths | None | None |
| Likely new | 0 | Not applicable | Medium-high whole-tree negative confidence | None | None |
| Manual-validation-only new | 0 | Not applicable | Medium | None | None |

## Current-baseline assessment

### Cycle 19 validation changes do not create a hot-path regression

The basis-aware lower-bound repair performs constant-time kind and month
checks (`apps/web/src/lib/analysis-result.ts:893-924`). Coherence still
collects transaction/month facts in bounded linear passes and does not sort a
transaction-sized array
(`apps/web/src/lib/analysis-result.ts:926-1097`). The persistence catch is one
exception boundary per restore (`apps/web/src/lib/persistence.ts:905-925`).
No extra parse, optimizer replay, network request, or retained data structure
was introduced.

### Runtime ownership and resource bounds remain present

- File parsing is capped at two lanes, releases per-file resources before
  dequeuing, yields to the browser, and stops stale generations
  (`apps/web/src/lib/file-parse-queue.ts:1-148`).
- Parser and optimizer workers terminate and remove listeners on success,
  failure, message error, startup error, and abort
  (`apps/web/src/lib/parser/worker-runner.ts:79-143`;
  `apps/web/src/lib/optimizer/worker-runner.ts:62-136`).
- Catalog requests share promises, use timeouts, preserve per-caller abort
  semantics, and clear rejected caches
  (`apps/web/src/lib/cards.ts:95-165,253-424`).
- XLSX compressed size, entry count, expansion ratio, per-entry and total
  expansion are bounded before inflation
  (`packages/parser/src/shared/xlsx-archive.ts:1-6,113-280`); worksheet rows,
  columns, cells, sheets, and merges are bounded
  (`packages/parser/src/shared/sheet-cells.ts:1-17,245-260`).
- The analyzer constructs one shared matcher and category set for the bounded
  parse queue (`apps/web/src/lib/analyzer.ts:286-337`).

## Candidate disposition and historical ownership

| Candidate and exact region | Concrete performance failure considered | Disposition / existing fix or exit action |
| --- | --- | --- |
| Greedy marginal replay — `packages/core/src/optimizer/greedy.ts:228-317` | Large transaction/card selections repeatedly calculate before/after card output and raise CPU cost | **Confirmed historical, non-new:** D-09/D-51/D-86/D-C10-02. Current user-scale exit criterion is not crossed. If profiling crosses it, use incremental per-card scoring state; do not count it again here. |
| Keyword matching — `packages/core/src/categorizer/matcher.ts:92-161`; `packages/core/src/categorizer/taxonomy.ts:96-129` | Large keyword sets linearly scan normalized candidates | **Confirmed historical, non-new.** Existing deferred owner covers a trie/index; current catalog and focused tests show no new reachability or threshold change. |
| Browser/server parser duplication and date-range copies/sorts — `packages/core/src/analysis/context.ts:116-153`; `packages/parser/src/**`; `apps/web/src/lib/parser/**` | Duplicate implementations or copied date arrays increase maintenance and bounded CPU/memory | **Historical, non-new:** D-01 and prior date-range dispositions. No new pass was added. Consolidate only under their existing owner if profiling warrants it. |
| Catalog fetch/cache topology — `apps/web/src/lib/cards.ts:253-458` | Callers could start duplicate fetches, leave failed promises cached, or create a request waterfall | **Rejected as a current issue.** Shared promises, per-caller abort, timeout cleanup, and rejection eviction are present. No fix indicated. D-33 remains the historical extra-category-fetch owner. |
| Publication size — `scripts/build-json.ts:301-400`; `scripts/check-web-bundles.ts` | Legacy compatibility data could enter the initial request graph or split shards could exceed budgets | **Rejected as new.** The checker passed; legacy remains outside the first-party initial graph. Preserve the existing budget gate. |
| Cycle 18/19 calendar and publication fixes — `packages/core/src/analysis/context.ts:60-175`; `scripts/catalog-publication.ts:93-136` | New refinement or hashing could add per-row browser work | **Resolved/rejected, non-new.** Month refinement is bounded; hashing is offline generation over resident projections. |

No new candidate met the repository's requirement for a concrete user-visible
failure, changed asymptotic behavior, measured threshold crossing, or changed
reachability.

## Read-only verification

- `bun run toolchain:check`: Bun 1.3.12 passed.
- `bun run dependencies:check`: passed.
- `bun audit --json`: returned `{}`.
- `bun run data:check`: 683 cards/24 issuers and all generated/documentation
  projections matched.
- `bun run lint` and `bun run typecheck`: every workspace passed; Astro
  reported zero diagnostics.
- Eight focused analysis, persistence, worker, rules, and scraper suites:
  319 tests passed, 0 failed, with 1,076 expectations.
- `bun scripts/check-web-bundles.ts`: passed with 16 initial files, 172.4 KiB
  decoded / 59.7 KiB gzip; summary 169.1 KiB raw / 21.2 KiB gzip; compact
  catalog 26.8% and optimizer catalog 39.7% of legacy; largest detail shard
  219.1 KiB raw / 14.5 KiB gzip.
- `git diff --check` from Cycle 17 closure through reviewed HEAD: passed.

## Manual-evidence limit and final missed-issue sweep

This reviewer did not start a browser, so no fresh LCP, CLS, INP, heap, or CPU
profile was collected. The absence of a new profile is an evidence limit, not
a finding: source/resource ownership, focused worker tests, and all configured
bundle/catalog budgets passed, and no new hot-path change was found.

The closing sweep rechecked nested loops, repeated parsing and validation,
transaction-sized sorting, copies and retained buffers, promise fan-out,
worker/listener/timer cleanup, abort propagation, cache invalidation, dynamic
imports, initial/deferred request graphs, generated cardinality, synchronous
filesystem/template work, and every historical performance owner. No
confirmed, likely, or manual-validation-only new performance issue survived.

No browser process was started or terminated by this reviewer. No deployment
or publication command was invoked.

Final new performance finding count: **0**.
