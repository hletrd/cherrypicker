# Review-plan-fix Cycle 17 — debugger

## Review identity

- Date: 2026-07-24
- Revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: latent failure, invariant, error-path, race, numeric, state, and
  regression review
- Disposition: no genuinely new debugger-only finding retained
- Scope: read-only investigation plus this report. No product source, test,
  generated artifact, plan, dependency, configuration, commit, deployment, or
  external state was changed.

## Inventory and method

The exact tracked manifest contains 2,374 paths, including 1,204 `.context`
records and 1,170 active paths. The debugger pass classified every active path
and then followed the error-prone boundaries below:

| Risk class | Files and collections examined |
| --- | --- |
| Input and parser failures | Server/browser parser dispatch, all CSV/XLSX/HTML/JSON/OFX/PDF adapters, detection and encoding, parser workers and protocol decoders, upload admission, file queue, shared date/amount/field/worksheet/archive/PDF kernels, and parser tests |
| Async ownership and races | `operation-epoch.ts`, `analysis-replacement-runtime.ts`, `analysis-reset-runtime.ts`, `file-parse-queue.ts`, parser and optimizer worker runners/protocols, `quick-bank-hint.ts`, `store.svelte.ts`, and component abort/generation guards |
| Analysis invariants | `packages/core/src/analysis/context.ts`, `performance.ts`, browser analyzer/helpers, CLI analysis, category summaries, previous-month provenance, and strict result coherence |
| Optimizer and numeric state | Core numeric helpers, constraints, reward calculation, greedy optimizer, rule support/availability gates, cap and unsupported-rule telemetry, worker decoding, and optimizer tests |
| Persistence and restoration | `analysis-result.ts`, `persistence.ts`, store storage adapters, version migration, parse-warning bounding, size truncation, prototype-key rejection, and result/dashboard/report restoration consumers |
| Catalog state and generation | Rules schemas and semantic validation, all authored catalog collections, publication identity, `build-json.ts`, catalog projection, generated artifacts, source-hash readers, category fallback, card pages, optimizer and legacy consumers, scraper writer/validator paths |
| Regression and ownership | All 176 tracked paths matching standard test-file names plus their fixtures, every Cycle 16 role report and aggregate, Plan 143 and the completed repair, all available Cycle 17 reports, and full tracked `.context` searches for each investigated hypothesis |

The review used current source and existing bounded evidence. It did not run
full gates, deploy, regenerate artifacts, or add a new benchmark.

## Current Cycle 17 root reconciliation

The debugger pass confirms, but does not duplicate, the four current owners:

| Existing owner | Severity / confidence / status | Debugger disposition |
| --- | --- | --- |
| `C17-CR-001` | Low / High / Confirmed | The raw-scalar comparison is active at `scripts/build-json.ts:79-86,248-271,373-404`. Its effect is limited to legacy/public generated rankings because the browser optimizer loads a separate artifact at `apps/web/src/lib/cards.ts:336-359,438-443`. |
| `RPF17-PERF-001` | Medium / High / Confirmed | The invariant is established at `packages/core/src/analysis/context.ts:114-121`, then strict validation is repeated at `:125-150`. Browser initial analysis, browser reoptimization, and CLI callers are ordinary reachable paths. |
| `C17-SEC-001` | Medium / High / Confirmed | The category schema permits arbitrary strings at `packages/rules/src/schema.ts:303-335`, while the generator emits them as raw TypeScript literal fragments at `scripts/build-json.ts:448-463`. Current authored data and generated output are benign. |
| `C17-DEP-001` | Low / High / Confirmed | The web parity test directly imports `iconv-lite` at `apps/web/__tests__/parser-cycle5-integrity.test.ts:3,48-50`; `apps/web/package.json:14-30` does not declare it. Current transitive resolution comes from `packages/parser/package.json:20-24`, while `scripts/check-dependencies.ts:553-595` scans production source only. |

The Cycle 17 critic, architect, and document specialist no-finding results are
consistent with the completed Cycle 16 repair and the four roots above. The
Cycle 17 verifier independently confirmed the first three before the
dependency report became available.

## Latent-failure investigations

### Async replacement and reoptimization ownership — rejected as a new root

Potential failure considered: an older analysis, cancellation, or
reoptimization completes after a newer operation and overwrites the current
result or persistence.

Current safeguards are coherent:

- `OperationEpoch.begin()` aborts the prior controller and tokens require the
  epoch, controller identity, and non-aborted signal to match
  (`apps/web/src/lib/operation-epoch.ts:15-35`).
- Replacement analysis composes caller and store signals, makes commits
  conditional on both owners, and removes both abort listeners
  (`apps/web/src/lib/analysis-replacement-runtime.ts:44-82`).
- Persisted old state is cleared as a replacement precondition, clear failure
  preserves the prior committed result, and every later mutation is guarded
  (`apps/web/src/lib/analysis-replacement-runtime.ts:114-207`).
- Reoptimization snapshots the exact result object and rechecks both operation
  ownership and object identity across async boundaries
  (`apps/web/src/lib/store.svelte.ts:332-440`).

No current sequence was found in which stale work can pass these checks and
publish a result. Historical stale-analysis and mixed-snapshot findings retain
their existing owners.

### Parser and optimizer worker settlement — rejected as a new root

Potential failure considered: abort, worker error, decode failure, and normal
message race one another, causing a double settlement, leaked worker, or late
result.

Both runners use a single `settled` guard, remove message/error/abort
listeners, and terminate the worker for every settlement path:

- parser: `apps/web/src/lib/parser/worker-runner.ts:75-132`;
- optimizer: `apps/web/src/lib/optimizer/worker-runner.ts:57-117`.

Synchronous `postMessage()` failures use the same failure/cleanup path.
Protocol decoders reject malformed responses before a result is returned.
No separate leak or late-publication path survived.

### Persisted-result corruption and split-brain state — rejected as a new root

Potential failure considered: malformed or oversized local storage restores a
partially trusted result, or truncation makes displayed totals disagree with
the optimization.

The persistence boundary:

- rejects prototype-affecting keys during parse;
- projects a fixed versioned shape;
- measures encoded bytes and, when necessary, omits the entire transaction
  array with explicit provenance rather than persisting a partial array
  (`apps/web/src/lib/persistence.ts:127-198`);
- structurally decodes nested fields and bounded warnings; and
- calls `isAnalysisResultCoherent()` with the truncation count before accepting
  a version-4 result (`apps/web/src/lib/persistence.ts:720-923`).

Replacement clear failure also stops before replacing in-memory state
(`apps/web/src/lib/analysis-replacement-runtime.ts:140-161`). No current path
was found that restores or commits a structurally invalid split-brain result.

### Calendar, previous-month, and performance-exclusion state — no new root

Potential failures considered:

- impossible dates entering the recommendation month;
- January rollover selecting the wrong prior month;
- invalid dates affecting statement totals;
- unknown performance-exclusion facts accidentally qualifying a higher tier;
- positive-spending aggregation overflowing a safe integer.

Strict admission and previous-month derivation are in
`packages/core/src/analysis/context.ts:51-90,101-179`. Invalid-date rows remain
inspectable but are excluded from calendar scope. Performance exclusions fail
closed: any unknown exclusion produces a zero performance amount plus an
inspectable issue
(`packages/core/src/analysis/performance.ts:32-65,96-125`). Numeric additions
use safe-integer helpers.

The repeated validation is the existing performance finding, not a separate
correctness defect. No invariant break was retained.

### Optimizer numeric and unsupported-rule behavior — rejected as a new root

Potential failures considered:

- `NaN`, infinity, or unsafe transaction amounts reaching sort/scoring;
- empty or non-executable catalogs producing a plausible recommendation;
- zero-reward rows disappearing from spending reconciliation;
- cap-loss telemetry arithmetic publishing unsafe values.

`greedyOptimize()` rejects an empty eligible catalog, validates transaction
amounts and prior spending, canonicalizes reward-eligible input, and accounts
for zero-reward rows as unassigned spending
(`packages/core/src/optimizer/greedy.ts:579-635,643-680,760-835`). Cap-loss
entries require safe nonnegative arithmetic before publication. Support and
recommendation eligibility are separated by the current rule-availability
helpers.

Unsupported-only behavior and earlier numeric defects already have completed
historical owners. No new current-HEAD failure was identified.

### Cycle 16 worksheet repair — no bypass or regression retained

Potential failures considered:

- a later sheet avoids cumulative validation;
- browser and server limits diverge;
- HTML-as-XLS skips the guard;
- malformed merge endpoints reach the interval index;
- overlap precedence or merged source identity changes.

The shared helper owns finite, ordered, safe worksheet and merge decoding,
per-sheet limits, cumulative workbook limits, a stable rejection, and an
independently guarded merge index
(`packages/parser/src/shared/sheet-cells.ts:1-70,260-432`). Server/browser XLSX
and HTML adapters validate complete workbooks before each production
`sheet_to_json()` call. Reverse interval lookup preserves last-range-wins
semantics and anchor identity.

The exhaustive call-site sweep found no fifth conversion route or unguarded
worker adapter. The Cycle 16 repair remains sound.

### Catalog cross-artifact state — rejected as a new root

Potential failure considered: summary, optimizer, category, or detail requests
from different publication generations combine into one internally plausible
catalog.

Each decoded artifact carries the same publication identity and
`acceptSourceHash()` pins the in-memory generation
(`apps/web/src/lib/cards.ts:308-425`). Failed requests clear their own promise
cache, and issuer detail requests are keyed and independently cleaned. The
generator and publication tests own identity parity across artifacts.

This does not repair the legacy heterogeneous ranking and does not encode the
generated TypeScript fallback safely; those remain the existing Cycle 17
roots. No separate current cross-generation mismatch was found.

### UI error and restoration paths — rejected as a new root

Potential failure considered: results UI renders a stale or invalid payload
while restoration, replacement, and component fetches overlap.

The store accepts only coherently deserialized or freshly validated results.
Result pages start in a readiness shell and expose explicit error and empty
states before revealing data-driven components. Card-detail category fetches
use an unmount abort guard and select the generated fallback only after an
empty or failed category response
(`apps/web/src/components/cards/CardDetail.svelte:40-62`).

Earlier category-label flash, cache, and result-readiness issues have
historical owners. No distinct current failure sequence survived.

### Test dependency ownership — existing dependency root confirmed

Potential failure considered: a parity test works in the full workspace but
fails when web dependencies are installed or linked without parser's
transitive package.

The test directly executes `iconv-lite`, but the web manifest does not own it.
Current success depends on workspace hoisting through parser. The repository
policy scans only `src` and production dependencies, so it does not enforce
the test contract. This is the existing `C17-DEP-001`, not a separate
debugger root. Its smallest correction is a web development dependency or an
encoding helper owned by the declaring workspace, plus test/config policy
coverage.

## Rejected candidate log

| Hypothesis | Status | Reason |
| --- | --- | --- |
| Cancelled parse publishes a late result | Rejected | Worker settlement and store ownership both prevent a late commit. |
| Concurrent reoptimization mixes two result snapshots | Rejected | Exact result identity is pinned and rechecked before every post-await mutation. |
| Persistence truncation silently changes authoritative totals | Rejected | Transactions are omitted as a whole with explicit count provenance; restored coherence accounts for that state. |
| One unknown exclusion affects only its row, so zeroing the card is a bug | Rejected | The documented rule is deliberately fail-closed because an unknown exclusion could otherwise qualify a higher tier; an issue is emitted. |
| Modern browser recommendations consume legacy raw-scalar rankings | Rejected | The optimizer loads the separate validated optimizer artifact. |
| Svelte escaping neutralizes raw generated TypeScript | Rejected | The unsafe boundary occurs at source generation and module parsing, before rendering. |
| Cycle 16 validates only the selected sheet | Rejected | Complete workbook validation occurs before selection and conversion. |
| Source-hash mismatch can combine browser catalog generations | Rejected | Every active artifact decoder pins one shared source hash. |
| Successful hoisted resolution proves the web test dependency is declared | Rejected | Resolution is supplied transitively by parser; the importing workspace has no direct manifest entry. |

## Historical reconciliation

All 1,204 tracked `.context` paths were inventoried, and full-history searches
were run for the exact functions, invariants, failure scenarios, and candidate
terms above.

- Every Cycle 16 role report, its aggregate, Plan 143, the implementation, and
  current tests were reconciled. Worksheet metadata and merge-index ownership
  remains Cycle 16.
- Earlier plans own archive-byte limits, merge correctness, parser diagnostic
  bounds, JSON field aliases, PDF resource limits, optimizer
  unsupported-only behavior, async store epochs, persistence coherence,
  catalog source hashes, and UI cache/readiness defects.
- Earlier dependency reports do not own the web test's `iconv-lite` mismatch;
  their Zod, removed-package, lock-label, and vendor items are distinct.
- Cycle 2 and Cycle 10 date/result work do not own the repeated strict calendar
  validator identified in Cycle 17.
- Earlier catalog generation and fallback-label work does not own either the
  heterogeneous ranking or the unencoded data-to-TypeScript boundary.
- The current Cycle 17 code, performance, security, dependency, critic,
  verifier, architect, and document reports were read in full. Confirming
  their roots does not create debugger duplicates.

Protected untracked Cycle 42 artifacts were not used as provenance and were
not modified.

## Final missed-file sweep

The closing sweep covered all production call sites for:

- parser detection, worker dispatch, SheetJS conversion, workbook validation,
  merge indexing, and direct fallbacks;
- context construction, previous-month derivation, performance exclusions,
  optimizer dispatch, and CLI analysis;
- operation epochs, replacement/reset, worker settlement, persistence,
  restoration, and result coherence;
- catalog schema validation, raw reward comparison, publication identity,
  generated fallback labels, active and legacy readers, and UI consumers.
- test-only package imports, workspace manifests, transitive providers, and
  the dependency policy's source/declaration coverage.

It also rechecked error catches, abort-listener cleanup, numeric safe-integer
guards, optional/empty collections, generated artifacts, public exports,
focused regressions, and historical ownership. No missed file changed the
candidate dispositions.

## Debugger result

No genuinely new debugger-only finding met the required current,
reproducible, actionable, and historically distinct threshold. There is
therefore no new severity, scenario, or fix to add beyond the four existing
Cycle 17 owners.
