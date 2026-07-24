# Review-plan-fix Cycle 19 — performance reviewer

## Review identity

- Date: 2026-07-24
- Reviewed revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: performance, concurrency, CPU, memory, bundle, and UI-responsiveness review
- Disposition: **no genuinely new actionable performance finding**
- Browser work: none assigned or performed
- Product/source changes: none

Cycle 18's `YearMonth`, catalog-publication identity, and `.mts` / `.cts`
repairs are treated as completed provenance. This pass looked for a regression
introduced by those repairs and for an independent current-HEAD performance
root elsewhere; it did not relabel known deferred costs as new findings.

## Inventory and coverage

`git ls-files` enumerated all 2,409 tracked paths before review. The inventory
was classified rather than sampled:

| Surface | Tracked inventory examined |
| --- | ---: |
| TypeScript/JavaScript/Svelte/Astro source and tests | 362 paths |
| Historical reviews and plans used for novelty reconciliation | 1,237 paths |
| Rule/public data, including all 683 card YAML sources | 739 paths |
| Manifests, lock/config, workflow, docs, fixtures, and other tracked assets | 71 paths |

The performance-specific source sweep covered:

- `packages/core/src/**` and 19 core test files: matcher construction and
  lookup, exact reward calculation, cap telemetry, greedy scoring, alternative
  replay, deterministic ordering, and analysis-context aggregation;
- `packages/parser/src/**`, its 34 test/conformance paths, and the browser
  parser mirror: text decoding, delimiter/row admission, XLSX archive and
  worksheet bounds, PDF extraction, format dispatch, and worker transfer;
- all 80 web production paths and 57 web tests: parser/optimizer workers,
  bounded parse lanes, catalog fetch/cache/abort state, persistence/coherence,
  Svelte derived state, and deferred hydration;
- rules, visualization, CLI, scraper, all scripts, their tests, E2E source,
  root/workspace manifests, Turbo/Vitest/Playwright/Astro configuration, and
  the deployment workflow;
- all generated catalog projections and their reader/build checks, checking
  sizes, cardinalities, shared identity, and request boundaries.

Cross-file paths were followed from input admission through parsing,
categorization, calendar selection, reward calculation, optimization,
serialization, rendering, and persistence. Generator work was followed from
YAML validation through legacy and split projections to browser readers.

## Cycle 18 delta assessment

### Calendar-domain closure

`packages/core/src/analysis/context.ts:60-114` now refines `YearMonth` at one
runtime boundary and preserves four-character years. The new
`parseYearMonth()` call adds one short regular-expression check to helper
construction. `buildAnalysisContext()` still validates each row once, retains
the projected month at `:137-175`, and aggregates monthly state in the same
linear pass. No second per-row validation or unbounded allocation was
introduced.

The remaining `dateRange()` copies/sorts at `:116-122` are the already-owned
low-impact cost recorded by prior review history. They are not caused by the
Cycle 18 repair and do not become a new finding at current statement sizes.

### Complete publication identity

`scripts/build-json.ts:298-395` constructs identity-free browser and legacy
projections before injection. `scripts/catalog-publication.ts:96-136`
canonicalizes the complete keyed payload set once during offline generation.
This adds bounded build-time hashing work over data already resident for
publication; it does not enter the browser runtime or duplicate the fetched
optimizer graph.

Current generated output retains one source hash across the three legacy
files, summary, optimizer, categories, and 24 detail shards. The build-budget
checker passed with:

- 16 initial files, 172.4 KiB decoded and 59.7 KiB gzip;
- 169.1 KiB raw / 21.2 KiB gzip summary;
- compact legacy payload at 26.8% of the full legacy payload;
- optimizer payload at 39.7% of the full legacy payload; and
- largest issuer detail shard at 219.1 KiB raw / 14.5 KiB gzip.

The 4.96 MiB legacy file remains published deliberately for compatibility and
is prohibited from the first-party request graph. That is an existing
publication decision, not a newly introduced browser transfer.

### Module-TypeScript dependency admission

`scripts/check-dependencies.ts:11-22,465-511,532-692` adds two entries to a
small extension set and derives top-level config admission from the same set.
There are no tracked `.mts` or `.cts` consumers, so current scan cardinality is
unchanged. The gate completed successfully; no meaningful CPU or I/O
regression was measurable or structurally plausible.

## Whole-repository performance assessment

### Confirmed current costs, all historically owned

- `packages/core/src/optimizer/greedy.ts:228-317` replays before/after card
  output during marginal scoring. This remains the D-09/D-51/D-86 and
  D-C10-02 optimizer-complexity family.
- `packages/core/src/categorizer/matcher.ts` retains the known large keyword
  scan and normalized lookup structure. Its scale and trie/index alternatives
  are already recorded in the deferred registry.
- Browser and server parser implementations remain duplicated. That is the
  architectural D-01 owner; current worker isolation and format-specific
  dynamic imports keep the heavy XLSX/PDF paths out of the initial graph.
- `apps/web/src/lib/cards.ts:280-420` keeps request timeouts, abort ownership,
  immutable caches, and issuer-level detail loading. No new waterfall,
  duplicate fetch, or stale promise was found.
- `apps/web/src/lib/file-parse-queue.ts:22-148` bounds parallel parse lanes and
  yields before CPU work; parser workers transfer bytes without adding a new
  main-thread whole-file copy.
- XLSX ZIP and worksheet metadata bounds, parser input budgets, scraper
  response/deadline bounds, persisted warning limits, and catalog artifact
  budgets all remain enforced.

These are confirmed observations, not Cycle 19 findings. None has a new
failure mechanism, reachability change, or threshold crossing at this
revision.

### Likely issues

None retained. Candidate concerns about an extra calendar regex, unified hash
memory, extension-set growth, legacy publication size, worker startup, and
Svelte recomputation were checked against their call frequency and existing
budgets; none supports a current regression.

### Manual-validation risks

No new risk was promoted. This role did not launch a browser, so it did not
collect fresh LCP/CLS/INP traces. The source-level initial-graph and artifact
budgets passed, and Cycle 18's browser evidence already covered interactive
responsiveness. Absence of a new browser profile is therefore a limitation of
this review evidence, not a finding.

## Read-only verification

- `bun run dependencies:check`: passed.
- `bun run typecheck`: all seven workspaces passed; Astro reported 0 errors,
  0 warnings, and 0 hints.
- `bun run test`: all workspace and script suites passed; the script portion
  reported 96 tests and 1,032 expectations.
- `bunx vitest run --reporter=dot`: 128 files and 3,137 tests passed.
- `bun scripts/check-web-bundles.ts`: passed with the budgets listed above.

No E2E or browser process was started by this reviewer.

## Final missed-issue sweep

The closing sweep rechecked nested loops, repeated parsing/validation,
sort/filter/map chains, unbounded collections, synchronous filesystem and
template work, promise fan-out, worker lifecycle, abort cleanup, cache
invalidation, initial and deferred bundle graphs, generated payload
cardinality, and current versus historical performance ownership. It also
checked that the Cycle 18 implementation did not move offline hashing or
dependency analysis into a user-facing path.

No relevant performance file was skipped, and no genuinely new confirmed,
likely, or manual-validation performance finding survived the sweep.

Final new finding count: **0**.
