# Review-plan-fix Cycle 18 — test engineer

## Review identity

- Date: 2026-07-24
- Revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Role: unit/integration coverage, gate topology, regression design, assertion
  quality, and flake-risk review
- Disposition: **three confirmed regression gaps attached to the three
  retained Cycle 18 product findings; zero test-engineer-new roots**
- Severity/confidence: each attached gap is Low / High, matching the bounded
  production defect it must prevent
- Scope: read-only test review plus this report; no source, test, plan,
  generated artifact, git, browser, E2E, build, or runner change

## Test and gate inventory

The existing complete repository inventory contains 181 tracked test/E2E
paths:

| Surface | Test paths |
|---|---:|
| `apps/web` | 57 |
| `e2e` | 16 |
| `packages/core` | 19 |
| `packages/parser` | 49 |
| `packages/rules` | 7 |
| `packages/viz` | 3 |
| `scripts` | 9 |
| `tools/cli` | 10 |
| `tools/scraper` | 11 |

The root test gate at `package.json:12-29` runs all workspace test tasks
through Turbo and then the script tests. The blocking `verify` chain also
owns toolchain, migrations, dependency policy, audit, generated-data drift,
lint, typecheck, and web build/bundle checks. CI invokes that chain before the
separate browser regression job at `.github/workflows/deploy.yml:33-46`.
Workspace tests depend on upstream builds through `turbo.json:4-17`.

Coverage was mapped across catalog generation/publication, generated-data
drift, browser split-artifact decoding and hash pinning, CLI compiled-catalog
parity, dependency-policy fixtures, shared analysis context, previous-spending
resolution, persistence validation, and browser/CLI disclosure consumers.
No browser or E2E execution was needed for the three deterministic
source-level boundaries reviewed here.

## Required regression for C18-CR-001 — legacy projection identity

- Product severity: **Low**
- Confidence: **High**
- Test status: **Confirmed missing assertion**
- Existing split-artifact identity coverage:
  `scripts/__tests__/catalog-publication.test.ts:475-645`
- Legacy projection implementation:
  `scripts/build-json.ts:245-281,299-329,375-438`
- Drift gate: `package.json:19-20,29`

The publication suite correctly proves byte-stable ordering and proves that
mutating summary, optimizer, detail, or category projections changes the
shared browser publication hash. It cannot express the failing legacy case:
the full category index and compact `topRewards` are constructed inside the
top-level build script rather than the identity-free helper accepted by
`computePublicationSourceHash()`.

The generated-data check is not a semantic substitute. It proves that tracked
files equal current generator output, so it passes when the generator writes
changed legacy bytes and copies the same uncovered hash/version into them.
The current suite likewise verifies comparison-group selection and ordering
but never relates those legacy bytes to their advertised identity.

Concrete regression scenario: change only a legacy category-index field or
compact reward projection while holding split browser payloads constant. The
current identity test has no input slot for that mutation, and the drift gate
accepts the regenerated artifact. A stale downstream cache remains
undetectable.

Root-cause test fix:

1. Extract identity-free legacy full and compact builders from
   `build-json.ts`, or extend the canonical publication payload model to own
   keyed legacy projections.
2. Establish a baseline identity, mutate only the legacy full projection, and
   require an identity or independent content hash change.
3. Repeat for compact `topRewards`, including a mutation that changes
   comparison-group cardinality.
4. Assert exact schema/version policy: either the representation change bumps
   the legacy version or a decoder rejects the old/new shape under one
   version.
5. Retain the existing ordering test so mere input reordering remains
   identity-stable.

This is coverage for `C18-CR-001`, not a separate defect.

## Required regression for C18-CR-002 — module-TypeScript file admission

- Product severity: **Low**
- Confidence: **High**
- Test status: **Confirmed missing fixture**
- Fixture filename ownership:
  `scripts/__tests__/check-dependencies.test.ts:21-88`
- Existing classification assertions:
  `scripts/__tests__/check-dependencies.test.ts:144-226`
- Production admission boundary:
  `scripts/check-dependencies.ts:8-21,464-503,632-684`

The dependency tests use isolated `mkdtemp()` workspaces, clean them in
`afterEach`, and assert exact diagnostic objects. Their fixture helper,
however, hard-codes `src/index.ts`, `__tests__/fixture.test.ts`, and
`fixture.config.ts`. All production/test/config ownership cases therefore
exercise only `.ts`.

Concrete regression scenario: change the config fixture filename to
`fixture.config.mts` or the nested test filename to a `.cts` module and leave
its package undeclared. Current production code silently omits the file, but
the fixture API cannot request that filename, so the blocking-policy tests
remain green.

Root-cause test fix:

1. Parameterize production, nested-test, and config fixture filenames instead
   of only their contents.
2. Add table-driven `.mts` and `.cts` cases for config and nested-test
   discovery.
3. For each extension, assert exact undeclared-package diagnostics and then
   assert acceptance after adding the package to `devDependencies`.
4. Include a production-source module-extension case so recursive discovery
   and config discovery cannot diverge.
5. Keep expected relative paths explicit; do not weaken assertions to counts
   or substring matches.

The temporary-directory design is deterministic and does not add a material
flake risk. This missing fixture belongs to `C18-CR-002`, not a new test root.

## Required regression for C18-VR-001 — YearMonth closure at low years

- Product severity: **Low**
- Confidence: **High**
- Test status: **Confirmed boundary omission**
- Shared-core semantic coverage:
  `packages/core/__tests__/analysis.test.ts:8-126`
- Web adapter helper coverage:
  `apps/web/__tests__/analysis-context.test.ts:13-91`
- Production boundary:
  `packages/core/src/analysis/context.ts:51-91,101-164`

Core coverage already checks an unsorted valid/invalid mixture, leap day,
modern December/January rollover, exact object identity, periods, monthly
totals, missing predecessors, and explicit totals. The web adapter separately
checks direct helper behavior for `2026`. Neither suite includes a
leading-zero four-digit year or asserts that every valid helper input produces
an output that passes `isYearMonth()`.

Concrete regression scenario: a valid preceding month in December 0999 and a
latest January 1000 transaction enter the context. The modern rollover test
passes, while the low-year pair is separated because the computed predecessor
loses its leading zero. Previous spending is consequently treated as absent.

Root-cause test fix:

1. Add a table-driven helper invariant for every month shape at representative
   years `0100`, `0101`, `0999`, `1000`, and a modern control: the predecessor
   must be exact and must satisfy `isYearMonth()`.
2. Add a full-context January 1000/December 0999 case asserting
   `previousTransactions`, `statement-month` provenance, and monthly order.
3. Add a same-year leading-zero case so the regression is not limited to
   January rollover.
4. Specify the `0000-01` lower-bound policy with an exact throw/result
   assertion rather than allowing an unchecked malformed string.
5. Keep the deterministic proof-count test unchanged except for any new
   fixture rows; avoid wall-clock or duration thresholds.

The `Date.UTC` observation in
`packages/core/__tests__/analysis.test.ts:34-94` is restored in `finally` and
kept within one synchronous test body, so it does not present a current
inter-test flake. The missing low-year cases are coverage for `C18-VR-001`.

## Historical reconciliation

All 1,222 tracked `.context` paths were included in the existing history
inventory and searched for these exact assertion boundaries.

- Cycle 3 publication tests intentionally cover the active split runtime
  payloads and mixed-generation rejection. Plan 146 covers homogeneous legacy
  comparison groups. Neither asserts legacy-only projection mutation against
  the metadata copied into legacy artifacts.
- Plan 147 and the dependency fixture suite cover production versus
  test/config ownership after admission. They do not vary module extensions.
- Plan 144 and the Cycle 17 analysis tests cover proof count and modern
  year-boundary semantics. Older date-padding tests concern parser-produced
  month/day strings, not the numeric year conversion in
  `previousCalendarMonth()`.

The three omissions therefore support the current Cycle 18 findings. They are
not relabeled as independent test-engineer discoveries.

## Flakiness, assertion quality, and final missed-issue sweep

The closing sweep checked conditional assertions, optional-chain expectations,
temporary filesystem cleanup, global monkey patches, wall-clock dependencies,
randomness, skipped/isolated tests, exact diagnostic ordering, fixture
ownership, generated-data self-consistency, runner inclusion, and CI gate
ordering around the affected surfaces.

- Catalog identity tests are pure and deterministic; the limitation is model
  coverage, not flakiness.
- Dependency fixtures use unique temporary roots and awaited cleanup; the
  limitation is hard-coded filenames.
- Analysis proof-count coverage restores the global `Date.UTC` function in
  `finally` inside a synchronous test; the limitation is boundary selection.
- Optional chaining inside the reviewed expectations still fails when the
  expected value is absent; no vacuous conditional assertion was found on
  these paths.
- The three relevant suites are included in the blocking root `test`/`verify`
  graph once their fixtures are added.

No additional distinct current test gap, flaky-test mechanism, runner
divergence, or unowned gate survived source and history reconciliation. No
test, browser, E2E, build, generator, or network command was run. The six
protected untracked Cycle 42 artifacts were not opened or modified. Final
test-engineer-new finding count: **0**.
