# Review-plan-fix Cycle 17 — verifier

## Review identity

- Date: 2026-07-24
- Revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: independent evidence verification across implementation, tests,
  generated artifacts, public contracts, and live consumers
- Disposition: all three current Cycle 17 roots confirmed; no additional
  verifier-only finding
- Unique current count: two Medium and one Low, all High confidence
- Scope: review and this report only; no product source, test, generated data,
  plan, configuration, dependency, commit, deployment, or external state was
  changed

## Inventory and verification method

The exact Git tree contains 2,374 tracked paths: 1,204 tracked `.context`
records and 1,170 active product, data, test, documentation, workflow,
configuration, and vendor-integrity paths. The active inventory is:

| Surface | Tracked paths | Verification coverage |
| --- | ---: | --- |
| `apps/web` | 172 | Browser catalog readers, category fallback bundle path, synchronous analysis and reoptimization callers, parser adapters/workers, persistence, result decoders, and UI consumers. |
| `packages/core` | 47 | Calendar context construction, categorization, reward calculation, optimizer inputs/results, and relevant public exports and tests. |
| `packages/parser` | 86 | Server/browser worksheet validators, XLSX/HTML adapters, shared merge index, routers, and public browser surface. |
| `packages/rules` | 734 | Canonical category/reward schemas, semantic validation, 683 authored card YAML files, generated catalogs, and browser/CLI artifact contracts. |
| `packages/viz` | 14 | Result and catalog presentation boundaries. |
| `tools/cli` | 28 | Analysis-context and compiled/authoring catalog consumers. |
| `tools/scraper` | 35 | Category/rule authoring boundaries and schema consumers. |
| Scripts, E2E, and root policy | 54 | Catalog generation/publication, generated-data checks, bundle budgets, package contracts, and deployment gate order. |

There are 180 tracked test files. Generated data was checked from canonical
input through generator, checked-in artifact, validator, and consumer rather
than treated as handwritten source. The three current candidate reports and
the no-finding critic report were independently reconciled against
implementation evidence:

| Current root | Independent disposition |
| --- | --- |
| `C17-CR-001` — heterogeneous legacy reward ranking | Confirmed at Low / High confidence. The defect is active in checked-in artifacts, but the primary browser optimizer does not consume the affected rankings. |
| `RPF17-PERF-001` — repeated strict calendar validation | Confirmed at Medium / High confidence. The redundant work is synchronous on normal browser and CLI paths and scales linearly with valid rows. |
| `C17-SEC-001` — generated category labels interpolated into TypeScript literals | Confirmed at Medium / High confidence. The current taxonomy is benign, but the authoring schema permits values that the source generator does not encode. |

## Confirmed root 1 — heterogeneous reward values are sorted and truncated as one scalar

- Aggregate owner: `C17-CR-001`
- Severity: Low
- Confidence: High
- Status: Confirmed by source-to-artifact-to-consumer tracing and a bounded
  read-only artifact query
- Tier projection and selection: `scripts/build-json.ts:79-86`
- Category index construction and ordering:
  `scripts/build-json.ts:248-271`
- Compact top-reward ordering and truncation:
  `scripts/build-json.ts:373-404`
- Canonical kind projection: `scripts/catalog-publication.ts:179-187`
- Current artifacts:
  `packages/rules/data/cards.json`,
  `packages/rules/data/cards-compact.json`, and
  `apps/web/public/data/cards.json`

The canonical reward tier preserves five materially different value kinds:
percentage, fixed per transaction, fixed per day, mileage per spend, and fuel
per liter. `publicationRewardIndexValue()` reduces those to a numeric amount,
a `rate`/`fixedAmount` discriminant, and the separately retained unit.

`pickBestTier()` nevertheless compares only the numeric amount. The category
index then sorts only by `rewardValue`, and compact `topRewards` sorts only by
`bestValue` before slicing to five. Neither operation uses the retained kind
or unit. A percentage point, Won, miles per spending block, Won per day, and
Won per liter are not a common scalar without a transaction and benefit
scenario.

The checked-in data demonstrates the mismatch:

- 14 category indexes contain more than one value-kind/unit combination;
- the `dining` index begins with fixed values 5,000, 4,000, and 2,000 before
  percentage values of 60 because the raw numbers are descending;
- 45 cards' compact `topRewards` contain mixed kind/unit combinations, and
  seven of those mixed lists are exactly at the five-entry truncation
  boundary.

For a 10,000-Won purchase, 60% is 6,000 Won and exceeds a fixed 5,000-Won
benefit. At a smaller purchase the relationship can reverse. There is no
context-free ordering that makes the artifact's scalar rank truthful.

Consumer tracing limits the current impact. The browser catalog loader is
explicitly prohibited from requesting legacy `data/cards.json`; it loads the
validated summary, detail, categories, and optimizer artifacts instead
(`apps/web/src/lib/cards.ts:308-458`,
`scripts/check-web-bundles.ts:169-195`). The build-stat reader consumes only
legacy metadata, and the compact artifact is used by the bundle-size gate.
The malformed ranking therefore does not alter current recommendations, but
it remains an exposed legacy/public derived contract and can mislead any
downstream reader that treats its ordering or top-five selection as a
ranking.

Recommended correction:

1. Remove the legacy ranking fields if they have no supported consumer.
2. Otherwise group and order only within identical canonical kind/unit
   groups, with no truncation across incomparable groups.
3. Route any intentional cross-kind comparison through the calculator with
   an explicit transaction, performance, condition, usage, and cap scenario.
4. Extract a pure generator projection and cover all five value kinds,
   ordering, and truncation in generator tests.

## Confirmed root 2 — analysis context repeats strict calendar validation after establishing the invariant

- Aggregate owner: `RPF17-PERF-001`
- Severity: Medium
- Confidence: High
- Status: Confirmed by lifecycle tracing, exact operation accounting, focused
  contract tests, and an independent bounded benchmark
- Strict validator and month projection:
  `packages/core/src/analysis/context.ts:51-77`
- Context construction:
  `packages/core/src/analysis/context.ts:101-179`
- Normal browser caller: `apps/web/src/lib/analyzer.ts:407-425`
- Browser reoptimization caller:
  `apps/web/src/lib/store.svelte.ts:355-394`
- CLI caller: `tools/cli/src/analysis.ts:58-82`
- Browser admission scale: `apps/web/src/lib/upload-admission.ts:3-5`

`buildAnalysisContext()` partitions every row with `isValidIsoDate()`. That
check performs the regular expression, numeric conversion, `Date.UTC()`,
`Date` construction, and a UTC field round-trip. Every row placed in
`validTransactions` has therefore established a canonical `YYYY-MM-DD`
invariant.

The function then calls `yearMonthOfDate()` for:

1. the final sorted row;
2. every row in the latest-month filter;
3. every row in the previous-month filter; and
4. every row in monthly aggregation.

`yearMonthOfDate()` invokes the same strict validator again before slicing the
month. With `N` valid rows, context construction therefore performs `4N + 1`
strict calendar validations when only the first `N` are needed.

This occurs synchronously after browser parser workers finish and before the
optimizer worker begins. Reoptimization repeats the same window-thread work;
the CLI pays it synchronously as well. File admission permits 50 MiB across
50 files, so compact statement data can plausibly reach six-figure row counts.

An independent in-memory check projected 100,000 valid rows through the three
post-validation passes. Five alternating samples produced a 64.3 ms median
with `yearMonthOfDate()` and 11.4 ms with direct month slicing, with identical
latest, previous, and per-month counts. Absolute device timings will differ;
the source-level `3N + 1` redundant validation count is deterministic.

The focused calendar contract tests pass and prove that strict admission,
leap-day behavior, invalid-date quarantine, exact previous-calendar-month
selection, and safe totals are intentional. They do not require repeated
validation after admission.

Recommended correction:

1. Retain one strict partition as the trust boundary.
2. Derive a month directly from a value branded or privately typed as a
   validated ISO date.
3. Build latest rows, previous rows, and monthly totals in one pass over the
   already sorted valid rows while retaining safe-integer checks and order.
4. Add parity for invalid dates, leap day, unsorted input, January rollover,
   and multiple months, plus an operation-count assertion of at most one
   calendar round-trip per input row.

## Confirmed root 3 — category data enters generated TypeScript without source-literal encoding

- Aggregate owner: `C17-SEC-001`
- Severity: Medium
- Confidence: High
- Status: Confirmed by schema, generator, generated module, build-gate, and
  browser-consumer tracing plus a non-executing in-memory parse check
- Authoring schema: `packages/rules/src/schema.ts:303-335`
- Generator: `scripts/build-json.ts:448-463`
- Generated module:
  `apps/web/src/lib/category-labels-fallback.ts:1-5`
- Export and browser consumer:
  `apps/web/src/lib/category-labels.ts:21-23` and
  `apps/web/src/components/cards/CardDetail.svelte:1-63`
- Page bundle path:
  `apps/web/src/components/cards/CardPage.svelte:1-8,147-181` and
  `apps/web/src/pages/cards/index.astro:1-9`
- Verification/publication order:
  `package.json:19-29` and `.github/workflows/deploy.yml:42-63`

`categoryNodeSchema` accepts unrestricted strings for IDs and labels. The
generator constructs each TypeScript tuple by placing the raw value between
handwritten single quotes. Unlike the JSON artifacts, this path does not
serialize the tuple data with `JSON.stringify`.

A safe bounded check passed a label containing an ordinary apostrophe through
the production category schema. The schema accepted it, while the exact
generator template produced TypeScript that the Bun transpiler rejected with
a parse error. More generally, source-significant characters can change
rather than merely break the generated program because the value is inserted
before TypeScript parsing. The current committed category values contain no
such payload and the current generated module is benign.

`data:check` verifies parity with the same template, so a regenerated
source-valid artifact can satisfy the data gate. Syntax-breaking values are
subsequently caught by the build, but that does not make data-to-code
interpolation a safe publication boundary. `CardDetail` statically imports
the generated module into the card-page bundle and uses it when the category
request is empty or fails.

The taxonomy is repository-authored rather than runtime user input, which
reduces exploitability. The boundary still lets a nominally data-only change
alter first-party executable source and makes ordinary punctuation a release
failure. Medium severity is retained because the generated module executes in
the application's origin if a source-valid change passes review and
publication.

Recommended correction:

1. Build an in-memory array of `[id, label]` tuples and embed one complete
   `JSON.stringify()` result as data in the module.
2. Add generator tests for quotes, backslashes, newlines, Unicode separators,
   and exact round-trip preservation.
3. Keep ID-format and label-length restrictions as defense in depth, not as a
   replacement for structured serialization.

## Cycle 16 implementation verification

The completed worksheet-metadata repair was checked independently against Plan
143, the Cycle 16 reports, implementation, public exports, adapters, and
focused regressions:

- `packages/parser/src/shared/sheet-cells.ts` owns finite, safe, ordered A1
  and merge decoding, per-sheet and cumulative checked totals, a stable typed
  rejection, and a row-interval merge index.
- Both server and browser XLSX paths validate the complete decoded workbook
  before logical conversion.
- Both server and browser HTML paths validate every table before selecting a
  result, and direct sheet calls apply the per-sheet contract.
- The browser barrel exports the shared policy without adding a Node runtime
  dependency.
- Stable error code/message translation and normal merged-table source
  identity remain aligned.

The focused calendar plus Cycle 16 matrix passed 29 tests and 145
expectations. No repair regression or bypass was retained.

## Historical reconciliation and closing sweep

All 1,204 tracked current and archived `.context` records were inventoried,
and candidate-specific searches were run against tracked history so protected
untracked Cycle 42 artifacts were not adopted as provenance.

- Earlier generator plans own canonical validation, determinism, artifact
  parity, and the fallback's existence. They do not own raw heterogeneous
  reward comparison or unencoded category strings entering TypeScript.
- The historical `rate: 0` plus `fixedAmount` defect concerned selecting the
  canonical discriminant. The current ranking defect occurs after the
  discriminant has been derived correctly.
- Cycle 2 `C2-P06` owns repeated date-array sorting, `P8-01` owns a necessary
  reoptimization monthly rebuild, and Cycle 10 owns duplicate post-optimizer
  result coherence. None owns repeated strict date validation within one
  pre-optimizer context build.
- Parser duplication, legacy bank metadata, persistence threat-model items,
  CSP limitations, PDF fallback, and Cycle 16 worksheet bounds retain their
  existing owners and were not relabeled.

The final sweep rechecked every current candidate's producer, validation
boundary, generated output, active and legacy consumer, public export, test
contract, normal failure scenario, and historical owner. No fourth root met
the current, reproducible, and novel threshold.

Read-only checks performed:

- independent artifact queries for category-index and compact mixed kinds;
- in-memory category schema/source parse check;
- independent 100,000-row post-validation calendar projection;
- `bun test apps/web/__tests__/analysis-context.test.ts
  apps/web/__tests__/cycle16-worksheet-metadata.test.ts`: 29 passed, 0 failed,
  145 expectations.

No full repository gate, browser, preview server, E2E run, commit, push, or
deployment was performed. The six protected untracked Cycle 42 artifacts were
not edited, staged, removed, or incorporated into this report.

Final verifier disposition: confirm the three current unique roots — two
Medium and one Low, all High confidence — with no additional finding.
