# Cycle 5 — Performance Reviewer

**Review target:** `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715` on `codex/review-plan-fix-no-deploy-20260723`
**Mode:** read-only full-repository performance review

## Inventory and method

The inventory started from all 2,133 tracked paths. I inspected the current runtime, worker, parser, rules, CLI, scraper, build, publication, persistence, component, test, E2E, and workflow paths. The 683 declarative card files across 24 issuers were covered by the canonical schema/publication gates and full-data queries. Generated and historical review artifacts were treated as evidence, not manually reviewed as production source.

The sweep traced initial-load assets, worker payload ownership, full-file parsing, catalog loading and caching, optimizer loops, component mount work, storage serialization, async fan-out, timers/listeners, and build budgets. Cycle 4 closures were checked first. Known deferred optimizer candidate rescanning (`D-C1-040`) and linear merchant-keyword matching (`D-C1-041`) are intentionally not re-reported.

## Finding

### C5-PERF-001 — Every `Icon` instance reconstructs the complete SVG path lookup table

- **Severity:** Low
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/src/components/ui/Icon.svelte:1-41`; repeated-list consumers `apps/web/src/components/upload/FileDropzone.svelte:476` and `apps/web/src/components/cards/CardDetail.svelte:317`
- **Concrete scenario:** A maximum-size upload selection renders 50 file rows, each with an `Icon`, or a card detail renders many reward rows. Hydration/mounting constructs the same 27-property lookup object once per icon instance even though its values are immutable application constants.
- **Evidence:** `icons` is declared in the component's ordinary instance `<script>`, not module scope. The source component is 10,054 bytes and contains 27 path entries. Direct Svelte compilation and the production `Icon.*.js` chunk both place `const o = { ...all paths... }` inside the generated component function, confirming fresh object/property initialization for every instance. This is not a duplicate-download finding—the chunk is loaded once—but it is avoidable repeated allocation and initialization on dense screens.
- **Suggested fix:** Move the immutable map into `<script module lang="ts">` or a separate module and reference it from instances. A later typed-icon/component conversion could also avoid `{@html}` parsing, but module-scoping the existing map is the narrow fix. Add a compiler-output or mount regression check only if the project wants to prevent this class of component-local static table from returning.

## Verification and final missed-issue sweep

- `bun run web:build:check` passed: 17 initial files, 194.8 KiB decoded / 66.5 KiB gzip, with compact catalog, optimizer, and detail-shard budgets passing.
- `bun run test:e2e` passed 93/93 tests in 37.0 seconds. `bun scripts/run-e2e.ts status --assert-clean` then confirmed no owned runs and port 4173 available.
- Parser `ArrayBuffer` transfer, bounded delimiter sampling, compiled CLI catalog loading, worker concurrency, lazy parser chunks, cancellation, and publication caching were rechecked and retain their Cycle 4 fixes.
- Final searches covered synchronous/full-file operations, large-array spread, unbounded `Promise.all`, worker transfer lists, storage copies, component-local static maps, generated-data loading, and listener cleanup. No other non-deferred performance issue met the evidence threshold.
