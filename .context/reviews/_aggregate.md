# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 17

**Date:** 2026-07-24
**Cycle:** 17 / 100
**Reviewed revision:** `857e12a794e585560a0c447b0a1619def02cbcf3`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none
**Prompt 1 status:** complete
**Prompt 2 status:** complete
**Prompt 3 status:** complete

## Executive summary

Cycle 17 completed every required and repository-specific review lens: code,
performance, defensive security, critic, verifier, test engineering, causal
tracing, architecture, debugging, documentation, design, dependency, and QA.
Every role inventoried its relevant tracked surface, checked cross-file
interactions, reconciled candidates against current and archived `.context`
history, and performed a closing missed-file sweep.

Four specialist entries survived exact-source validation and historical
deduplication. Confirmations from later roles do not inflate the count:

| Severity | Unique findings |
| --- | ---: |
| Medium | 2 |
| Low | 2 |
| **Total** | **4** |

All four findings are High confidence and confirmed. The review phase changed
no product source, test, generated artifact, dependency, manifest, plan,
workflow, deployment state, or external system. Its repository writes are the
thirteen role reports, the dated Cycle 17 aggregate, and this current
projection.

## Unique findings

### C17-001 — analysis context repeats strict calendar validation

- Severity: Medium
- Confidence: High
- Status: confirmed
- Primary source: `packages/core/src/analysis/context.ts:51-77,101-179`
- Browser callers: `apps/web/src/lib/analyzer.ts:407-425` and
  `apps/web/src/lib/store.svelte.ts:355-394`
- CLI caller: `tools/cli/src/analysis.ts:58-82`
- Original owner: performance reviewer

`buildAnalysisContext()` strictly validates every transaction date while
partitioning valid and invalid rows. It then discards that established
invariant and calls the same regular-expression plus UTC calendar round trip
again for the final row and in the latest-month, previous-month, and monthly
aggregation passes. With `N` valid rows, the current path performs `4N + 1`
strict validations instead of `N`.

The work is synchronous after browser parser workers complete and before the
optimizer worker begins; reoptimization and CLI analysis repeat it. Bounded
100,000–500,000-row checks from independent roles preserved all outputs while
removing tens to hundreds of milliseconds of redundant work.

The fix must retain one strict admission proof, carry the validated
date/month fact through the sorted collection, and derive latest rows,
previous rows, and monthly totals without revalidating. Regression coverage
must preserve invalid-date quarantine, row identity/order, leap-day behavior,
unsorted input, January rollover, exact previous-month provenance, periods,
and safe-integer failures, with a deterministic operation-count assertion.

### C17-002 — generated category literals lack structured serialization

- Severity: Medium
- Confidence: High
- Status: confirmed
- Schema boundary: `packages/rules/src/schema.ts:303-335`
- Generator: `scripts/build-json.ts:448-463`
- Generated module:
  `apps/web/src/lib/category-labels-fallback.ts:1-5`
- Active consumer:
  `apps/web/src/lib/category-labels.ts:21-23` and
  `apps/web/src/components/cards/CardDetail.svelte:40-62`
- Original owner: security reviewer

The category schema accepts ordinary strings for IDs and labels, but the
fallback generator places those values directly between handwritten
single-quote delimiters in generated TypeScript. The JSON catalog projections
use structured serialization; this executable-source projection does not.
Ordinary source-significant punctuation can therefore make regeneration fail,
and a source-valid authored value can change the generated first-party module
before Svelte output escaping applies.

The currently authored taxonomy and checked-in module are benign. The
repository-authoring boundary is nevertheless active and confirmed. The fix
must construct tuple data in memory, serialize the complete array with
`JSON.stringify`, and embed only that data in a fixed module template.
Regression tests must compile/evaluate the generated module and prove exact
map round trips for quotes, slashes, line breaks, Unicode separators, template
marker text, and other source-significant ordinary values.

### C17-003 — legacy reward indexes rank incomparable units

- Severity: Low
- Confidence: High
- Status: confirmed
- Tier selection: `scripts/build-json.ts:79-86`
- Category ordering: `scripts/build-json.ts:248-271`
- Compact ordering/truncation: `scripts/build-json.ts:373-404`
- Canonical discriminant:
  `scripts/catalog-publication.ts:179-187`
- Original owner: code reviewer

Canonical reward publication distinguishes percentage, fixed transaction,
fixed-day, mileage-per-spend, and fuel-per-liter values. The legacy generator
then compares only their raw numeric amounts, sorts category indexes by that
number, and truncates compact `topRewards` to five across kind/unit
boundaries.

Current artifacts demonstrate the defect: 14 category indexes contain mixed
comparison groups, 45 compact card lists contain mixed groups, and seven of
those lists reach the five-item truncation boundary. There is no
context-independent order between a percentage, Won amount, mileage block,
daily amount, and per-liter amount. The active browser optimizer uses its
separate validated artifact, which bounds present impact to the legacy/public
derived contract.

The fix must remove unsupported cross-group ranking or group values by the
canonical kind and unit, order only within homogeneous groups, and never
truncate one group against another. Any intentional cross-kind comparison
must use the normal calculator with an explicit scenario. Pure generator
tests must cover all five canonical value kinds and deterministic
within-group selection.

### C17-004 — web parity test does not own `iconv-lite`

- Severity: Low
- Confidence: High
- Status: confirmed
- Direct test import:
  `apps/web/__tests__/parser-cycle5-integrity.test.ts:3,48-50`
- Web manifest: `apps/web/package.json:12-30`
- Current transitive provider: `packages/parser/package.json:20-29`
- Dependency-policy boundary:
  `scripts/check-dependencies.ts:553-595,695-720`
- Original owner: dependency expert

The web parity test directly imports `iconv-lite`, but the web manifest
declares neither a dependency nor a development dependency for it. The test
passes only because the full workspace currently makes the parser package's
runtime dependency reachable. The repository dependency policy scans
production `src` imports and production dependencies, so it cannot detect
this test-only ownership mismatch.

The fix must add a web development dependency or move fixture encoding behind
an owning helper. The policy must also cover test/config imports against both
dependency sets with narrow explicit exemptions for repository-level runners.
A fixture must prove that an undeclared test-only import fails and the same
import passes once declared as a development dependency.

## Cross-role agreement

| Root | Independent confirming roles |
| --- | --- |
| C17-001 calendar validation | performance, verifier, architect, tracer, debugger, test engineer, QA |
| C17-002 category serialization | security, verifier, architect, tracer, debugger, test engineer, QA |
| C17-003 heterogeneous ranking | code, verifier, architect, tracer, debugger, test engineer, QA |
| C17-004 test dependency ownership | dependency, tracer, debugger, test engineer, QA |

The critic, document specialist, and designer retained no distinct root. The
architect and verifier completed before the dependency report landed, so
their three-root counts are chronological rather than contradictory.

## Rejected and historical candidates

- Root `zod` was examined as a possible fifth dependency finding and rejected.
  Root generators execute rules schemas through relative imports, the
  workspace uses one compatible locked identity, and removal had no
  demonstrated install or runtime benefit.
- Cycle 2 `C2-P06` owns redundant date-array sorting. `P8-01` owns the
  necessary monthly rebuild during reoptimization, and Cycle 10 owns
  post-optimizer coherence validation. None owns C17-001's repeated strict
  date proof.
- Plan 84 owns the historical `rate: 0` plus `fixedAmount` canonicalization
  defect. C17-003 occurs after the canonical discriminant is correctly
  derived.
- Earlier category-label plans own fallback generation and drift prevention,
  not raw data entering TypeScript syntax without serialization.
- Prior dependency findings own scraper Zod, removed packages, vendor
  integrity, optional peers, and browser/server partitions. None owns the web
  test's direct undeclared import.
- The document specialist noted that a README worksheet-limit sentence
  remains under the exact Cycle 16 documentation root. It is not a new Cycle
  17 finding and is not relabeled here.
- Parser duplication, optimizer/matcher architecture, persistence threat
  model, CSP limitations, PDF fallback, UI accessibility debts, and broad
  generator extraction retain their existing completed or deferred owners.

## Cycle 16 repair verification

All roles reconciled the immediately preceding worksheet-metadata repair.
The shared helper owns finite, safe, ordered sheet and merge decoding,
per-sheet and cumulative checked totals, stable typed rejection, and a
row-interval merge index. Server/browser XLSX and HTML routes validate every
named sheet before conversion, direct HTML-sheet and merge-index callers keep
their local contract, and the browser barrel remains runtime-safe.

The focused review matrix passed, including the 17 Cycle 16 worksheet tests.
No conversion bypass, server/browser mismatch, merge-order regression, or
new worksheet-policy root was retained. Plan 143 remains verified completed
for the Cycle 17 planning transition.

## Role provenance

| Role | Report | New role-owned roots |
| --- | --- | ---: |
| Code reviewer | `2026-07-24-rpf-cycle17-code-reviewer.md` | 1 |
| Performance reviewer | `2026-07-24-rpf-cycle17-perf-reviewer.md` | 1 |
| Security reviewer | `2026-07-24-rpf-cycle17-security-reviewer.md` | 1 |
| Critic | `2026-07-24-rpf-cycle17-critic.md` | 0 |
| Verifier | `2026-07-24-rpf-cycle17-verifier.md` | 0 |
| Test engineer | `2026-07-24-rpf-cycle17-test-engineer.md` | 0 |
| Tracer | `2026-07-24-rpf-cycle17-tracer.md` | 0 |
| Architect | `2026-07-24-rpf-cycle17-architect.md` | 0 |
| Debugger | `2026-07-24-rpf-cycle17-debugger.md` | 0 |
| Document specialist | `2026-07-24-rpf-cycle17-document-specialist.md` | 0 |
| Designer | `2026-07-24-rpf-cycle17-designer.md` | 0 |
| Dependency expert | `2026-07-24-rpf-cycle17-dependency-expert.md` | 1 |
| QA tester | `2026-07-24-rpf-cycle17-qa-tester.md` | 0 |

## Browser evidence and cleanup

The designer used one isolated production-browser attempt:

```text
session: cherrypicker-c17-designer-20260724
profile: /tmp/cherrypicker-c17-designer-profile.yexI2O
preview: 127.0.0.1:4174
preview PID/PGID: 77757/77757
browser daemon/root: 82027/82340 in PGID 82027
```

Home and the completed 683-card catalog were inspected at 1440 × 1000 with
accessibility snapshots, DOM/computed-style evidence, keyboard interaction,
theme state, console/error checks, and supporting visual capture. A CDP
navigation timeout triggered the required terminal cleanup, so the designer
made no fresh claim for the unvisited routes or mobile widths and retained no
new finding.

Cleanup closed only the named session and exact preview tree. Recorded
preview/browser/crash-handler PIDs are absent, ports 4173–4175 are free, the
exact profile and saved state were moved recoverably to Trash, no exact
process match remains, and
`bun scripts/run-e2e.ts status --assert-clean` passes. Unrelated user Chrome
PID/PGID `1368/1368` remains running.

## Agent failures

No unresolved agent failure. The initial defensive report return hit one
content filter; the single permitted neutral retry completed successfully
without reproduction strings. All thirteen roles ultimately returned their
required provenance file.

## Protected artifact integrity

The six protected, untracked Cycle 42 artifacts remained outside the reviewed
Git tree, unstaged and untouched. Their baseline hashes are:

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a  .context/plans/67-high-priority-cycle42.md
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1  .context/reviews/cycle42-aggregate.md
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266  .context/reviews/cycle42-code-reviewer.md
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0  .context/reviews/cycle42-debugger.md
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5  .context/reviews/cycle42-security-reviewer.md
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f  .context/reviews/cycle42-test-engineer.md
```

Prompt 1 final count: **4 genuinely new findings**.

## Prompt 2 planning result

Verified completed Plan 143 moved byte-for-byte to
`.context/plans/_archive/143-cycle16-large-worksheet-metadata-bounds.md`; its
SHA-256 remained
`dba85519721172d215dce1888427b13a49ec29cb10f5ec735bc496eff9c8803e`.
Exactly four new durable plans were created, one for each retained root:

- Plan 144 — single-proof analysis date projection;
- Plan 145 — structured category-label source serialization;
- Plan 146 — homogeneous legacy reward comparison groups; and
- Plan 147 — test/config dependency ownership.

No finding was deferred, merged away, or silently dropped. Prompt 2 final
count: **4 new plans**.

## Prompt 3 implementation result

The requested `ralph` capability was unavailable, so implementation used the
approved disciplined manual plan-to-test fallback.

- Analysis context now validates and projects each row once, with one
  synchronous proof-count regression and semantic parity coverage.
- Category fallback generation serializes the complete tuple array as data
  before inserting it into a fixed module template.
- Legacy category and compact reward indexes compare only exact canonical
  kind-and-unit groups and apply compact limits per group.
- Web test code owns `iconv-lite` directly, while the repository checker now
  enforces production versus test/config dependency ownership.

Focused implementation tests, strict generator compilation, catalog
generation/drift checks, generated ordering invariants, the dependency policy,
and the web bundle budget all passed. The implementation is divided across
four signed, plan-scoped fix commits following the signed review and planning
commits. No deployment or gate-triggered repair occurred.

The final required repository and E2E gates run after the plan-progress
commit, so they evaluate the final Cycle 17 HEAD rather than an intermediate
tree. Their results and exact cleanup evidence belong to the cycle handoff.
