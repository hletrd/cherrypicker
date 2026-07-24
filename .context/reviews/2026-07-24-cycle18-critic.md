# Cycle 18 critic review

## Review identity

- Date: 2026-07-24
- Revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Baseline: Cycle 17 review revision
  `857e12a794e585560a0c447b0a1619def02cbcf3`
- Lens: skeptical multi-perspective critique across behavior, architecture,
  public contracts, correctness, failure states, package ownership, and the
  Cycle 17 repair interactions
- Disposition: no genuinely novel current-HEAD finding
- Confidence: High
- Scope: read-only review plus this report; no product, test, generated,
  dependency, plan, workflow, Git, process, or external state was changed

## Inventory and coverage

This lane reused and independently challenged the complete inventory made
before the code-review pass: 2,394 tracked paths, including 1,222 tracked
review/plan records, 1,114 active code/configuration/authored-or-generated data
paths, and 181 test/E2E paths.

| Surface | Critic questions applied |
| --- | --- |
| `apps/web` (172 paths) | Whether parser/optimizer cancellation, replacement epochs, persistence, catalog generation pinning, navigation, and UI/report states tell the same product truth under partial, stale, malformed, or mixed input |
| `packages/core` (47) | Whether strict date admission, money bounds, reward/cap state, and optimizer comparisons preserve invariants rather than only satisfy local tests |
| `packages/parser` (86) | Whether browser/server routes, worker boundaries, format adapters, and diagnostics fail consistently without hiding partial results |
| `packages/rules` (734, including 683 card YAML files) | Whether authored values, schema normalization, semantic validation, legacy projections, and active optimizer artifacts preserve one interpretable domain contract |
| `packages/viz`, CLI, and scraper (77 combined) | Whether terminal/report output, filesystem/consent boundaries, network extraction quarantine, and command behavior fail coherently |
| Scripts, E2E, manifests, and workflow | Whether generator identity, dependency policy, build checks, and process ownership actually prove the claims made by their acceptance tests |

All 15 non-context paths changed after the Cycle 17 review were re-examined as
four cross-file repairs: analysis date projection, category-label source
serialization, homogeneous legacy reward grouping, and test/config dependency
ownership. The closing sweep also revisited unchanged parser, optimizer,
persistence, output, and publication consumers so a local fix was not treated
as sufficient evidence of an end-to-end contract.

The six protected untracked Cycle 42 paths were identified only as excluded
status entries. They were not opened, searched, hashed, staged, or modified.

## Findings

None. No candidate was simultaneously:

1. a concrete current-HEAD failure or unsound active contract;
2. distinct from completed, deferred, rejected, or previously reported
   history; and
3. supported strongly enough to assign a new Cycle 18 root.

## Independent challenge of the code-review candidates

### `C18-CR-001` — unchanged identity on changed legacy catalog bytes

The underlying observation is confirmed:

- `scripts/catalog-publication.ts:119-132` hashes only the identity-free
  summary, optimizer, detail, and category payload set;
- `scripts/build-json.ts:299-320,385-388` copies that identity into the full
  and compact legacy artifact metadata;
- `scripts/build-json.ts:245-281,400-425` changed the legacy category and
  compact projections in Cycle 17; and
- the pre-change and current legacy artifacts have different bytes while
  retaining the same hash and `1.0.0` metadata.

It does not survive the novelty test. Completed Plan 80 / root `C3-008`
explicitly states the outcome “Give every published catalog byte set a unique
identity” and requires a source-stable projection change to change the
publication ID. Plan 77 also owns a deterministic source/content hash for one
publication. The current legacy omission is therefore residual or regressed
scope under an already reported publication-identity root, not a genuinely
new root cause.

The product-impact claim also needs qualification. Active browser readers pin
only the split summary/detail/categories/optimizer generation and do not
consume the legacy rankings. No tracked first-party reader uses the legacy
hash as a cache key or interprets `meta.version` as a strict schema version.
An external legacy consumer remains plausible, but that does not turn the
historically owned identity defect into a new finding.

Disposition: do not count as a novel Cycle 18 finding. If remediation is
scheduled, reopen `C3-008`/Plan 80 for the legacy full and compact projections,
or explicitly remove identity/version semantics from artifacts that are no
longer supported contracts.

### `C18-CR-002` — `.mts` and `.cts` omitted from dependency discovery

The implementation inconsistency is also confirmed:

- `scripts/check-dependencies.ts:11-20` omits `.mts` and `.cts` from
  `SOURCE_EXTENSIONS`;
- line 21's config pattern syntactically recognizes those module extensions;
  and
- `scripts/check-dependencies.ts:470-500,632-650` filters on the extension set
  before import analysis.

It does not clear the current-failure threshold. The exact tracked tree
contains no `.mts` or `.cts` file, so every current workspace production,
test, and config import still reaches the checker. The concrete scenario
requires a future filename or extension migration. That is useful policy
hardening, but it is not a current product, build, test, or publication
failure.

Plan 147 also broadly owns admission and classification of test/config
sources. If standard module TypeScript extensions enter the tree, its
acceptance should be extended with fixtures rather than assigning a separate
current product root.

Disposition: do not count as a novel Cycle 18 finding. Add `.mts`/`.cts`
fixtures and derive the filename grammar from the extension inventory as
preventive maintenance.

## Cycle 17 repair critique

### Analysis context

`packages/core/src/analysis/context.ts:101-183` now partitions each row once,
carries its validated month through sorting, and builds the latest, previous,
and monthly collections in one pass. Invalid-date quarantine, object identity,
stable date order, January rollover, checked sums, and explicit previous
spending retain their earlier contracts. Remaining period-array sorting is
already historically owned and is not a new correctness issue.

The proof-count test's temporary `Date.UTC` wrapper is implementation-aware,
but it remains synchronous and restores the global in `finally`. No current
interleaving or leaked-state evidence survived review.

### Category-label generation

`scripts/category-label-publication.ts:5-44` projects labels as tuples,
serializes the complete array once, escapes the two JavaScript line
separators, and inserts only serialized data into a fixed module. The active
consumer still receives a `ReadonlyMap` with the same order and last-write
duplicate semantics. Source-safe serialization, not UI escaping, now owns the
correct boundary.

### Legacy reward grouping

`scripts/catalog-publication.ts:206-271` groups exact canonical kind-and-unit
values, selects and orders only inside each group, and limits each compact
group independently. The generated artifacts expose `valueKind`, `unit`, and
`comparisonGroup`, so readers no longer need to infer comparison boundaries
from a raw number. The resulting `topRewards` list may exceed five, but that
is the explicit Plan 146 repair rather than an accidental truncation failure.
Metadata/identity concerns remain under the historical publication root
discussed above.

### Dependency ownership

`scripts/check-dependencies.ts:598-692` distinguishes production from
test/config imports, accepts development ownership only outside production,
and narrowly exempts the root-owned Vitest runner. The web package now owns
its direct `iconv-lite` test import. For the exact current filename inventory,
no package reaches an undeclared dependency through the newly reviewed
surfaces.

## Rejected and historically owned alternatives

- Parser duplication, broad analyzer responsibilities, optimizer complexity,
  shallow constraint copies, taxonomy duplicates, and mixed test runners are
  explicit deferred architecture or infrastructure items.
- Session-storage sensitivity and truncation, CSP migration, PDF fallback
  catches, card-detail cancellation, non-latest-month edits, and UI color/
  animation limitations retain named deferred owners.
- Cross-unit legacy ranking is the completed Cycle 17 root; questioning
  whether any context-free legacy ranking should remain is the same design
  family, not a new defect.
- Mixed active-browser catalog generations are already prevented by
  mandatory source hashes and `acceptSourceHash()` pinning.
- Date grammar, invalid-calendar quarantine, month selection, amount signs,
  cap identities, rollback telemetry, and result-coherence validation retain
  their current completed owners and passed source-level cross-file tracing.
- No new exception swallowing, stale commit, cancellation race, unsafe state
  transition, or server/browser mismatch was established on the Cycle 17
  change surface.

## Final missed-issue sweep

- Accounted for every tracked surface from the shared inventory and every
  non-context path changed since the Cycle 17 baseline.
- Reconciled candidates against all 1,222 tracked current/archive history
  paths, with focused rereads of Plans 77, 80, 144-147 and Cycle 17 critic,
  architect, debugger, tracer, verifier, code-reviewer, and aggregate records.
- Rechecked behavior at empty/all-invalid input, numeric overflow, duplicate
  keys, grouped reward boundaries, stale/mixed publication identity,
  undeclared dependency admission, cancellation, partial failure, and output
  handoff boundaries.
- No full test, build, generator, browser, network, or process-owning command
  was run in this read-only lane.
- The only repository write from this role is this report.

Final count: zero genuinely novel critic findings.
