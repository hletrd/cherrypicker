# Cycle 18 architecture review

## Review identity

- Date: 2026-07-24
- Revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Baseline: Cycle 17 review revision
  `857e12a794e585560a0c447b0a1619def02cbcf3`
- Lens: layering, ownership, coupling, public and generated-data contracts,
  parser/browser/CLI separation, version/identity boundaries, state flow, and
  cross-file invariants
- Disposition: one novel Low-severity finding
- Scope: read-only review plus this report; no source, test, generated
  artifact, dependency, plan, workflow, Git, process, deployment, or external
  state was changed

## Inventory and architecture map

The review reused the complete pre-inspection inventory: 2,394 tracked paths,
including 1,222 current/archive review and plan records, 1,114 active
code/configuration/authored-or-generated data paths, and 181 test/E2E paths.

| Boundary | Tracked paths | Architectural coverage |
| --- | ---: | --- |
| `apps/web` | 172 | Static/Astro and Svelte ownership, upload admission, parser and optimizer workers, operation epochs, analysis result validation/replacement, persistence, independently cached catalog projections, navigation, and UI/report consumers |
| `packages/core` | 47 | Public calendar context, categorization, numeric contracts, reward/cap execution, prepared rules, and greedy/counterfactual optimization |
| `packages/parser` | 86 | Server and browser exports, shared byte/date/amount/diagnostic kernels, archive and worksheet policy, and format adapters |
| `packages/rules` | 734 | Canonical schemas, semantic validation, catalog loaders and projections, generated identities, and 683 authored card rules |
| `packages/viz` | 14 | Terminal and standalone-report projections and sanitization |
| CLI and scraper | 63 | Command composition, calendar scoping, compiled catalog consumption, consent/output, network authority, extraction quarantine, validation, and guarded authoring |
| Scripts/E2E/root policy | 37 plus root manifests/config/workflow | Deterministic generation, dependency/toolchain/bundle checks, test/process ownership, and CI authority |

The current dependency direction remains acyclic:

```text
web     -> core, parser/browser, rules/browser
core    -> rules
viz     -> core, rules
CLI     -> core, parser, rules, scraper/args, viz
scraper -> rules, viz
```

No production package reaches into an application, and Node-only loaders stay
outside browser-safe parser/rules exports. Expensive parsing and optimization
remain worker-owned in the browser; calendar context and result coherence are
shared core/application boundaries rather than copied parser logic.

All 15 non-context paths changed since the Cycle 17 review were traced through
their consumers: the core analysis projection, safe generated label module,
legacy reward comparison projection, and dependency-ownership policy.
Generated artifacts were assessed through schema/generator/reader ownership
rather than as isolated JSON.

The six protected untracked Cycle 42 paths were excluded after name-only
status identification. They were not opened, searched, hashed, staged, or
modified.

## Finding

### C18-A-001 — `previousCalendarMonth()` does not preserve its public `YearMonth` invariant for low-year January values

- Severity: Low
- Confidence: High
- Status: confirmed by source and cross-consumer tracing; manual browser
  validation was not needed
- Public type and guard:
  `packages/core/src/analysis/context.ts:3,51-73`
- Failing transformation:
  `packages/core/src/analysis/context.ts:80-90`
- Public export: `packages/core/src/index.ts:27-42`
- Analysis caller:
  `packages/core/src/analysis/context.ts:101-164`
- Web result path:
  `apps/web/src/lib/analyzer.ts:407-425,432-461`
- Persistence boundary:
  `apps/web/src/lib/persistence.ts:677-708,822-844`
- Existing ordinary rollover test:
  `apps/web/__tests__/analysis-context.test.ts:30-34`

`isYearMonth()` accepts any four-digit year with month `01` through `12`.
`previousCalendarMonth()` then converts the year to a number and, for January,
interpolates `year - 1` without restoring four-digit width. A valid
`1000-01`, for example, produces `999-12`; `isYearMonth('999-12')` is false.
The function therefore returns a value that does not satisfy the same public
predicate and is only made to type-check by `as YearMonth`.

This is reachable beyond an isolated helper. Core strict date admission
accepts a real four-digit year 0100 or later, so `buildAnalysisContext()` can
place the malformed predecessor into `previousSpendingBasis`. The web result
coherence check derives the same malformed predecessor and can accept the
fresh result, but the persistence decoder independently requires every basis
month to pass `isYearMonth()`. A January statement in the affected low-year
range can therefore analyze successfully and then be rejected as corrupted
when restored. CLI callers likewise receive a value that violates the
exported `AnalysisContext` contract.

Concrete failure scenario: an imported ISO-dated fixture or historical data
set has its latest transaction in January 1000. Analysis reports a missing
previous calendar month as `999-12`; after session restoration, the web
persistence boundary rejects that basis rather than restoring the otherwise
coherent analysis.

Suggested root-cause fix:

1. Define the supported calendar domain explicitly. If all four-digit ISO
   years are supported, construct the predecessor with four-digit padding and
   decide explicitly how January `0000` behaves when no representable
   predecessor exists. If the product supports only a modern bounded range,
   reject earlier years at the shared date and `YearMonth` admission boundary.
2. Replace the loose `` `${number}-${string}` `` alias plus assertions with a
   constructor/brand whose output is checked by the same predicate.
3. Add closure tests asserting that every admitted boundary sample produces
   either another admitted `YearMonth` or a deliberate typed failure. Cover
   `0000`, `0001`, `0100`, `1000`, `1001`, ordinary January, and non-January
   months.
4. Add one analysis-to-persistence round trip at the minimum supported
   January so fresh-result and restored-result validation cannot diverge.

Novelty: Plan 68 / `C1-013` owns selecting the exact ordinary previous
calendar month and the existing test covers `2026-01 -> 2025-12`. Tracked
history contains no report of the transformation leaving its own admitted
`YearMonth` set, no low-year boundary, and no fresh-result versus persistence
divergence. This finding is the closed-domain/public-type failure, not a
re-report of ordinary January/December selection.

## Required adjudications

### Legacy hash/version drift

The byte/hash observation from `C18-CR-001` is current: Cycle 17 changed the
legacy full and compact projections while their copied browser-publication
hash stayed fixed. Architecturally, however, it is a regression or incomplete
scope under completed `C3-008`, not a distinct Cycle 18 root.

Plan 80 explicitly promises a unique identity for every published catalog
byte set and a changed ID for source-stable projection changes. Plan 77 owns
the same one-publication content identity. The appropriate action is to reopen
that owner and either include identity-free legacy projections in the
publication hash, give them independent identities/schema versions, or remove
unsupported legacy identity metadata. Active browser mixed-generation
protection remains sound because its summary/detail/categories/optimizer
readers pin exactly the payload set the hash covers.

No separate architect finding is counted.

### `.mts` / `.cts` dependency discovery

The extension inconsistency from `C18-CR-002` is real in
`scripts/check-dependencies.ts:11-21,470-500`: the config-name grammar
recognizes module TypeScript extensions that the file extension set excludes.
The current tracked tree contains neither extension, so no current dependency
escapes the gate.

This is best completed within Plan 147's existing ownership of test/config
source admission and manifest classification. The plan should gain `.mts` and
`.cts` fixtures and one shared extension contract before such files enter the
tree. It does not justify a separate current architecture root.

No separate architect finding is counted.

## Cycle 17 boundary assessment

- The calendar optimization now carries one validated month projection per
  accepted row and preserves parser, core, browser, and CLI responsibility
  boundaries. C18-A-001 is an older public-helper closure issue exposed by the
  same path, not a regression in the single-proof optimization.
- Category-label source publication now has one pure projection and one
  structured serialization boundary. Generated source no longer owns
  handwritten escaping rules.
- Legacy reward comparisons now retain canonical kind/unit distinctions in a
  pure helper. The active optimizer still evaluates scenario-aware rewards
  through core rather than consuming the legacy order.
- Production versus test/config dependency ownership is correctly separated
  after file admission. The web test now owns `iconv-lite` directly and the
  root-runner exception remains narrow.

## Rejected and historically owned candidates

- Parser duplication, analyzer breadth, optimizer complexity, shallow
  constraint copies, mixed test runners, and broad generator extraction are
  explicit deferred architecture items.
- Persistence sensitivity/truncation, CSP migration, PDF fallback catches,
  card-detail cancellation, taxonomy duplication, non-latest-month edits, and
  UI animation/color limitations retain existing owners.
- Repeated strict calendar validation, category source interpolation,
  heterogeneous legacy ranking, and test dependency ownership are completed
  Cycle 17 roots; no new bypass of their repaired boundaries survived review.
- Publication mixing on active browser artifacts remains fail-closed through
  one source hash and independent-reader pinning.
- No new package-direction cycle, Node/browser leakage, worker ownership
  inversion, stale result commit, schema/generator disagreement, or
  output-authority bypass was established.

## Final missed-issue sweep

- Accounted for every active surface in the complete tracked inventory and
  every changed non-context path since the Cycle 17 baseline.
- Reconciled candidates against all 1,222 tracked current/archive history
  paths, with focused rereads of Plans 68, 77, 80, and 144-147 plus the Cycle
  17 aggregate and specialist reports.
- Rechecked public export closure, invalid/empty inputs, low/high calendar
  boundaries, numeric overflow, cancellation, persistence round trips,
  generated-data identity, dependency admission, and browser/server/CLI
  handoffs.
- No full test, build, generator, browser, network, or process-owning command
  was run during this read-only role.
- The only write from this role is this report.

Final count: one novel Low-severity finding, High confidence.
