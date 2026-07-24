# Review-plan-fix Cycle 17 — architect

## Review identity

- Date: 2026-07-24
- Revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: layering, ownership, coupling, package/runtime boundaries, shared
  abstractions, state and data flow, generated-data authority, and failure
  containment
- Disposition: no distinct architect-only finding
- Current-root assessment: the three retained Cycle 17 roots are
  architecturally coherent and distinct; this report does not assign duplicate
  finding IDs
- Scope: review and this report only; no source, test, generated artifact,
  plan, dependency, workflow, commit, deployment, or external state changed

## Inventory and architecture map

The exact Git tree contains 2,374 tracked paths: 1,204 tracked `.context`
records and 1,170 active product, data, test, documentation, configuration,
workflow, and vendor-integrity paths.

| Surface | Paths | Architecture coverage |
| --- | ---: | --- |
| `apps/web` | 172 | Static pages and Svelte islands, upload admission, parser and optimizer workers, analysis replacement, persistence, catalog caches, navigation, and presentation. |
| `packages/core` | 47 | Calendar/performance context, categorization, reward calculation, prepared-card execution, optimization, and result contracts. |
| `packages/parser` | 86 | Server entry points, browser-safe exports, shared parsing kernels, archive/worksheet policy, and format adapters. |
| `packages/rules` | 734 | Domain/schema ownership, category and rule semantics, 683 authored card records, artifact contracts, and generated catalogs. |
| `packages/viz` | 14 | Terminal and standalone-report projections. |
| `tools/cli` | 28 | Command composition, statement/catalog capabilities, consent, and report output. |
| `tools/scraper` | 35 | Target authority, network fetch, untrusted extraction, canonical quarantine, and guarded publication. |
| Scripts, E2E, root, and workflow | 54 | Catalog/docs generation, dependency/toolchain/bundle policy, process ownership, and Pages verification/deployment. |

The implementation inventory includes 211 runtime/source paths, 180 test
paths, 683 authored card YAML files, 30 generated catalog JSON paths, and 20
manifest/configuration/workflow paths. Repeated authored and generated data was
reviewed through schema, semantic validation, generator, identity, reader, and
consumer ownership rather than as isolated records.

Static production imports preserve this acyclic workspace direction:

```text
web     -> core, parser/browser, rules/browser
core    -> rules
viz     -> core, rules
CLI     -> core, parser, rules, scraper/args, viz
scraper -> rules, viz
```

No production package reaches into an application by relative path, and
cross-workspace production imports use declared package exports. Node
filesystem loaders remain outside the parser and rules browser surfaces.
Application build-only code is the intentional exception: Astro build stats
read a generated public artifact on the build host.

The two primary end-to-end flows are:

```text
statement bytes
  -> admission / parser worker / shared parser kernels
  -> categorized transactions / strict calendar context
  -> optimizer worker / clone decoder / coherence validation
  -> replacement epoch / store / persistence
  -> Svelte, terminal, and standalone-report views

card and category YAML
  -> canonical schemas / semantic catalog validation
  -> publication projections and shared source identity
  -> browser summary, detail, categories, and optimizer readers
  -> core calculator and optimizer
```

The scraper supplies a separate authoring flow:
network policy and pinned fetch -> untrusted model extraction -> deterministic
provenance/support quarantine -> canonical rule validation -> safe writer.
The deployment workflow keeps build verification under read-only authority and
grants Pages/OIDC authority only to the downstream deployment job.

## Current Cycle 17 architecture assessment

### `C17-CR-001` — heterogeneous legacy reward ranking

- Severity: Low
- Confidence: High
- Status: Confirmed current root; no duplicate architect ID
- Boundary evidence:
  `scripts/build-json.ts:79-86,248-271,373-404` and
  `scripts/catalog-publication.ts:179-187`
- Concrete scenario: the generated `dining` index orders fixed 5,000 Won ahead
  of 60% solely because `5000 > 60`, although a 10,000-Won purchase reverses
  that relationship. Compact output also truncates across distinct kinds and
  units.
- Architectural cause: the legacy projections discard a domain distinction
  that the canonical publication helper has already established. Ordering is
  being decided in the side-effecting generator instead of by a typed
  homogeneous projection or the scenario-aware calculator.
- Smallest coherent fix: remove unsupported legacy rankings, or move a pure
  typed projection beside canonical publication and allow ordering only
  within identical kind/unit groups. Cross-kind ranking belongs to core
  calculation with an explicit scenario.

The active browser architecture limits this root: it consumes the
identity-bound summary/detail/categories/optimizer artifacts and explicitly
does not request legacy `cards.json`. The defect remains real at the legacy
public/generated contract, not in recommendation execution.

### `RPF17-PERF-001` — strict date proof is discarded and repeated

- Severity: Medium
- Confidence: High
- Status: Confirmed current root; no duplicate architect ID
- Boundary evidence:
  `packages/core/src/analysis/context.ts:51-77,101-179`,
  `apps/web/src/lib/analyzer.ts:407-425`,
  `apps/web/src/lib/store.svelte.ts:355-394`, and
  `tools/cli/src/analysis.ts:58-82`
- Concrete scenario: after every valid row has passed the regex and UTC
  calendar round-trip, three later whole-row passes call the same strict proof
  again. Six-figure uploads add a synchronous window-thread interval before
  the optimizer worker can start, and reoptimization repeats it.
- Architectural cause: the calendar trust boundary returns ordinary
  `T[]`/`string`, so the established valid-date invariant has no representation
  inside the next lifecycle phase.
- Smallest coherent fix: retain one strict partition, create a private
  validated-date/month projection, and derive latest, previous, and monthly
  collections in one pass. Preserve the public tolerant input contract and
  invalid-row quarantine.

This is a local preparation/execution ownership issue, not a reason to move
analysis context into the worker. Parser completion, visible invalid-row
review, context derivation, and optimizer-worker input remain correctly
separated.

### `C17-SEC-001` — category data is interpolated into TypeScript source

- Severity: Medium
- Confidence: High
- Status: Confirmed current root; no duplicate architect ID
- Boundary evidence:
  `packages/rules/src/schema.ts:303-335`,
  `scripts/build-json.ts:448-463`,
  `apps/web/src/lib/category-labels-fallback.ts:1-5`,
  `apps/web/src/lib/category-labels.ts:21-23`, and
  `apps/web/src/components/cards/CardDetail.svelte:1-63`
- Concrete scenario: a schema-valid label containing an ordinary apostrophe
  produces malformed TypeScript. A source-valid metacharacter sequence can
  instead change the generated module that is statically bundled into the
  card page.
- Architectural cause: a data projection crosses into executable-source
  syntax without a serializer. The data parity gate compares output from the
  same unsafe template, so it cannot establish source-literal safety.
- Smallest coherent fix: construct tuple data in memory and embed the complete
  `JSON.stringify()` result in one fixed module template. Test exact round
  trips for source-significant characters.

This root and `C17-CR-001` occur in the same generator but are not one failure:
one loses reward-unit semantics in JSON ordering; the other crosses a
data/code boundary without encoding. They need separate regression contracts.

## Boundary and ownership sweep

### Parser and runtime separation

The known server/browser adapter duplication remains, but shared
browser-compatible kernels now own format detection, encoding, amounts,
dates, diagnostics, JSON/OFX/PDF text interpretation, XLSX archive policy, and
worksheet metadata/merge behavior. It remains historical `D-01`, not a new
Cycle 17 root.

The Cycle 16 repair strengthens this direction. One dependency-free shared
module owns worksheet limits, checked workbook totals, typed rejection, and
the ordered row-interval merge index. All four XLSX/HTML adapters invoke it
before logical conversion, direct HTML-sheet calls retain the per-sheet
contract, and the browser barrel exposes it without Node imports. No new
layering bypass was found.

### Analysis, workers, state, and persistence

Parser workers own expensive format decoding and terminate through explicit
runner protocols. The analyzer owns composition of parsed rows, taxonomy,
calendar context, and optimizer invocation; core owns calculation semantics.
The optimizer worker returns an untrusted structured clone that is decoded
before use.

Framework-free result coherence stays outside the Svelte store. Operation
epochs and the replacement runtime own cancellation and last-operation
commit; persistence separately owns migration, exhaustive shape/financial
validation, truncation provenance, and storage failure. Presentation reads
the committed DTO and does not mutate calculation state. Existing
`D-34`/analyzer-size and historical cache/state-machine proposals already own
the broader refactor questions.

### Rules, artifacts, and catalog consumers

Rules owns canonical schemas, category resolution, semantic support, card
availability, and optimizer artifact validation. Publication derives one
source identity for browser summary, detail shards, categories, and optimizer
data. Browser caches pin the first accepted identity and reject mixed
generations. CLI compiled mode reads the same optimizer artifact contract;
authoring mode pairs card/category input and performs semantic validation.

The currently retained generator defects are outside that normal runtime
lane: ad hoc legacy ranking and fallback source rendering remain in
`build-json.ts`. The broader request to split generation into a pure
`buildArtifacts(inputs)` operation plus a thin CLI is already recorded in
Plan 72. It was therefore not reintroduced as a fourth finding.

### CLI, scraper, output, and workflow

CLI commands compose package APIs rather than duplicate parsing,
categorization, optimization, or visualization semantics. Statement byte
ownership and remote-PDF consent remain explicit. Report and scraper output
retain a trusted directory capability through validation and atomic commit.

Scraper network authority, fetched evidence, model output, support
quarantine, canonical validation, and filesystem publication remain distinct
stages. Provider credentials remain environment-only. The build workflow
runs the canonical verification path before a deploy-only job receives Pages
authority. No dependency inversion, capability leak, or second publication
authority survived the closing trace.

## Historical novelty and final disposition

All 1,204 tracked `.context` records were inventoried and candidate terms were
searched across current and archived reviews/plans, including the complete
Cycle 16 set, Plan 143, and the four current Cycle 17 specialist reports.

- `D-01` and its continuations own server/browser parser duplication.
- `D-34` and later architect reports own the analyzer's broad composition
  responsibilities.
- Plan 72 owns the broader pure-generator/thin-CLI refactor. Its general sort
  and artifact requirements do not identify the current heterogeneous-unit
  ranking or unsafe TypeScript literal construction.
- Cycle 2's duplicate date sorts, `P8-01` monthly rebuilding, and Cycle 10's
  post-optimizer coherence work do not own repeated strict validation inside
  one pre-optimizer context.
- Known matcher/optimizer redesigns, caches, persistence extraction,
  virtualization, parser parity, CSP, and PDF architecture retain their
  recorded owners.

The final missed-file sweep covered package manifests/exports, production
cross-package imports, browser-safe entry points, all worker protocols,
analysis/replacement/persistence state, canonical schemas and authored data,
every generated artifact family and reader, CLI/scraper capabilities,
reporting sinks, build scripts, E2E ownership, and workflow privilege order.
No fourth issue had both a concrete current-HEAD failure and a distinct
historical owner.

No full gate, new benchmark, browser, preview server, E2E run, commit, push,
or deployment was performed for this architecture role. The six protected
untracked Cycle 42 artifacts were not edited, staged, removed, or used as
current architecture authority.

Final architect disposition: zero additional findings. Retain the three
current Cycle 17 roots under their existing owners.
